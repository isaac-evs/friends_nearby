data "archive_file" "api" {
  type        = "zip"
  source_file = "${path.module}/lambda_src/api.mjs"
  output_path = "${path.module}/.build/api.zip"
}

data "archive_file" "worker" {
  type        = "zip"
  source_file = "${path.module}/lambda_src/worker.mjs"
  output_path = "${path.module}/.build/worker.zip"
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
  name               = "${local.name}-api"
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
      aws_dynamodb_table.users.arn,
      aws_dynamodb_table.friendships.arn, "${aws_dynamodb_table.friendships.arn}/index/*",
      aws_dynamodb_table.connections.arn, "${aws_dynamodb_table.connections.arn}/index/*",
    ]
  }
  statement {
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.events.arn]
  }
  statement {
    actions   = ["s3:PutObject", "s3:GetObject"]
    resources = ["${aws_s3_bucket.media.arn}/*"]
  }
  statement {
    actions   = ["execute-api:ManageConnections"]
    resources = ["${aws_apigatewayv2_api.ws.execution_arn}/*"]
  }
}

resource "aws_iam_role_policy" "api" {
  role   = aws_iam_role.api.id
  policy = data.aws_iam_policy_document.api.json
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${local.name}-api"
  retention_in_days = 14
}

resource "aws_lambda_function" "api" {
  function_name    = "${local.name}-api"
  role             = aws_iam_role.api.arn
  runtime          = "nodejs20.x"
  handler          = "api.handler"
  filename         = data.archive_file.api.output_path
  source_code_hash = data.archive_file.api.output_base64sha256
  memory_size      = var.lambda_memory
  timeout          = 15

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      USERS_TABLE          = aws_dynamodb_table.users.name
      FRIENDSHIPS_TABLE    = aws_dynamodb_table.friendships.name
      CONNECTIONS_TABLE    = aws_dynamodb_table.connections.name
      REDIS_HOST           = aws_elasticache_replication_group.redis.primary_endpoint_address
      REDIS_PORT           = "6379"
      REDIS_TLS            = "true"
      LOCATION_TTL_SECONDS = tostring(var.location_ttl_seconds)
      EVENTS_QUEUE_URL     = aws_sqs_queue.events.url
      MEDIA_BUCKET         = aws_s3_bucket.media.id
      CDN_DOMAIN           = aws_cloudfront_distribution.cdn.domain_name
      WS_MANAGEMENT_URL    = "https://${aws_apigatewayv2_api.ws.id}.execute-api.${var.region}.amazonaws.com/${aws_apigatewayv2_stage.ws.name}"
    }
  }
  depends_on = [aws_cloudwatch_log_group.api, aws_iam_role_policy_attachment.api_vpc]
}

# ---- Worker Lambda (SQS -> S3 history batches)
resource "aws_iam_role" "worker" {
  name               = "${local.name}-worker"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

resource "aws_iam_role_policy_attachment" "worker_logs" {
  role       = aws_iam_role.worker.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "worker" {
  statement {
    actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
    resources = [aws_sqs_queue.events.arn]
  }
  statement {
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.history.arn}/*"]
  }
}

resource "aws_iam_role_policy" "worker" {
  role   = aws_iam_role.worker.id
  policy = data.aws_iam_policy_document.worker.json
}

# Not in the VPC: only needs SQS + S3
resource "aws_lambda_function" "worker" {
  function_name    = "${local.name}-worker"
  role             = aws_iam_role.worker.arn
  runtime          = "nodejs20.x"
  handler          = "worker.handler"
  filename         = data.archive_file.worker.output_path
  source_code_hash = data.archive_file.worker.output_base64sha256
  memory_size      = var.lambda_memory
  timeout          = 60

  environment {
    variables = { HISTORY_BUCKET = aws_s3_bucket.history.id }
  }
}

resource "aws_lambda_event_source_mapping" "worker" {
  event_source_arn                   = aws_sqs_queue.events.arn
  function_name                      = aws_lambda_function.worker.arn
  batch_size                         = 100
  maximum_batching_window_in_seconds = 30
  function_response_types            = ["ReportBatchItemFailures"]
}
