// Package store wraps the three DynamoDB tables defined in infra/modules/database.
//
// Only Get/Put/Update/Delete/Query/BatchGet/BatchWrite (and the transactional
// variants built on them) are used, which matches the Lambda IAM policy. There
// are no Scans.
package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	"github.com/isaac-evs/friends_nearby/backend/internal/config"
	"github.com/isaac-evs/friends_nearby/backend/internal/models"
)

var (
	ErrEmailTaken    = errors.New("email already registered")
	ErrUsernameTaken = errors.New("username already taken")
	ErrAlreadyExists = errors.New("friendship already exists")
	ErrNotPending    = errors.New("no pending request to accept")
)

const (
	emailPrefix    = "email#"
	usernamePrefix = "username#"
)

type Store struct {
	db  *dynamodb.Client
	cfg *config.Config
}

func New(db *dynamodb.Client, cfg *config.Config) *Store {
	return &Store{db: db, cfg: cfg}
}

// ---------------------------------------------------------------- users

// marker is a uniqueness/lookup item stored in the users table. It lets us look
// users up by email or username with a plain GetItem and enforce uniqueness
// atomically, without needing a secondary index.
type marker struct {
	UserID string `dynamodbav:"user_id"` // "email#<email>" or "username#<name>"
	RefID  string `dynamodbav:"ref_id"`  // the real user id
}

func NormalizeEmail(s string) string    { return strings.ToLower(strings.TrimSpace(s)) }
func NormalizeUsername(s string) string { return strings.ToLower(strings.TrimSpace(s)) }

// CreateUser writes the user and its email/username markers in one transaction.
func (s *Store) CreateUser(ctx context.Context, u *models.User) error {
	userItem, err := attributevalue.MarshalMap(u)
	if err != nil {
		return err
	}
	emailItem, err := attributevalue.MarshalMap(marker{UserID: emailPrefix + NormalizeEmail(u.Email), RefID: u.UserID})
	if err != nil {
		return err
	}
	nameItem, err := attributevalue.MarshalMap(marker{UserID: usernamePrefix + NormalizeUsername(u.Username), RefID: u.UserID})
	if err != nil {
		return err
	}
	notExists := aws.String("attribute_not_exists(user_id)")
	table := aws.String(s.cfg.UsersTable)
	_, err = s.db.TransactWriteItems(ctx, &dynamodb.TransactWriteItemsInput{
		TransactItems: []types.TransactWriteItem{
			{Put: &types.Put{TableName: table, Item: emailItem, ConditionExpression: notExists}},
			{Put: &types.Put{TableName: table, Item: nameItem, ConditionExpression: notExists}},
			{Put: &types.Put{TableName: table, Item: userItem, ConditionExpression: notExists}},
		},
	})
	var tce *types.TransactionCanceledException
	if errors.As(err, &tce) {
		for i, r := range tce.CancellationReasons {
			if aws.ToString(r.Code) == "ConditionalCheckFailed" {
				switch i {
				case 0:
					return ErrEmailTaken
				case 1:
					return ErrUsernameTaken
				}
			}
		}
	}
	return err
}

func (s *Store) GetUser(ctx context.Context, id string) (*models.User, error) {
	out, err := s.db.GetItem(ctx, &dynamodb.GetItemInput{
		TableName:      aws.String(s.cfg.UsersTable),
		ConsistentRead: aws.Bool(true),
		Key:            map[string]types.AttributeValue{"user_id": &types.AttributeValueMemberS{Value: id}},
	})
	if err != nil || out.Item == nil {
		return nil, err
	}
	var u models.User
	if err := attributevalue.UnmarshalMap(out.Item, &u); err != nil {
		return nil, err
	}
	return &u, nil
}

