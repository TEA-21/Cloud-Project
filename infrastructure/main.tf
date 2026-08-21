# ==============================================================================
# AELA - Main Terraform Configuration
# Baseline Infrastructure: Isolated VPC, Target EC2 Micro Instances, IAM & Deny Roles
# ==============================================================================

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

# Isolated Subnets (No public route table / no direct IGW attachment)
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
# 2. Security Groups: Quarantine & Baseline Isolation
# ------------------------------------------------------------------------------
resource "aws_security_group" "quarantine_sg" {
  name        = "aela-${var.environment}-quarantine-sg"
  description = "Quarantine isolation security group - zero standing ingress/egress"
  vpc_id      = aws_vpc.aela_vpc.id

  tags = {
    Name = "aela-${var.environment}-quarantine-sg"
    Role = "Isolation"
  }
}

# ------------------------------------------------------------------------------
# 3. IAM Roles: Base Functional Role vs. Dynamic Deny Isolation Role
# ------------------------------------------------------------------------------

# Trust policy for EC2 micro instances
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

# Baseline minimal permission policy for operational testing
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

# Deny Isolation Role & Explicit Deny-All Policy (Attached during quarantine)
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
# 4. Target Amazon EC2 Micro Instance Test Node
# ------------------------------------------------------------------------------
resource "aws_instance" "target_test_node" {
  ami                  = data.aws_ami.amazon_linux_2023.id
  instance_type        = var.instance_type
  subnet_id            = aws_subnet.isolated_subnets[0].id
  iam_instance_profile = aws_iam_instance_profile.target_node_profile.name
  vpc_security_group_ids = [
    aws_security_group.quarantine_sg.id
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
