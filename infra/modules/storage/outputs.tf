output "media_bucket_id" { value = aws_s3_bucket.media.id }
output "media_bucket_arn" { value = aws_s3_bucket.media.arn }
output "history_bucket_id" { value = aws_s3_bucket.history.id }
output "history_bucket_arn" { value = aws_s3_bucket.history.arn }
output "cdn_domain" { value = aws_cloudfront_distribution.cdn.domain_name }
