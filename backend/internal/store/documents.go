package store

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

// Document is a versioned social entity. Transactions use optimistic concurrency
// so concurrent joins, confirmations and rewards cannot overwrite one another.
type Document struct {
	PK, SK    string
	Version   int
	Data      json.RawMessage
	ExpiresAt int64
}

var ErrConflict = errors.New("state changed; retry the request")

// IsBlocked checks both directions; a client-side filter is never sufficient.
func (s *Store) IsBlocked(ctx context.Context, a, b string) (bool, error) {
	for _, pair := range [][2]string{{a, b}, {b, a}} {
		d, err := s.GetDocument(ctx, "user#"+pair[0], "profile")
		if err != nil {
			return false, err
		}
		var p struct {
			Blocks []string `json:"blocks"`
		}
		if len(d.Data) > 0 {
			if err = json.Unmarshal(d.Data, &p); err != nil {
				return false, err
			}
		}
		for _, id := range p.Blocks {
			if id == pair[1] {
				return true, nil
			}
		}
	}
	return false, nil
}

func (s *Store) SocialTable() string {
	if s.cfg.SocialTable != "" {
		return s.cfg.SocialTable
	}
	return s.cfg.UsersTable + "-social"
}

// ResetPassword consumes the token and changes the password in one transaction.
func (s *Store) ResetPassword(ctx context.Context, d Document, id, hash string) error {
	var payload map[string]any
	if err := json.Unmarshal(d.Data, &payload); err != nil {
		return err
	}
	payload["used"] = true
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	item := docKey(d.PK, d.SK)
	item["data"] = &types.AttributeValueMemberS{Value: string(b)}
	item["version"] = &types.AttributeValueMemberN{Value: strconv.Itoa(d.Version + 1)}
	_, err = s.db.TransactWriteItems(ctx, &dynamodb.TransactWriteItemsInput{TransactItems: []types.TransactWriteItem{
		{Put: &types.Put{TableName: aws.String(s.SocialTable()), Item: item, ConditionExpression: aws.String("version = :v"), ExpressionAttributeValues: map[string]types.AttributeValue{":v": &types.AttributeValueMemberN{Value: strconv.Itoa(d.Version)}}}},
		{Update: &types.Update{TableName: aws.String(s.cfg.UsersTable), Key: map[string]types.AttributeValue{"user_id": &types.AttributeValueMemberS{Value: id}}, UpdateExpression: aws.String("SET password_hash = :h ADD session_version :one"), ConditionExpression: aws.String("attribute_exists(user_id)"), ExpressionAttributeValues: map[string]types.AttributeValue{":h": &types.AttributeValueMemberS{Value: hash}, ":one": &types.AttributeValueMemberN{Value: "1"}}}},
	}})
	var canceled *types.TransactionCanceledException
	if errors.As(err, &canceled) {
		return ErrConflict
	}
	return err
}
func docKey(pk, sk string) map[string]types.AttributeValue {
	return map[string]types.AttributeValue{"pk": &types.AttributeValueMemberS{Value: pk}, "sk": &types.AttributeValueMemberS{Value: sk}}
}
func readDoc(item map[string]types.AttributeValue) Document {
	str := func(k string) string {
		if v, ok := item[k].(*types.AttributeValueMemberS); ok {
			return v.Value
		}
		return ""
	}
	v := 0
	if n, ok := item["version"].(*types.AttributeValueMemberN); ok {
		v, _ = strconv.Atoi(n.Value)
	}
	return Document{PK: str("pk"), SK: str("sk"), Version: v, Data: json.RawMessage(str("data"))}
}
func (s *Store) GetDocument(ctx context.Context, pk, sk string) (Document, error) {
	out, err := s.db.GetItem(ctx, &dynamodb.GetItemInput{TableName: aws.String(s.SocialTable()), Key: docKey(pk, sk), ConsistentRead: aws.Bool(true)})
	if err != nil {
		return Document{}, err
	}
	if len(out.Item) == 0 {
		return Document{PK: pk, SK: sk}, nil
	}
	return readDoc(out.Item), nil
}

