output "http_url" { value = aws_apigatewayv2_api.http.api_endpoint }
output "websocket_url" { value = aws_apigatewayv2_stage.ws.invoke_url }
output "ws_execution_arn" { value = aws_apigatewayv2_api.ws.execution_arn }
output "ws_management_url" {
  value = "https://${aws_apigatewayv2_api.ws.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${aws_apigatewayv2_stage.ws.name}"
}
