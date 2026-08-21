# ==============================================================================
# AELA - Main Terraform Configuration
# Infrastructure Architecture:
# 1. Isolated VPC & Subnets
# 2. Security Groups (Quarantine, VPC Endpoints, Workload)
# 3. IAM Base Operational & Dynamic Quarantine Deny-All Roles
# 4. Target EC2 Micro Instance Test Nodes
# 5. Private VPC Endpoints (STS, Logs, CloudTrail, S3, DynamoDB)
# 6. Telemetry Pipeline (CloudTrail + CloudWatch Log Stream)
# 7. Remote State Storage (S3 + DynamoDB State Lock Table)
# ==============================================================================

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Data Source: Latest Amazon Linux 2023 AMI for EC2 Micro Instances
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ------------------------------------------------------------------------------
# 1. Isolated Virtual Private Cloud (VPC)
# ------------------------------------------------------------------------------
resource "aws_vpc" "aela_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "aela-${var.environment}-vpc"
  }
}

# Isolated Subnets (Strictly internal; no direct Internet Gateway attachment)
resource "aws_subnet" "isolated_subnets" {
  count                   = length(var.isolated_subnet_cidrs)
  vpc_id                  = aws_vpc.aela_vpc.id
  cidr_block              = var.isolated_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = false

  tags = {
    Name = "aela-${var.environment}-isolated-subnet-${count.index + 1}"
    Type = "Isolated"
  }
}

resource "aws_route_table" "isolated_rt" {
  vpc_id = aws_vpc.aela_vpc.id

  tags = {
    Name = "aela-${var.environment}-isolated-rt"
  }
}

resource "aws_route_table_association" "isolated_rta" {
  count          = length(aws_subnet.isolated_subnets)
  subnet_id      = aws_subnet.isolated_subnets[count.index].id
  route_table_id = aws_route_table.isolated_rt.id
}

# ------------------------------------------------------------------------------
# 2. Security Groups: Workload, VPC Endpoints & Quarantine Isolation
# ------------------------------------------------------------------------------

# Quarantine Security Group (Zero standing ingress and egress rules)
resource "aws_security_group" "quarantine_sg" {
  name        = "aela-${var.environment}-quarantine-sg"
  description = "Quarantine isolation security group - zero standing ingress/egress"
  vpc_id      = aws_vpc.aela_vpc.id

  tags = {
    Name = "aela-${var.environment}-quarantine-sg"
    Role = "Isolation"
  }
}

# Workload Security Group (Internal VPC communication for microservice nodes)
resource "aws_security_group" "microservice_sg" {
  name        = "aela-${var.environment}-microservice-sg"
  description = "Security group for microservices to reach private VPC endpoints over HTTPS"
  vpc_id      = aws_vpc.aela_vpc.id

  egress {
    description = "Allow HTTPS outbound to VPC Interface Endpoints"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  tags = {
    Name = "aela-${var.environment}-microservice-sg"
    Role = "Operational"
  }
}

# VPC Endpoints Security Group (Accepts HTTPS traffic from internal VPC CIDR)
resource "aws_security_group" "vpc_endpoints_sg" {
  name        = "aela-${var.environment}-vpc-endpoints-sg"
  description = "Controls ingress traffic to private AWS VPC interface endpoints"
  vpc_id      = aws_vpc.aela_vpc.id

  ingress {
    description = "Allow HTTPS from within isolated VPC CIDR"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    description = "Allow local internal response return"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }

  tags = {
    Name = "aela-${var.environment}-vpc-endpoints-sg"
  }
}

# ------------------------------------------------------------------------------
# 3. Private VPC Endpoints (Interface & Gateway)
# ------------------------------------------------------------------------------

# Interface Endpoint: AWS Security Token Service (STS)
resource "aws_vpc_endpoint" "sts" {
  count               = var.enable_vpc_endpoints ? 1 : 0
  vpc_id              = aws_vpc.aela_vpc.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.sts"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true
  subnet_ids          = aws_subnet.isolated_subnets[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints_sg.id]

  tags = {
    Name = "aela-${var.environment}-vpce-sts"
  }
}

# Interface Endpoint: Amazon CloudWatch Logs
resource "aws_vpc_endpoint" "logs" {
  count               = var.enable_vpc_endpoints ? 1 : 0
  vpc_id              = aws_vpc.aela_vpc.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.logs"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true
  subnet_ids          = aws_subnet.isolated_subnets[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints_sg.id]

  tags = {
    Name = "aela-${var.environment}-vpce-logs"
  }
}

# Interface Endpoint: AWS CloudTrail
resource "aws_vpc_endpoint" "cloudtrail" {
  count               = var.enable_vpc_endpoints ? 1 : 0
  vpc_id              = aws_vpc.aela_vpc.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.cloudtrail"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true
  subnet_ids          = aws_subnet.isolated_subnets[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints_sg.id]

  tags = {
    Name = "aela-${var.environment}-vpce-cloudtrail"
  }
}

# Gateway Endpoint: Amazon S3
resource "aws_vpc_endpoint" "s3" {
  count             = var.enable_vpc_endpoints ? 1 : 0
  vpc_id            = aws_vpc.aela_vpc.id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.isolated_rt.id]

  tags = {
    Name = "aela-${var.environment}-vpce-s3"
  }
}

