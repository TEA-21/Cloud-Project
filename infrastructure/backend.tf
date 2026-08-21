# ==============================================================================
# AELA - Modular Terraform Backend Configuration
# ==============================================================================
# This configuration provides a remote S3 + DynamoDB state locking backend.
#
# NOTE FOR LOCAL WORKSTATIONS / VIRTUAL NETWORK BRIDGES:
# When iterating locally on Windows environments with Hyper-V, WSL2, or Docker
# virtual Ethernet bridges, you can optionally run with local state to avoid
# network timeout / DynamoDB lease lock latency during rapid prototyping.
#
# To enable remote S3 state storage in collaborative or CI/CD pipelines:
# 1. First provision the S3 bucket & DynamoDB table defined in main.tf.
# 2. Uncomment the backend "s3" block below with your account's state bucket.
# 3. Run: terraform init -migrate-state
# ==============================================================================

# terraform {
#   backend "s3" {
#     bucket         = "aela-tf-state-dev-<ACCOUNT_ID>"
#     key            = "aela/dev/terraform.tfstate"
#     region         = "us-east-1"
#     dynamodb_table = "aela-tf-locks-dev"
#     encrypt        = true
#   }
# }
