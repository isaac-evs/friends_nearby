variable "name" { type = string }
variable "memory_size" { type = number }
variable "location_ttl_seconds" { type = number }

variable "subnet_ids" { type = list(string) }
variable "security_group_id" { type = string }

variable "users_table_name" { type = string }
variable "users_table_arn" { type = string }
variable "friendships_table_name" { type = string }
variable "friendships_table_arn" { type = string }
variable "connections_table_name" { type = string }
variable "connections_table_arn" { type = string }

variable "redis_endpoint" { type = string }
variable "queue_url" { type = string }
variable "queue_arn" { type = string }

variable "media_bucket_id" { type = string }
variable "media_bucket_arn" { type = string }
variable "history_bucket_id" { type = string }
variable "history_bucket_arn" { type = string }
variable "cdn_domain" { type = string }

variable "ws_management_url" { type = string }
variable "ws_execution_arn" { type = string }
