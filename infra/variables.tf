variable "region" {
  type    = string
  default = "us-east-1"
}
variable "project" {
  type    = string
  default = "friends-nearby"
}
variable "environment" {
  type    = string
  default = "dev"
}
variable "vpc_cidr" {
  type    = string
  default = "10.20.0.0/16"
}
variable "redis_node_type" {
  type    = string
  default = "cache.t4g.micro"
}
variable "location_ttl_seconds" {
  description = "Redis TTL for inactive users' locations"
  type        = number
  default     = 120
}
variable "lambda_memory" {
  type    = number
  default = 256
}
variable "cors_origins" {
  type    = list(string)
  default = ["*"]
}
