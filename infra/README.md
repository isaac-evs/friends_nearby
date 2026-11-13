# Friends Nearby – infrastructure (Terraform)

Clients → API Gateway (WebSocket + HTTP) → Lambda → ElastiCache Redis / DynamoDB → SQS → worker Lambda → S3; profile photos served via CloudFront.

| File | Contents |
|---|---|
| `network.tf` | VPC, private subnets, SGs, VPC endpoints (no NAT) |
| `apigateway.tf` | HTTP API + WebSocket API |
| `lambda.tf` | Main API Lambda (in VPC) and SQS worker Lambda |
| `elasticache.tf` | Redis (locations, pub/sub) |
| `dynamodb.tf` | users, friendships, websocket connections (on-demand) |
| `sqs.tf` | Events queue + DLQ |
| `s3.tf` / `cloudfront.tf` | media + history buckets, CDN for media |

## Use
```sh
cd infra
terraform init
terraform plan
terraform apply
```
Lambda code in `lambda_src/` is placeholder. State is local; add an S3 backend before sharing.
