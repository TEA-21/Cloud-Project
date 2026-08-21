# ==============================================================================
# AELA - Terraform Input Variables
# ==============================================================================

variable "aws_region" {
  description = "AWS deployment region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment name (e.g., dev, staging, prod)"
  type        = string
  default     = "dev"
}

# --- Network Architecture Variables ---
variable "vpc_cidr" {
  description = "CIDR block for the isolated Amazon VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "isolated_subnet_cidrs" {
  description = "CIDR blocks for the isolated subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "availability_zones" {
  description = "Availability zones for subnet distribution"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "instance_type" {
  description = "EC2 micro instance type for target test nodes"
  type        = string
  default     = "t2.micro"
}

# --- VPC Endpoints & Connectivity Variables ---
variable "enable_vpc_endpoints" {
  description = "Flag to enable private Interface & Gateway VPC Endpoints for isolated subnets"
  type        = bool
  default     = true
}

# --- Telemetry & Observability Variables ---
variable "cloudwatch_log_retention_days" {
  description = "Retention period (in days) for CloudWatch telemetry log groups"
  type        = number
  default     = 14
}

variable "enable_cloudtrail_logging" {
  description = "Enable CloudTrail telemetry streaming to CloudWatch Logs"
  type        = bool
  default     = true
}

# --- State Management Variables ---
variable "state_bucket_prefix" {
  description = "Prefix for the remote S3 state storage bucket"
  type        = string
  default     = "aela-tf-state"
}

variable "state_lock_table_name" {
  description = "DynamoDB table name for Terraform state locking"
  type        = string
  default     = "aela-tf-locks"
}
