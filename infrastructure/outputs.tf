# ==============================================================================
# AELA - Terraform Outputs
# ==============================================================================

# --- Networking Outputs ---
output "vpc_id" {
  description = "ID of the isolated Amazon VPC"
  value       = aws_vpc.aela_vpc.id
}

output "isolated_subnet_ids" {
  description = "IDs of the isolated subnets"
  value       = aws_subnet.isolated_subnets[*].id
}

output "quarantine_security_group_id" {
  description = "ID of the quarantine isolation security group (zero ingress/egress)"
  value       = aws_security_group.quarantine_sg.id
}

output "microservice_security_group_id" {
  description = "ID of the operational microservice security group"
  value       = aws_security_group.microservice_sg.id
}

output "vpc_endpoints_security_group_id" {
  description = "ID of the private VPC endpoints security group"
  value       = aws_security_group.vpc_endpoints_sg.id
}

# --- VPC Endpoints Outputs ---
output "vpc_endpoint_sts_id" {
  description = "Interface VPC Endpoint ID for AWS STS"
  value       = try(aws_vpc_endpoint.sts[0].id, null)
}

output "vpc_endpoint_logs_id" {
  description = "Interface VPC Endpoint ID for CloudWatch Logs"
  value       = try(aws_vpc_endpoint.logs[0].id, null)
}

output "vpc_endpoint_cloudtrail_id" {
  description = "Interface VPC Endpoint ID for AWS CloudTrail"
  value       = try(aws_vpc_endpoint.cloudtrail[0].id, null)
}

output "vpc_endpoint_s3_id" {
  description = "Gateway VPC Endpoint ID for Amazon S3"
  value       = try(aws_vpc_endpoint.s3[0].id, null)
}

output "vpc_endpoint_dynamodb_id" {
  description = "Gateway VPC Endpoint ID for Amazon DynamoDB"
  value       = try(aws_vpc_endpoint.dynamodb[0].id, null)
}

# --- IAM & Security Outputs ---
output "base_service_role_arn" {
  description = "ARN of the functional base IAM service role"
  value       = aws_iam_role.base_service_role.arn
}

output "deny_isolation_role_arn" {
  description = "ARN of the explicit Deny quarantine isolation IAM role"
  value       = aws_iam_role.deny_isolation_role.arn
}

output "target_instance_id" {
  description = "EC2 target microservice instance ID"
  value       = aws_instance.target_test_node.id
}

# --- Telemetry Outputs ---
output "telemetry_log_group_arn" {
  description = "ARN of the CloudWatch log group receiving CloudTrail telemetry"
  value       = aws_cloudwatch_log_group.telemetry_log_group.arn
}

output "telemetry_log_group_name" {
  description = "Name of the CloudWatch log group receiving CloudTrail telemetry"
  value       = aws_cloudwatch_log_group.telemetry_log_group.name
}

output "cloudtrail_trail_arn" {
  description = "ARN of the CloudTrail trail"
  value       = aws_cloudtrail.aela_telemetry_trail.arn
}

output "cloudtrail_bucket_name" {
  description = "Name of the S3 bucket storing CloudTrail audit files"
  value       = aws_s3_bucket.cloudtrail_bucket.id
}

# --- State Management Outputs ---
output "terraform_state_bucket_name" {
  description = "Name of the S3 bucket provisioned for remote Terraform state storage"
  value       = aws_s3_bucket.terraform_state.id
}

output "terraform_locks_table_name" {
  description = "Name of the DynamoDB table provisioned for Terraform distributed state locking"
  value       = aws_dynamodb_table.terraform_locks.name
}
