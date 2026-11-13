output "users_table_name" { value = aws_dynamodb_table.users.name }
output "users_table_arn" { value = aws_dynamodb_table.users.arn }
output "friendships_table_name" { value = aws_dynamodb_table.friendships.name }
output "friendships_table_arn" { value = aws_dynamodb_table.friendships.arn }
output "connections_table_name" { value = aws_dynamodb_table.connections.name }
output "connections_table_arn" { value = aws_dynamodb_table.connections.arn }