func (s *Store) GetDocuments(ctx context.Context, keys []Document) ([]Document, error) {
	result := []Document{}
	for start := 0; start < len(keys); start += 100 {
		end := min(start+100, len(keys))
		batch := []map[string]types.AttributeValue{}
		for _, d := range keys[start:end] {
			batch = append(batch, docKey(d.PK, d.SK))
		}
		req := map[string]types.KeysAndAttributes{s.SocialTable(): {Keys: batch, ConsistentRead: aws.Bool(true)}}
		for len(req) > 0 {
			out, err := s.db.BatchGetItem(ctx, &dynamodb.BatchGetItemInput{RequestItems: req})
			if err != nil {
				return nil, err
			}
			for _, item := range out.Responses[s.SocialTable()] {
				result = append(result, readDoc(item))
			}
			req = out.UnprocessedKeys
		}
	}
	return result, nil
}
func (s *Store) ListDocuments(ctx context.Context, pk string) ([]Document, error) {
	result := []Document{}
	var key map[string]types.AttributeValue
	for {
		out, err := s.db.Query(ctx, &dynamodb.QueryInput{TableName: aws.String(s.SocialTable()), KeyConditionExpression: aws.String("pk = :p"), ExpressionAttributeValues: map[string]types.AttributeValue{":p": &types.AttributeValueMemberS{Value: pk}}, ExclusiveStartKey: key, ConsistentRead: aws.Bool(true)})
		if err != nil {
			return nil, err
		}
		for _, item := range out.Items {
			result = append(result, readDoc(item))
		}
		key = out.LastEvaluatedKey
		if len(key) == 0 {
			return result, nil
		}
	}
}
func (s *Store) CommitDocuments(ctx context.Context, docs []Document) error {
	return s.CommitDocumentsChecked(ctx, docs, nil)
}
func (s *Store) CommitDocumentsChecked(ctx context.Context, docs, checks []Document) error {
	return s.CommitDocumentsAndAccounts(ctx, docs, checks, nil)
}
func (s *Store) CommitDocumentsAndAccounts(ctx context.Context, docs, checks []Document, accounts []AccountChange) error {
	if len(docs) == 0 {
		return nil
	}
	items := make([]types.TransactWriteItem, 0, len(docs))
	for _, d := range docs {
		item := docKey(d.PK, d.SK)
		item["data"] = &types.AttributeValueMemberS{Value: string(d.Data)}
		item["version"] = &types.AttributeValueMemberN{Value: strconv.Itoa(d.Version + 1)}
		if d.ExpiresAt > 0 {
			item["expires_at"] = &types.AttributeValueMemberN{Value: strconv.FormatInt(d.ExpiresAt, 10)}
		}
		cond := "attribute_not_exists(pk)"
		var vals map[string]types.AttributeValue
		if d.Version > 0 {
			cond = "version = :v"
			vals = map[string]types.AttributeValue{":v": &types.AttributeValueMemberN{Value: strconv.Itoa(d.Version)}}
		}
		items = append(items, types.TransactWriteItem{Put: &types.Put{TableName: aws.String(s.SocialTable()), Item: item, ConditionExpression: aws.String(cond), ExpressionAttributeValues: vals}})
	}
	for _, d := range checks {
		cond := "attribute_not_exists(pk)"
		var vals map[string]types.AttributeValue
		if d.Version > 0 {
			cond = "version = :v"
			vals = map[string]types.AttributeValue{":v": &types.AttributeValueMemberN{Value: strconv.Itoa(d.Version)}}
		}
		items = append(items, types.TransactWriteItem{ConditionCheck: &types.ConditionCheck{TableName: aws.String(s.SocialTable()), Key: docKey(d.PK, d.SK), ConditionExpression: aws.String(cond), ExpressionAttributeValues: vals}})
	}
	nameConditions := map[int]bool{}
	for _, change := range accounts {
		extra, err := s.accountWrites(change)
		if err != nil {
			return err
		}
		for i, x := range extra {
			if x.Put != nil {
				nameConditions[len(items)+i] = true
			}
		}
		items = append(items, extra...)
	}
	if len(items) > 100 {
		return errors.New("transaction exceeds 100 related records")
	}
	_, err := s.db.TransactWriteItems(ctx, &dynamodb.TransactWriteItemsInput{TransactItems: items})
	var canceled *types.TransactionCanceledException
	if errors.As(err, &canceled) {
		for i, r := range canceled.CancellationReasons {
			if aws.ToString(r.Code) == "ConditionalCheckFailed" {
				if nameConditions[i] {
					return ErrUsernameTaken
				}
				return ErrConflict
			}
		}
	}
	return err
}