# Gateway Endpoint: Amazon DynamoDB
resource "aws_vpc_endpoint" "dynamodb" {
  count             = var.enable_vpc_endpoints ? 1 : 0
  vpc_id            = aws_vpc.aela_vpc.id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.dynamodb"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.isolated_rt.id]

  tags = {
    Name = "aela-${var.environment}-vpce-dynamodb"
  }
}

# ------------------------------------------------------------------------------
# 4. IAM Roles: Base Operational Role vs. Dynamic Quarantine Deny-All Role
# ------------------------------------------------------------------------------

data "aws_iam_policy_document" "ec2_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

# Base Functional IAM Role (Initial active operational identity)
resource "aws_iam_role" "base_service_role" {
  name               = "aela-${var.environment}-base-service-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json

  tags = {
    Name = "aela-${var.environment}-base-service-role"
    Type = "Functional"
  }
}

# Baseline minimal telemetry logging policy for microservices
resource "aws_iam_policy" "base_functional_policy" {
  name        = "aela-${var.environment}-base-functional-policy"
  description = "Baseline operational telemetry logging policy for microservices"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "CloudWatchLogsPublish"
        Effect   = "Allow"
        Action   = [
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "base_functional_attach" {
  role       = aws_iam_role.base_service_role.name
  policy_arn = aws_iam_policy.base_functional_policy.arn
}

# Quarantine Deny-All Isolation Role (Dynamically swapped during scale-down)
resource "aws_iam_role" "deny_isolation_role" {
  name               = "aela-${var.environment}-deny-isolation-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json

  tags = {
    Name = "aela-${var.environment}-deny-isolation-role"
    Type = "Quarantine"
  }
}

resource "aws_iam_policy" "quarantine_deny_all_policy" {
  name        = "aela-${var.environment}-quarantine-deny-all-policy"
  description = "Explicit Deny policy applied to scale standing permissions to absolute zero"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "ExplicitAbsoluteDenyAll"
        Effect    = "Deny"
        Action    = "*"
        Resource  = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "deny_isolation_attach" {
  role       = aws_iam_role.deny_isolation_role.name
  policy_arn = aws_iam_policy.quarantine_deny_all_policy.arn
}

# Instance Profile for Microservice Nodes
resource "aws_iam_instance_profile" "target_node_profile" {
  name = "aela-${var.environment}-target-node-profile"
  role = aws_iam_role.base_service_role.name
}

# ------------------------------------------------------------------------------
# 5. Target Amazon EC2 Micro Instance Test Node
# ------------------------------------------------------------------------------
resource "aws_instance" "target_test_node" {
  ami                  = data.aws_ami.amazon_linux_2023.id
  instance_type        = var.instance_type
  subnet_id            = aws_subnet.isolated_subnets[0].id
  iam_instance_profile = aws_iam_instance_profile.target_node_profile.name
  vpc_security_group_ids = [
    aws_security_group.microservice_sg.id
  ]

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required" # IMDSv2 enforced
    http_put_response_hop_limit = 1
  }

  tags = {
    Name        = "aela-${var.environment}-target-node-1"
    Role        = "TargetMicroservice"
    Environment = var.environment
  }
}

# ------------------------------------------------------------------------------
# 6. Telemetry Aggregation: CloudTrail & CloudWatch Log Streams
# ------------------------------------------------------------------------------

# S3 Bucket for CloudTrail Event Storage
resource "aws_s3_bucket" "cloudtrail_bucket" {
  bucket        = "aela-${var.environment}-cloudtrail-${data.aws_caller_identity.current.account_id}"
  force_destroy = true

  tags = {
    Name = "aela-${var.environment}-cloudtrail-storage"
  }
}

resource "aws_s3_bucket_versioning" "cloudtrail_bucket_versioning" {
  bucket = aws_s3_bucket.cloudtrail_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "cloudtrail_bucket_encryption" {
  bucket = aws_s3_bucket.cloudtrail_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "cloudtrail_bucket_block" {
  bucket                  = aws_s3_bucket.cloudtrail_bucket.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudTrail S3 Bucket Policy
resource "aws_s3_bucket_policy" "cloudtrail_bucket_policy" {
  bucket = aws_s3_bucket.cloudtrail_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AWSCloudTrailAclCheck"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action   = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.cloudtrail_bucket.arn
      },
      {
        Sid    = "AWSCloudTrailWrite"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.cloudtrail_bucket.arn}/prefix/AWSLogs/${data.aws_caller_identity.current.account_id}/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl" = "bucket-owner-full-control"
          }
        }
      }
    ]
  })
}

