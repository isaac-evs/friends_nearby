locals {
  name = "${var.project}-${var.environment}"
}

module "network" {
  source   = "./modules/network"
  name     = local.name
  vpc_cidr = var.vpc_cidr
}

module "database" {
  source = "./modules/database"
  name   = local.name
}

module "cache" {
  source            = "./modules/cache"
  name              = local.name
  node_type         = var.redis_node_type
  subnet_ids        = module.network.private_subnet_ids
  security_group_id = module.network.redis_sg_id
}

module "messaging" {
  source = "./modules/messaging"
  name   = local.name
}

module "storage" {
  source       = "./modules/storage"
  name         = local.name
  cors_origins = var.cors_origins
}

module "compute" {
  source = "./modules/compute"
  name   = local.name

  memory_size          = var.lambda_memory
  location_ttl_seconds = var.location_ttl_seconds
  subnet_ids           = module.network.private_subnet_ids
  security_group_id    = module.network.lambda_sg_id

  users_table_name       = module.database.users_table_name
  users_table_arn        = module.database.users_table_arn
  friendships_table_name = module.database.friendships_table_name
  friendships_table_arn  = module.database.friendships_table_arn
  connections_table_name = module.database.connections_table_name
  connections_table_arn  = module.database.connections_table_arn

  redis_endpoint = module.cache.endpoint
  queue_url      = module.messaging.queue_url
  queue_arn      = module.messaging.queue_arn

  media_bucket_id    = module.storage.media_bucket_id
  media_bucket_arn   = module.storage.media_bucket_arn
  history_bucket_id  = module.storage.history_bucket_id
  history_bucket_arn = module.storage.history_bucket_arn
  cdn_domain         = module.storage.cdn_domain

  ws_management_url = module.api.ws_management_url
  ws_execution_arn  = module.api.ws_execution_arn
}

module "api" {
  source               = "./modules/api"
  name                 = local.name
  stage_name           = var.environment
  cors_origins         = var.cors_origins
  lambda_invoke_arn    = module.compute.api_invoke_arn
  lambda_function_name = module.compute.api_function_name
}
