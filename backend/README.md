# Friends Nearby – Backend (Go)

Two Lambdas, matching `infra/`:

| Binary | Purpose |
|---|---|
| `cmd/api` | One function behind both API Gateways (HTTP API v2 and WebSocket). It tells them apart from the event. |
| `cmd/worker` | SQS consumer. Writes each batch of location events to the history bucket as one `.jsonl` object. |
| `cmd/local` | Local runner: the same handlers behind `http://localhost:8080` and `ws://localhost:8080/ws`. |

```
backend/
├── cmd/{api,worker,local}
├── internal/
│   ├── api/          Lambda entry point: HTTP routes and WebSocket routes
│   ├── app/          Business logic: ghost mode, enter/leave detection, notifications
│   ├── auth/         bcrypt + JWT (HS256, verified offline)
│   ├── store/        DynamoDB access (users, friendships, connections)
│   ├── location/     Redis: live locations, "near" sets, haversine
│   ├── ports/        Interfaces that differ between AWS and local (push, queue, S3)
│   ├── awsadapters/  Real API Gateway / SQS / S3 implementations
│   ├── worker/       History batching
│   ├── config/       Environment variables
│   └── models/
└── docs/INFRA_REQUESTS.md   Terraform changes to hand to the infra owner
```

## Run locally

Requirements: Go 1.23+ and Docker.

```powershell
cd backend
docker compose up -d          # DynamoDB Local (8000) + Redis (6379)
go run ./cmd/local            # creates the tables if missing, serves :8080
```

Local defaults live in `cmd/local/main.go` (`setDefaults`); any variable you set
yourself wins. History batches are written to `backend/.local/history/` every 5 s.
DynamoDB Local runs `-inMemory`, so data resets when its container restarts.

Presigned photo URLs are generated locally but point at the real S3 host, so the
upload itself will not work offline.

### Quick try (PowerShell)

```powershell
$api = "http://localhost:8080"
$a = Invoke-RestMethod "$api/auth/register" -Method Post -ContentType application/json `
  -Body '{"email":"ana@example.com","username":"ana","password":"password123"}'
$b = Invoke-RestMethod "$api/auth/register" -Method Post -ContentType application/json `
  -Body '{"email":"bob@example.com","username":"bob","password":"password123"}'
$ha = @{ authorization = "Bearer $($a.token)" }; $hb = @{ authorization = "Bearer $($b.token)" }

Invoke-RestMethod "$api/friends/requests" -Method Post -Headers $ha -ContentType application/json -Body '{"username":"bob"}'
Invoke-RestMethod "$api/friends/$($a.user.user_id)/accept" -Method Post -Headers $hb
```

Then open two WebSocket clients (for example `npx wscat -c "ws://localhost:8080/ws?token=<jwt>"`)
and send `{"action":"location","lat":19.4326,"lng":-99.1332}` from both. Each
should receive a `friend_enter` message once they are within each other's radius.

## Tests

```powershell
docker compose up -d     # integration tests need DynamoDB Local and Redis
go test ./...
```

- `auth`, `location` (distance) and `worker` tests need nothing external.
- `api`, `app` and `store` tests run against DynamoDB Local and Redis, each with its
  own temporary tables. They are **skipped** (not failed) when Docker is not running.
- `go run ./cmd/local` in one terminal and `go run ./scripts/smoke` in another runs an
  end-to-end scenario over real HTTP and WebSocket connections.
- `SDK ... WARN ... did not match expected checksum` lines in the output come from
  DynamoDB Local and are harmless.

## HTTP API

Everything except register and login needs `Authorization: Bearer <token>`.
Bodies are JSON.

| Method | Path | Body / query | Notes |
|---|---|---|---|
| POST | `/auth/register` | `email`, `username`, `password`, `display_name?` | Returns `{token, user}`. Username: 3-20 chars of `a-z 0-9 _`. Password: 8-72 bytes. |
| POST | `/auth/login` | `email`, `password` | Returns `{token, user}`. |
| GET | `/me` | | Own profile. |
| PATCH | `/me` | any of `display_name`, `radius_m`, `ghost_mode`, `photo_key` | `radius_m` 100-5000 (default 500). Turning `ghost_mode` on removes you from friends' views immediately. |
| POST | `/me/photo-upload-url` | `content_type` (`image/jpeg`, `image/png`, `image/webp`) | Returns `{upload_url, key}`. `PUT` the file to `upload_url` with the same `Content-Type`, then `PATCH /me {"photo_key": key}`. |
| GET | `/users/search?username=bob` | | Exact match. 404 if none. |
| GET | `/friends` | | `{friends, incoming, outgoing}` |
| POST | `/friends/requests` | `username` | If that user already asked you, this accepts. |
| POST | `/friends/{user_id}/accept` | | |
| DELETE | `/friends/{user_id}` | | Unfriend, decline, or cancel. |
| GET | `/nearby` | | Friends currently inside your radius. |