# CloudWatch Log Group for Streaming API Telemetry
resource "aws_cloudwatch_log_group" "telemetry_log_group" {
  name              = "/aws/aela/${var.environment}/telemetry"
  retention_in_days = var.cloudwatch_log_retention_days

  tags = {
    Name = "aela-${var.environment}-telemetry-log-group"
  }
}

# IAM Role for CloudTrail to publish events into CloudWatch Logs
resource "aws_iam_role" "cloudtrail_cloudwatch_role" {
  name = "aela-${var.environment}-cloudtrail-cloudwatch-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "cloudtrail_cloudwatch_policy" {
  name = "aela-${var.environment}-cloudtrail-cloudwatch-policy"
  role = aws_iam_role.cloudtrail_cloudwatch_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "CloudTrailPutLogs"
        Effect   = "Allow"
        Action   = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.telemetry_log_group.arn}:*"
      }
    ]
  })
}

# AWS CloudTrail Trail (Captures management and data events for analytics engine)
resource "aws_cloudtrail" "aela_telemetry_trail" {
  name                          = "aela-${var.environment}-telemetry-trail"
  s3_bucket_name                = aws_s3_bucket.cloudtrail_bucket.id
  s3_key_prefix                 = "prefix"
  cloud_watch_logs_group_arn    = "${aws_cloudwatch_log_group.telemetry_log_group.arn}:*"
  cloud_watch_logs_role_arn     = aws_iam_role.cloudtrail_cloudwatch_role.arn
  include_global_service_events = true
  is_multi_region_trail         = false
  enable_logging                = var.enable_cloudtrail_logging

  event_selector {
    read_write_type           = "All"
    include_management_events = true
  }

  depends_on = [
    aws_s3_bucket_policy.cloudtrail_bucket_policy
  ]

  tags = {
    Name = "aela-${var.environment}-telemetry-trail"
  }
}

# ------------------------------------------------------------------------------
# 7. Remote State Storage & Distributed Locking Infrastructure
# ------------------------------------------------------------------------------

# S3 Bucket for Terraform Remote State
resource "aws_s3_bucket" "terraform_state" {
  bucket        = "${var.state_bucket_prefix}-${var.environment}-${data.aws_caller_identity.current.account_id}"
  force_destroy = false

  tags = {
    Name = "aela-${var.environment}-terraform-state"
  }
}

resource "aws_s3_bucket_versioning" "terraform_state_versioning" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state_encryption" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state_block" {
  bucket                  = aws_s3_bucket.terraform_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# DynamoDB Table for Distributed State Locking
resource "aws_dynamodb_table" "terraform_locks" {
  name         = "${var.state_lock_table_name}-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = {
    Name = "aela-${var.environment}-terraform-locks"
  }
}
