# Go binaries are built by scripts/build-lambdas.sh into <infra>/.build/*.zip
# (each zip holds a single executable named "bootstrap").
locals {
  api_zip    = "${path.root}/.build/api.zip"
  worker_zip = "${path.root}/.build/worker.zip"
}

# Signing key for the backend's own JWTs (HS256). Note: it is stored in the
# Terraform state, so keep the state private/encrypted.
resource "random_password" "jwt_secret" {
  length  = 48
  special = false
}

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# ---- Main API Lambda (auth, users, location, friends, notifications, history)
resource "aws_iam_role" "api" {
  name               = "${var.name}-api"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

resource "aws_iam_role_policy_attachment" "api_vpc" {
  role       = aws_iam_role.api.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

data "aws_iam_policy_document" "api" {
  statement {
    actions = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:BatchGetItem", "dynamodb:BatchWriteItem"]
    resources = [
      var.users_table_arn,
      var.friendships_table_arn, "${var.friendships_table_arn}/index/*",
      var.connections_table_arn, "${var.connections_table_arn}/index/*",
    ]
  }
  statement {
    actions   = ["sqs:SendMessage"]
    resources = [var.queue_arn]
  }
  statement {
    actions   = ["s3:PutObject", "s3:GetObject"]
    resources = ["${var.media_bucket_arn}/*"]
  }
  statement {
    actions   = ["execute-api:ManageConnections"]
    resources = ["${var.ws_execution_arn}/*"]
  }
}

resource "aws_iam_role_policy" "api" {
  role   = aws_iam_role.api.id
  policy = data.aws_iam_policy_document.api.json
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${var.name}-api"
  retention_in_days = 14
}

resource "aws_lambda_function" "api" {
  function_name    = "${var.name}-api"
  role             = aws_iam_role.api.arn
  runtime          = "provided.al2023"
  handler          = "bootstrap"
  architectures    = ["x86_64"]
  filename         = local.api_zip
  source_code_hash = filebase64sha256(local.api_zip)
  memory_size      = var.memory_size
  timeout          = 15

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.security_group_id]
  }

  environment {
    variables = {
      USERS_TABLE          = var.users_table_name
      FRIENDSHIPS_TABLE    = var.friendships_table_name
      CONNECTIONS_TABLE    = var.connections_table_name
      REDIS_HOST           = var.redis_endpoint
      REDIS_PORT           = "6379"
      REDIS_TLS            = "true"
      LOCATION_TTL_SECONDS = tostring(var.location_ttl_seconds)
      EVENTS_QUEUE_URL     = var.queue_url
      MEDIA_BUCKET         = var.media_bucket_id
      CDN_DOMAIN           = var.cdn_domain
      WS_MANAGEMENT_URL    = var.ws_management_url
      JWT_SECRET           = random_password.jwt_secret.result
      JWT_TTL_HOURS        = tostring(var.jwt_ttl_hours)
    }
  }
  depends_on = [aws_cloudwatch_log_group.api, aws_iam_role_policy_attachment.api_vpc]
}

# ---- Worker Lambda (SQS -> S3 history batches)
resource "aws_iam_role" "worker" {
  name               = "${var.name}-worker"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

resource "aws_iam_role_policy_attachment" "worker_logs" {
  role       = aws_iam_role.worker.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "worker" {
  statement {
    actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
    resources = [var.queue_arn]
  }
  statement {
    actions   = ["s3:PutObject"]
    resources = ["${var.history_bucket_arn}/*"]
  }
}

resource "aws_iam_role_policy" "worker" {
  role   = aws_iam_role.worker.id
  policy = data.aws_iam_policy_document.worker.json
}

# Not in the VPC: only needs SQS + S3
resource "aws_lambda_function" "worker" {
  function_name    = "${var.name}-worker"
  role             = aws_iam_role.worker.arn
  runtime          = "provided.al2023"
  handler          = "bootstrap"
  architectures    = ["x86_64"]
  filename         = local.worker_zip
  source_code_hash = filebase64sha256(local.worker_zip)
  memory_size      = var.memory_size
  timeout          = 60

  environment {
    variables = { HISTORY_BUCKET = var.history_bucket_id }
  }
}

resource "aws_lambda_event_source_mapping" "worker" {
  event_source_arn                   = var.queue_arn
  function_name                      = aws_lambda_function.worker.arn
  batch_size                         = 100
  maximum_batching_window_in_seconds = 30
  function_response_types            = ["ReportBatchItemFailures"]
}
