package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	"github.com/isaac-evs/friends_nearby/backend/internal/config"
)

// EnsureTables creates the three tables with the same keys and indexes as
// infra/modules/database. It is meant for DynamoDB Local (the local runner and
// integration tests); in AWS, Terraform owns the tables. Existing tables are left alone.
func EnsureTables(ctx context.Context, db *dynamodb.Client, cfg *config.Config) error {
	s := func(name string) types.AttributeDefinition {
		return types.AttributeDefinition{AttributeName: aws.String(name), AttributeType: types.ScalarAttributeTypeS}
	}
	hash := func(name string) types.KeySchemaElement {
		return types.KeySchemaElement{AttributeName: aws.String(name), KeyType: types.KeyTypeHash}
	}
	rng := func(name string) types.KeySchemaElement {
		return types.KeySchemaElement{AttributeName: aws.String(name), KeyType: types.KeyTypeRange}
	}
	all := types.Projection{ProjectionType: types.ProjectionTypeAll}

	tables := []dynamodb.CreateTableInput{
		{
			TableName:            aws.String(New(db, cfg).SocialTable()),
			AttributeDefinitions: []types.AttributeDefinition{s("pk"), s("sk")},
			KeySchema:            []types.KeySchemaElement{hash("pk"), rng("sk")},
		},
		{
			TableName:            aws.String(cfg.UsersTable),
			AttributeDefinitions: []types.AttributeDefinition{s("user_id")},
			KeySchema:            []types.KeySchemaElement{hash("user_id")},
		},
		{
			TableName:            aws.String(cfg.FriendshipsTable),
			AttributeDefinitions: []types.AttributeDefinition{s("user_id"), s("friend_id")},
			KeySchema:            []types.KeySchemaElement{hash("user_id"), rng("friend_id")},
			GlobalSecondaryIndexes: []types.GlobalSecondaryIndex{{
				IndexName:  aws.String("reverse"),
				KeySchema:  []types.KeySchemaElement{hash("friend_id"), rng("user_id")},
				Projection: &all,
			}},
		},
		{
			TableName:            aws.String(cfg.ConnectionsTable),
			AttributeDefinitions: []types.AttributeDefinition{s("connection_id"), s("user_id")},
			KeySchema:            []types.KeySchemaElement{hash("connection_id")},
			GlobalSecondaryIndexes: []types.GlobalSecondaryIndex{{
				IndexName:  aws.String("by_user"),
				KeySchema:  []types.KeySchemaElement{hash("user_id")},
				Projection: &all,
			}},
		},
	}
	for _, t := range tables {
		t.BillingMode = types.BillingModePayPerRequest
		_, err := db.CreateTable(ctx, &t)
		var inUse *types.ResourceInUseException
		if err != nil && !errors.As(err, &inUse) {
			return fmt.Errorf("%s: %w", aws.ToString(t.TableName), err)
		}
	}
	return nil
}
