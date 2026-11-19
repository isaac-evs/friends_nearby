package store

import (
	"context"
	"errors"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/isaac-evs/friends_nearby/backend/internal/models"
	"strconv"
)

type AccountChange struct{ Before, After *models.User }

func (s *Store) accountWrites(change AccountChange) ([]types.TransactWriteItem, error) {
	a, b := change.Before, change.After
	table := aws.String(s.cfg.UsersTable)
	writes := []types.TransactWriteItem{}
	names := map[string]string{"#name": "display_name", "#username": "username", "#ghost": "ghost_mode", "#version": "session_version"}
	vals := map[string]types.AttributeValue{":name": &types.AttributeValueMemberS{Value: b.DisplayName}, ":username": &types.AttributeValueMemberS{Value: b.Username}, ":ghost": &types.AttributeValueMemberBOOL{Value: b.GhostMode}, ":oldname": &types.AttributeValueMemberS{Value: a.DisplayName}, ":oldusername": &types.AttributeValueMemberS{Value: a.Username}, ":oldghost": &types.AttributeValueMemberBOOL{Value: a.GhostMode}, ":version": &types.AttributeValueMemberN{Value: strconv.Itoa(a.SessionVersion)}}
	condition := "#name = :oldname AND #username = :oldusername AND #ghost = :oldghost AND #version = :version"
	if a.SessionVersion == 0 {
		condition = "#name = :oldname AND #username = :oldusername AND #ghost = :oldghost AND (attribute_not_exists(#version) OR #version = :version)"
	}
	writes = append(writes, types.TransactWriteItem{Update: &types.Update{TableName: table, Key: map[string]types.AttributeValue{"user_id": &types.AttributeValueMemberS{Value: a.UserID}}, UpdateExpression: aws.String("SET #name = :name, #username = :username, #ghost = :ghost"), ConditionExpression: aws.String(condition), ExpressionAttributeNames: names, ExpressionAttributeValues: vals}})
	if a.Username != b.Username {
		writes = append(writes, types.TransactWriteItem{Put: &types.Put{TableName: table, Item: map[string]types.AttributeValue{"user_id": &types.AttributeValueMemberS{Value: usernamePrefix + b.Username}, "ref_id": &types.AttributeValueMemberS{Value: a.UserID}}, ConditionExpression: aws.String("attribute_not_exists(user_id)")}})
		writes = append(writes, types.TransactWriteItem{Delete: &types.Delete{TableName: table, Key: map[string]types.AttributeValue{"user_id": &types.AttributeValueMemberS{Value: usernamePrefix + a.Username}}, ConditionExpression: aws.String("ref_id = :id"), ExpressionAttributeValues: map[string]types.AttributeValue{":id": &types.AttributeValueMemberS{Value: a.UserID}}}})
	}
	return writes, nil
}

func (s *Store) UpdateUsername(ctx context.Context, id, name string) error {
	u, e := s.GetUser(ctx, id)
	if e != nil {
		return e
	}
	if u == nil {
		return errors.New("user not found")
	}
	if u.Username == name {
		return nil
	}
	markerKey := func(value string) map[string]types.AttributeValue {
		return map[string]types.AttributeValue{"user_id": &types.AttributeValueMemberS{Value: usernamePrefix + value}}
	}
	item := markerKey(name)
	item["ref_id"] = &types.AttributeValueMemberS{Value: id}
	table := aws.String(s.cfg.UsersTable)
	_, e = s.db.TransactWriteItems(ctx, &dynamodb.TransactWriteItemsInput{TransactItems: []types.TransactWriteItem{
		{Put: &types.Put{TableName: table, Item: item, ConditionExpression: aws.String("attribute_not_exists(user_id)")}},
		{Delete: &types.Delete{TableName: table, Key: markerKey(u.Username), ConditionExpression: aws.String("ref_id = :id"), ExpressionAttributeValues: map[string]types.AttributeValue{":id": &types.AttributeValueMemberS{Value: id}}}},
		{Update: &types.Update{TableName: table, Key: map[string]types.AttributeValue{"user_id": &types.AttributeValueMemberS{Value: id}}, UpdateExpression: aws.String("SET username = :new"), ConditionExpression: aws.String("username = :old"), ExpressionAttributeValues: map[string]types.AttributeValue{":new": &types.AttributeValueMemberS{Value: name}, ":old": &types.AttributeValueMemberS{Value: u.Username}}}},
	}})
	var canceled *types.TransactionCanceledException
	if errors.As(e, &canceled) {
		return ErrUsernameTaken
	}
	return e
}
func (s *Store) ChangePassword(ctx context.Context, id, oldHash, newHash string) (int, error) {
	out, e := s.db.UpdateItem(ctx, &dynamodb.UpdateItemInput{TableName: aws.String(s.cfg.UsersTable), Key: map[string]types.AttributeValue{"user_id": &types.AttributeValueMemberS{Value: id}}, UpdateExpression: aws.String("SET password_hash = :new ADD session_version :one"), ConditionExpression: aws.String("password_hash = :old"), ExpressionAttributeValues: map[string]types.AttributeValue{":new": &types.AttributeValueMemberS{Value: newHash}, ":old": &types.AttributeValueMemberS{Value: oldHash}, ":one": &types.AttributeValueMemberN{Value: "1"}}, ReturnValues: types.ReturnValueAllNew})
	if e != nil {
		return 0, e
	}
	_ = out
	u, e := s.GetUser(ctx, id)
	if e != nil {
		return 0, e
	}
	return u.SessionVersion, nil
}

// DeleteAccount borra la identidad: el usuario y sus marcadores de correo y usuario (en una transacción, así ya no se puede
// entrar), sus amistades, sus conexiones y todo lo que hay bajo `user#<id>` (perfil social, invitaciones, encuentros).
func (s *Store) DeleteAccount(ctx context.Context, u *models.User) error {
	table := aws.String(s.cfg.UsersTable)
	key := func(k string) map[string]types.AttributeValue {
		return map[string]types.AttributeValue{"user_id": &types.AttributeValueMemberS{Value: k}}
	}
	if _, e := s.db.TransactWriteItems(ctx, &dynamodb.TransactWriteItemsInput{TransactItems: []types.TransactWriteItem{
		{Delete: &types.Delete{TableName: table, Key: key(u.UserID), ConditionExpression: aws.String("attribute_exists(user_id)")}},
		{Delete: &types.Delete{TableName: table, Key: key(emailPrefix + NormalizeEmail(u.Email))}},
		{Delete: &types.Delete{TableName: table, Key: key(usernamePrefix + NormalizeUsername(u.Username))}},
	}}); e != nil {
		return e
	}
	friends, e := s.ListFriendships(ctx, u.UserID)
	if e != nil {
		return e
	}
	for _, f := range friends {
		if e = s.DeleteFriendship(ctx, u.UserID, f.FriendID); e != nil {
			return e
		}
	}
	conns, e := s.ConnectionIDsByUser(ctx, u.UserID)
	if e != nil {
		return e
	}
	for _, c := range conns {
		if e = s.DeleteConnection(ctx, c); e != nil {
			return e
		}
	}
	docs, e := s.ListDocuments(ctx, "user#"+u.UserID)
	if e != nil {
		return e
	}
	for _, d := range docs {
		if _, e = s.db.DeleteItem(ctx, &dynamodb.DeleteItemInput{TableName: aws.String(s.SocialTable()), Key: docKey(d.PK, d.SK)}); e != nil {
			return e
		}
	}
	return nil
}