Errors are `{"error": "message"}` with a matching status code.

## WebSocket API

Connect with `?token=<jwt>`. An invalid token refuses the handshake (401).

Client to server (`action` selects the route; unknown actions return an `error` message):

```json
{"action":"location","lat":19.4326,"lng":-99.1332}
{"action":"nearby"}
{"action":"ping"}
```

Server to client:

| `type` | When | Fields |
|---|---|---|
| `friend_enter` | A friend comes inside **your** radius | `friend`, `distance_m` |
| `friend_leave` | A friend leaves your radius, goes ghost, or is unfriended | `friend` |
| `nearby` | Reply to `{"action":"nearby"}` | `nearby[]` |
| `friend_request` | Someone sent you a request | `friend` |
| `friend_accepted` | Someone accepted your request | `friend` |
| `pong` / `error` | Replies | `error` |

`$connect` cannot send messages in API Gateway, so a client that just connected
should send `{"action":"nearby"}` to get the current state.

## How it works

- **Locations.** `loc:{user_id}` in Redis holds the last rounded cell with a TTL of
  `LOCATION_TTL_SECONDS` (default 120). Inactive users disappear on their own.
- **Nearby.** On each update the code loads the user's accepted, mutually close friends, reads
  their locations with one `MGET`, and computes haversine distances. Each user is
  judged against the smaller of viewer search radius and subject visibility radius.
- **Enter/leave.** `near:{viewer}` in Redis is the set of friends currently
  inside the viewer's radius. A message is sent only when a friend is added to or
  removed from that set.
- **Ghost mode.** While on, location updates are rejected, nothing is written to
  Redis, and no history events are sent. Turning it on deletes your location and
  sends `friend_leave` to friends who could see you.
- **History.** Every accepted rounded cell update is sent to SQS; the worker writes
  `history/YYYY/MM/DD/HH/<id>.jsonl` to the history bucket. It is write-only.
- **Friendships.** Two rows per pair (`pending_out`/`pending_in`, then `accepted`
  on both), written in a transaction.
- **Unique email/username.** Marker items in the users table, created in the
  same transaction as the user.

## Known limitations

- If a friend goes inactive (location expired) while still in someone's near set,
  the `friend_leave` is sent the next time one of them sends a location, not at the
  moment of expiry.
- Location updates are not rate limited in code; throttle at API Gateway or in the client.
- Presigned PUT URLs cannot enforce a maximum file size.
- Fan-out is sequential per update. That is fine for small friend lists; revisit if lists grow large.
- The social feed currently loads its projection with DynamoDB Query; large deployments need zone/date partitioning and a paginated client feed.

## Build for AWS

See `docs/INFRA_REQUESTS.md` for the exact commands and the Terraform changes needed.

## Integrated frontend

The React app in `../frontend/` now uses real authentication and persistent social
actions. Run this local backend and `npm run dev` from `frontend/`. The local runner
creates an additional social table with `pk`/`sk` keys and writes password reset
emails to `.local/mail/`. It does not emulate S3 photo uploads.

New endpoints: `GET /app/state`, `GET /app/user`, `POST /app/actions`,
`POST /auth/forgot`, and `POST /auth/reset`. See
[FRONTEND_INTEGRATION.md](docs/FRONTEND_INTEGRATION.md) for actions and authorization
rules, and [INFRA_REQUESTS.md](docs/INFRA_REQUESTS.md) for the social table and SES
requirements. No Terraform files were changed.

Nearby responses now round coordinates to 0.002 degrees. Exact positions are
available only through explicit temporary grants between mutual close friends. Password reset
revokes earlier JWTs and WebSocket actions via `session_version`.
