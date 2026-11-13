output "http_api_url" { value = module.api.http_url }
output "websocket_url" { value = module.api.websocket_url }
output "cdn_domain" { value = module.storage.cdn_domain }
output "media_bucket" { value = module.storage.media_bucket_id }
output "history_bucket" { value = module.storage.history_bucket_id }
output "events_queue_url" { value = module.messaging.queue_url }
output "redis_endpoint" { value = module.cache.endpoint }
