resource "aws_sqs_queue" "dlq" {
  name                      = "${local.name}-events-dlq"
  message_retention_seconds = 1209600
}

# Location events, notifications, background work
resource "aws_sqs_queue" "events" {
  name                       = "${local.name}-events"
  visibility_timeout_seconds = 60
  receive_wait_time_seconds  = 10
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 5
  })
}