// GetUsers returns the users that exist, keyed by id.
func (s *Store) GetUsers(ctx context.Context, ids []string) (map[string]*models.User, error) {
	result := make(map[string]*models.User, len(ids))
	for start := 0; start < len(ids); start += 100 {
		end := min(start+100, len(ids))
		keys := make([]map[string]types.AttributeValue, 0, end-start)
		for _, id := range ids[start:end] {
			keys = append(keys, map[string]types.AttributeValue{"user_id": &types.AttributeValueMemberS{Value: id}})
		}
		req := map[string]types.KeysAndAttributes{s.cfg.UsersTable: {Keys: keys}}
		for len(req) > 0 {
			out, err := s.db.BatchGetItem(ctx, &dynamodb.BatchGetItemInput{RequestItems: req})
			if err != nil {
				return nil, err
			}
			for _, item := range out.Responses[s.cfg.UsersTable] {
				var u models.User
				if err := attributevalue.UnmarshalMap(item, &u); err != nil {
					return nil, err
				}
				result[u.UserID] = &u
			}
			req = out.UnprocessedKeys
		}
	}
	return result, nil
}

func (s *Store) lookup(ctx context.Context, key string) (string, error) {
	out, err := s.db.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(s.cfg.UsersTable),
		Key:       map[string]types.AttributeValue{"user_id": &types.AttributeValueMemberS{Value: key}},
	})
	if err != nil || out.Item == nil {
		return "", err
	}
	var m marker
	if err := attributevalue.UnmarshalMap(out.Item, &m); err != nil {
		return "", err
	}
	return m.RefID, nil
}

// UserIDByEmail returns "" when no user has that email.
func (s *Store) UserIDByEmail(ctx context.Context, email string) (string, error) {
	return s.lookup(ctx, emailPrefix+NormalizeEmail(email))
}

// UserIDByUsername returns "" when no user has that username.
func (s *Store) UserIDByUsername(ctx context.Context, username string) (string, error) {
	return s.lookup(ctx, usernamePrefix+NormalizeUsername(username))
}

// ProfilePatch lists the profile fields a user may change. Nil means unchanged.
type ProfilePatch struct {
	DisplayName *string
	RadiusM     *int
	GhostMode   *bool
	PhotoKey    *string
}

func (s *Store) UpdateProfile(ctx context.Context, id string, p ProfilePatch) (*models.User, error) {
	var sets []string
	names := map[string]string{}
	values := map[string]types.AttributeValue{}
	add := func(attr string, v types.AttributeValue) {
		sets = append(sets, fmt.Sprintf("#%s = :%s", attr, attr))
		names["#"+attr] = attr
		values[":"+attr] = v
	}
	if p.DisplayName != nil {
		add("display_name", &types.AttributeValueMemberS{Value: *p.DisplayName})
	}
	if p.RadiusM != nil {
		add("radius_m", &types.AttributeValueMemberN{Value: fmt.Sprint(*p.RadiusM)})
	}
	if p.GhostMode != nil {
		add("ghost_mode", &types.AttributeValueMemberBOOL{Value: *p.GhostMode})
	}
	if p.PhotoKey != nil {
		add("photo_key", &types.AttributeValueMemberS{Value: *p.PhotoKey})
	}
	if len(sets) == 0 {
		return s.GetUser(ctx, id)
	}
	out, err := s.db.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName:                 aws.String(s.cfg.UsersTable),
		Key:                       map[string]types.AttributeValue{"user_id": &types.AttributeValueMemberS{Value: id}},
		UpdateExpression:          aws.String("SET " + strings.Join(sets, ", ")),
		ConditionExpression:       aws.String("attribute_exists(user_id)"),
		ExpressionAttributeNames:  names,
		ExpressionAttributeValues: values,
		ReturnValues:              types.ReturnValueAllNew,
	})
	if err != nil {
		return nil, err
	}
	var u models.User
	if err := attributevalue.UnmarshalMap(out.Attributes, &u); err != nil {
		return nil, err
	}
	return &u, nil
}

// ---------------------------------------------------------- friendships

