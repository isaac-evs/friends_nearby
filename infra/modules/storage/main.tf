data "aws_caller_identity" "current" {}

locals {
  buckets = {
    media   = "${var.name}-media-${data.aws_caller_identity.current.account_id}"
    history = "${var.name}-history-${data.aws_caller_identity.current.account_id}"
  }
}

resource "aws_s3_bucket" "media" { bucket = local.buckets.media }
resource "aws_s3_bucket" "history" { bucket = local.buckets.history }

resource "aws_s3_bucket_public_access_block" "all" {
  for_each                = { media = aws_s3_bucket.media.id, history = aws_s3_bucket.history.id }
  bucket                  = each.value
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "all" {
  for_each = { media = aws_s3_bucket.media.id, history = aws_s3_bucket.history.id }
  bucket   = each.value
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  cors_rule {
    allowed_methods = ["PUT", "GET"]
    allowed_origins = var.cors_origins
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "history" {
  bucket = aws_s3_bucket.history.id
  rule {
    id     = "tiering"
    status = "Enabled"
    filter {}
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    transition {
      days          = 180
      storage_class = "GLACIER"
    }
  }
}

# Only CloudFront may read media
data "aws_iam_policy_document" "media_cdn" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.media.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.cdn.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "media" {
  bucket = aws_s3_bucket.media.id
  policy = data.aws_iam_policy_document.media_cdn.json
}
