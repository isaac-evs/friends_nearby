# Changes needed in `infra/` for the Go backend

For the person who owns the Terraform. Everything below is based on the current
`infra/modules/*` code. Nothing here has been applied or tested against AWS.

## Required

### 1. Switch both Lambdas to the Go runtime (`modules/compute/main.tf`)

Today both functions use `runtime = "nodejs20.x"` and zip `src/*.mjs`.

For `aws_lambda_function.api` and `aws_lambda_function.worker`:

- `runtime = "provided.al2023"`
- `handler = "bootstrap"`
- `architectures = ["x86_64"]` (this is already the default; the Go build below targets amd64)
- `filename` / `source_code_hash` should point to a zip that contains a single executable named `bootstrap`

The `archive_file` data sources must change from `source_file = src/api.mjs`
to the built binary. Example build (run from `backend/`, output goes where
Terraform expects it):

```sh
# api
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -tags lambda.norpc -o bootstrap ./cmd/api
# zip so the file inside is named exactly "bootstrap", e.g. .build/api.zip

# worker
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -tags lambda.norpc -o bootstrap ./cmd/worker
# zip as .build/worker.zip
```

The two zips must be built one after the other (both outputs are called
`bootstrap`). A small build script or Makefile target is the simplest way.
`infra/src/*.mjs` can be removed once this is in place.

### 2. New environment variable `JWT_SECRET` on the API Lambda

The backend signs and verifies its own JWTs (HS256) and needs a secret of at
least 32 random bytes.

- The Lambda has no internet access and the VPC only has endpoints for S3,
  DynamoDB, SQS and execute-api. Reading from Secrets Manager or SSM would need
  a new interface endpoint.
- Simplest option: generate the value with `random_password` in Terraform and
  pass it as `JWT_SECRET`. Note that it then lives in the Terraform state.

Optional: `JWT_TTL_HOURS` (default `168`, i.e. 7 days).

## Please verify (I could only read part of these modules)

| Item | Why it matters |
|---|---|
| `REDIS_HOST` is the **hostname only** (the primary endpoint address), with no `:6379` | The code joins host and `REDIS_PORT` itself. |
| ElastiCache has `transit_encryption_enabled = true` | `REDIS_TLS` is set to `"true"`, so the client connects with TLS. If in-transit encryption is off, connections fail. |
| `WS_MANAGEMENT_URL` has the form `https://<api-id>.execute-api.<region>.amazonaws.com/<stage>` | It is used as the base endpoint for `postToConnection`. |
| The WebSocket `$connect` route has **no authorizer** | The token is validated inside the Lambda from the `?token=` query parameter. |
| The media bucket CORS allows `PUT` and the `Content-Type` header from the client origins | Clients upload profile photos directly with presigned URLs. |
| CloudFront serves the bucket root | Photo URLs are built as `https://<CDN_DOMAIN>/photos/<user_id>/<file>`. |
| Lambda security group can reach Redis on 6379 | Already looks intended; confirm after changes. |

## Already sufficient (no change needed)

- **IAM on the API role.** The backend uses `GetItem`, `PutItem`, `UpdateItem`,
  `DeleteItem`, `Query`, `BatchGetItem` and transactions. DynamoDB transactions
  are authorized through the underlying Put/Update/Delete permissions, which are
  already granted. `sqs:SendMessage`, `s3:PutObject` (presigned uploads are
  signed with the Lambda role) and `execute-api:ManageConnections` are present.
  No `Scan` is used.
- **Tables and indexes.** No new indexes are required. Email and username lookups
  use small marker items stored in the existing `users` table (key
  `email#<email>` and `username#<name>`), written in the same transaction as the
  user. This also guarantees uniqueness, which a secondary index cannot.
- **`connections` TTL attribute** `expires_at` (epoch seconds) is what the code writes.
- **Worker.** Batch size, batching window, `ReportBatchItemFailures` and the DLQ
  already match what the worker does. It needs no VPC.
- **WebSocket routes.** `$connect`, `$disconnect`, `$default` and `location` are
  enough. The client actions `nearby` and `ping` arrive on `$default` and are
  dispatched by the code.

## Optional, later

- A GSI on username would only be needed for prefix or fuzzy search. The
  current search is an exact match on username.
- Throttling on the HTTP stage. The WebSocket stage already has one; location
  updates are not rate limited in code.