func friendKey(userID, friendID string) map[string]types.AttributeValue {
	return map[string]types.AttributeValue{
		"user_id":   &types.AttributeValueMemberS{Value: userID},
		"friend_id": &types.AttributeValueMemberS{Value: friendID},
	}
}

func (s *Store) GetFriendship(ctx context.Context, userID, friendID string) (*models.Friendship, error) {
	out, err := s.db.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(s.cfg.FriendshipsTable),
		Key:       friendKey(userID, friendID),
	})
	if err != nil || out.Item == nil {
		return nil, err
	}
	var f models.Friendship
	if err := attributevalue.UnmarshalMap(out.Item, &f); err != nil {
		return nil, err
	}
	return &f, nil
}

func (s *Store) ListFriendships(ctx context.Context, userID string) ([]models.Friendship, error) {
	var result []models.Friendship
	var startKey map[string]types.AttributeValue
	for {
		out, err := s.db.Query(ctx, &dynamodb.QueryInput{
			TableName:                 aws.String(s.cfg.FriendshipsTable),
			KeyConditionExpression:    aws.String("user_id = :u"),
			ExpressionAttributeValues: map[string]types.AttributeValue{":u": &types.AttributeValueMemberS{Value: userID}},
			ExclusiveStartKey:         startKey,
		})
		if err != nil {
			return nil, err
		}
		var page []models.Friendship
		if err := attributevalue.UnmarshalListOfMaps(out.Items, &page); err != nil {
			return nil, err
		}
		result = append(result, page...)
		if out.LastEvaluatedKey == nil {
			return result, nil
		}
		startKey = out.LastEvaluatedKey
	}
}

// AcceptedFriendIDs returns the ids of everyone userID is friends with.
func (s *Store) AcceptedFriendIDs(ctx context.Context, userID string) ([]string, error) {
	all, err := s.ListFriendships(ctx, userID)
	if err != nil {
		return nil, err
	}
	var ids []string
	for _, f := range all {
		if f.Status == models.StatusAccepted {
			ids = append(ids, f.FriendID)
		}
	}
	return ids, nil
}

// CreateRequest stores a pending request from -> to as two rows.
func (s *Store) CreateRequest(ctx context.Context, from, to string) error {
	now := time.Now().Unix()
	out := models.Friendship{UserID: from, FriendID: to, Status: models.StatusPendingOut, CreatedAt: now}
	in := models.Friendship{UserID: to, FriendID: from, Status: models.StatusPendingIn, CreatedAt: now}
	outItem, err := attributevalue.MarshalMap(out)
	if err != nil {
		return err
	}
	inItem, err := attributevalue.MarshalMap(in)
	if err != nil {
		return err
	}
	table := aws.String(s.cfg.FriendshipsTable)
	cond := aws.String("attribute_not_exists(user_id)")
	_, err = s.db.TransactWriteItems(ctx, &dynamodb.TransactWriteItemsInput{
		TransactItems: []types.TransactWriteItem{
			{Put: &types.Put{TableName: table, Item: outItem, ConditionExpression: cond}},
			{Put: &types.Put{TableName: table, Item: inItem, ConditionExpression: cond}},
		},
	})
	var tce *types.TransactionCanceledException
	if errors.As(err, &tce) {
		return ErrAlreadyExists
	}
	return err
}

// Accept turns the pending request between me and other into a friendship.
// me must be the receiver (my row is pending_in).
func (s *Store) Accept(ctx context.Context, me, other string) error {
	table := aws.String(s.cfg.FriendshipsTable)
	update := func(user, friend, from string) types.TransactWriteItem {
		return types.TransactWriteItem{Update: &types.Update{
			TableName:           table,
			Key:                 friendKey(user, friend),
			UpdateExpression:    aws.String("SET #s = :accepted"),
			ConditionExpression: aws.String("#s = :from"),
			ExpressionAttributeNames: map[string]string{
				"#s": "status",
			},
			ExpressionAttributeValues: map[string]types.AttributeValue{
				":accepted": &types.AttributeValueMemberS{Value: models.StatusAccepted},
				":from":     &types.AttributeValueMemberS{Value: from},
			},
		}}
	}
	_, err := s.db.TransactWriteItems(ctx, &dynamodb.TransactWriteItemsInput{
		TransactItems: []types.TransactWriteItem{
			update(me, other, models.StatusPendingIn),
			update(other, me, models.StatusPendingOut),
		},
	})
	var tce *types.TransactionCanceledException
	if errors.As(err, &tce) {
		return ErrNotPending
	}
	return err
}

