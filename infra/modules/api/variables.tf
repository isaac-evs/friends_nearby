variable "name" { type = string }
variable "stage_name" { type = string }
variable "cors_origins" { type = list(string) }
variable "lambda_invoke_arn" { type = string }
variable "lambda_function_name" { type = string }
