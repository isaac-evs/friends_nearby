output "http_api_url" { value = aws_apigatewayv2_api.http.api_endpoint }
output "websocket_url" { value = aws_apigatewayv2_stage.ws.invoke_url }
output "cdn_domain" { value = aws_cloudfront_distribution.cdn.domain_name }
output "media_bucket" { value = aws_s3_bucket.media.id }
output "history_bucket" { value = aws_s3_bucket.history.id }
output "events_queue_url" { value = aws_sqs_queue.events.url }
output "redis_endpoint" { value = aws_elasticache_replication_group.redis.primary_endpoint_address }