// DeleteFriendship removes both rows (unfriend, decline or cancel).
func (s *Store) DeleteFriendship(ctx context.Context, a, b string) error {
	table := aws.String(s.cfg.FriendshipsTable)
	_, err := s.db.TransactWriteItems(ctx, &dynamodb.TransactWriteItemsInput{
		TransactItems: []types.TransactWriteItem{
			{Delete: &types.Delete{TableName: table, Key: friendKey(a, b)}},
			{Delete: &types.Delete{TableName: table, Key: friendKey(b, a)}},
		},
	})
	return err
}

// ---------------------------------------------------------- connections

// connectionTTL bounds how long a stale row survives if $disconnect is missed.
// API Gateway WebSocket connections last at most 2 hours.
const connectionTTL = 3 * time.Hour

func (s *Store) PutConnection(ctx context.Context, connectionID, userID string, version ...int) error {
	v := 0
	if len(version) > 0 {
		v = version[0]
	}
	item, err := attributevalue.MarshalMap(models.Connection{
		SessionVersion: v,
		ConnectionID:   connectionID,
		UserID:         userID,
		ExpiresAt:      time.Now().Add(connectionTTL).Unix(),
	})
	if err != nil {
		return err
	}
	_, err = s.db.PutItem(ctx, &dynamodb.PutItemInput{TableName: aws.String(s.cfg.ConnectionsTable), Item: item})
	return err
}

func (s *Store) GetConnection(ctx context.Context, connectionID string) (*models.Connection, error) {
	out, err := s.db.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(s.cfg.ConnectionsTable),
		Key:       map[string]types.AttributeValue{"connection_id": &types.AttributeValueMemberS{Value: connectionID}},
	})
	if err != nil || out.Item == nil {
		return nil, err
	}
	var c models.Connection
	if err := attributevalue.UnmarshalMap(out.Item, &c); err != nil {
		return nil, err
	}
	if c.ExpiresAt <= time.Now().Unix() {
		return nil, nil
	}
	return &c, nil
}

func (s *Store) DeleteConnection(ctx context.Context, connectionID string) error {
	_, err := s.db.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(s.cfg.ConnectionsTable),
		Key:       map[string]types.AttributeValue{"connection_id": &types.AttributeValueMemberS{Value: connectionID}},
	})
	return err
}

// ConnectionIDsByUser returns the user's live (non-expired) connection ids.
func (s *Store) ConnectionIDsByUser(ctx context.Context, userID string) ([]string, error) {
	var ids []string
	var startKey map[string]types.AttributeValue
	now := time.Now().Unix()
	for {
		out, err := s.db.Query(ctx, &dynamodb.QueryInput{
			TableName:                 aws.String(s.cfg.ConnectionsTable),
			IndexName:                 aws.String("by_user"),
			KeyConditionExpression:    aws.String("user_id = :u"),
			ExpressionAttributeValues: map[string]types.AttributeValue{":u": &types.AttributeValueMemberS{Value: userID}},
			ExclusiveStartKey:         startKey,
		})
		if err != nil {
			return nil, err
		}
		var page []models.Connection
		if err := attributevalue.UnmarshalListOfMaps(out.Items, &page); err != nil {
			return nil, err
		}
		for _, c := range page {
			if c.ExpiresAt > now {
				ids = append(ids, c.ConnectionID)
			}
		}
		if out.LastEvaluatedKey == nil {
			return ids, nil
		}
		startKey = out.LastEvaluatedKey
	}
}
