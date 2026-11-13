# Friends Nearby – Infrastructure

Terraform for the Friends Nearby AWS backend: clients talk to API Gateway (WebSocket for real-time location, HTTP for REST), which invokes Lambda. Lambda reads/writes Redis and DynamoDB and enqueues events to SQS; a worker Lambda batches history into S3; profile photos are served through CloudFront.

## Architecture

The same diagram lives in [`docs/architecture.mmd`](docs/architecture.mmd).

```mermaid
graph LR
    subgraph Clients["Clients"]
        Mobile["Mobile App"]
        Web["Web App"]
    end
    style Clients fill:#f2f0f9,stroke:#856404,stroke-width:1px;

    subgraph APIGateways["API Gateways"]
        API_WS["Amazon API Gateway<br>(WebSocket)"]
        API_HTTP["Amazon API Gateway<br>(HTTP API)"]
    end
    style APIGateways fill:#fbe6ec,stroke:#856404,stroke-width:1px;

    subgraph Logic["Logic & Processing"]
        Lambda_Main["AWS Lambda (Functions)<br><hr>• Authentication<br>• User Management<br>• Location Processing<br>• Friends Logic<br>• Notifications<br>• Save History"]
    end
    style Logic fill:#fef3e5,stroke:#b15c00,stroke-width:1px;

    subgraph RealTime["Real-time (Cache & Pub/Sub)"]
        Redis["Amazon ElastiCache (Redis)<br><hr>• Real-time locations<br>• User Pub/Sub<br>• TTL for inactive users"]
    end
    style RealTime fill:#effaf2,stroke:#2b6f39,stroke-width:1px,stroke-dasharray: 5 5;

    subgraph UserData["User Data"]
        Dynamo["Amazon DynamoDB (On-Demand)<br><hr>• User profiles<br>• Preferences<br>• Friend relationships"]
    end
    style UserData fill:#eaf4fc,stroke:#1a6aa2,stroke-width:1px,stroke-dasharray: 5 5;

    subgraph Async["Asynchronous Processing"]
        SQS["Amazon SQS<br><hr>• Location events<br>• Notifications<br>• Background processing"]
    end
    style Async fill:#fdf8e2,stroke:#cca01a,stroke-width:1px,stroke-dasharray: 5 5;

    subgraph Workers["Background Workers"]
        Lambda_Workers["AWS Lambda (Workers)<br><hr>• Processes events<br>• Saves history to S3"]
    end
    style Workers fill:#fef3e5,stroke:#b15c00,stroke-width:1px;

    subgraph Storage["Object Storage"]
        S3["Amazon S3<br><hr>• Profile photos<br>• Location history (in batches)"]
    end
    style Storage fill:#eaf4fc,stroke:#1a6aa2,stroke-width:1px,stroke-dasharray: 5 5;

    subgraph ContentDelivery["Content Delivery"]
        CloudFront["Amazon CloudFront (CDN)<br><hr>• Delivery of static images"]
    end
    style ContentDelivery fill:#f2f0f9,stroke:#4b2c85,stroke-width:1px,stroke-dasharray: 5 5;

    Mobile -->|"WebSocket<br>(real-time location)"| API_WS
    Web -->|"HTTPS<br>(REST API)"| API_HTTP

    API_WS --> Lambda_Main
    API_HTTP --> Lambda_Main

    Lambda_Main <-->|"Read/write updates"| Redis
    Lambda_Main <-->|"Query/update"| Dynamo

    Lambda_Main --> SQS
    SQS --> Lambda_Workers
    Lambda_Workers --> S3

    CloudFront --> S3
    CloudFront ==>|"Profile pictures<br>(via CDN)"| Clients

    classDef pink fill:#fbe6ec,stroke:#b82a5c,stroke-width:2px;
    classDef orange fill:#fef3e5,stroke:#c86d00,stroke-width:2px;
    classDef purple fill:#f2f0f9,stroke:#6f42c1,stroke-width:2px;
    classDef green fill:#effaf2,stroke:#1e7e34,stroke-width:2px;
    classDef blue fill:#eaf4fc,stroke:#0056b3,stroke-width:2px;
    classDef yellow fill:#fdf8e2,stroke:#d39e00,stroke-width:2px;

    class API_WS,API_HTTP pink;
    class Lambda_Main,Lambda_Workers orange;
    class Mobile,Web,CloudFront purple;
    class Redis green;
    class Dynamo,S3 blue;
    class SQS yellow;
```

## Layout

```
infra/
├── main.tf            # wires the modules together
├── variables.tf       # region, project, environment, sizing
├── outputs.tf         # API URLs, CDN domain, bucket/queue names
├── versions.tf        # terraform + provider versions
├── src/               # Lambda source (placeholders)
│   ├── api.mjs
│   └── worker.mjs
├── docs/
│   └── architecture.mmd
└── modules/
    ├── network/       # VPC, private subnets, security groups, VPC endpoints (no NAT)
    ├── api/           # HTTP API + WebSocket API (routes, stages, throttling)
    ├── compute/       # Main API Lambda (in VPC) + SQS worker Lambda, IAM
    ├── cache/         # ElastiCache Redis (locations, pub/sub)
    ├── database/      # DynamoDB: users, friendships, ws connections
    ├── messaging/     # SQS events queue + DLQ
    └── storage/       # S3 media + history buckets, CloudFront CDN
```

## Usage

```sh
cd infra
terraform init
terraform plan
terraform apply
```

Override defaults with a `terraform.tfvars` (git-ignored), e.g. `environment = "prod"`.

## Notes

- Lambda code in `src/` is placeholder; replace with real app code.
- Redis TTL for inactive users (`location_ttl_seconds`) is passed to Lambda as `LOCATION_TTL_SECONDS`; the app sets it on each location write.
- The main Lambda runs in the VPC; it reaches S3/DynamoDB via free gateway endpoints and SQS/execute-api via interface endpoints (these cost money while running).
- State is local. Add an S3 backend before sharing.
- CORS defaults to `*`; restrict `cors_origins` for production.
