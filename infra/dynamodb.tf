resource "aws_dynamodb_table" "users" {
  name         = "${local.name}-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"
  attribute {
    name = "user_id"
    type = "S"
  }
  point_in_time_recovery { enabled = true }
  server_side_encryption { enabled = true }
}

# Friend relationships (profile + preferences live on the users item)
resource "aws_dynamodb_table" "friendships" {
  name         = "${local.name}-friendships"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"
  range_key    = "friend_id"
  attribute {
    name = "user_id"
    type = "S"
  }
  attribute {
    name = "friend_id"
    type = "S"
  }
  global_secondary_index {
    name            = "reverse"
    hash_key        = "friend_id"
    range_key       = "user_id"
    projection_type = "ALL"
  }
  point_in_time_recovery { enabled = true }
  server_side_encryption { enabled = true }
}

# WebSocket connection tracking (auto-expires)
resource "aws_dynamodb_table" "connections" {
  name         = "${local.name}-connections"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "connection_id"
  attribute {
    name = "connection_id"
    type = "S"
  }
  attribute {
    name = "user_id"
    type = "S"
  }
  global_secondary_index {
    name            = "by_user"
    hash_key        = "user_id"
    projection_type = "ALL"
  }
  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }
}
