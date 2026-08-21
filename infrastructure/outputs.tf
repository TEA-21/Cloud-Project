output "vpc_id" {
  description = "ID of the isolated Amazon VPC"
  value       = aws_vpc.aela_vpc.id
}

output "isolated_subnet_ids" {
  description = "IDs of the isolated subnets"
  value       = aws_subnet.isolated_subnets[*].id
}

output "quarantine_security_group_id" {
  description = "ID of the quarantine isolation security group"
  value       = aws_security_group.quarantine_sg.id
}

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
