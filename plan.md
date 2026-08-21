# AELA (Automated Ephemeral Least-Privilege Architecture) - Project Plan

## 1. Project Objective
Build an event-driven, programmatic infrastructure pipeline that dynamically scales cloud identity permissions down to absolute zero during idle periods, automatically restoring minimal required capabilities "Just-in-Time" (JIT) via an API proxy layer when valid traffic requests arise.

## 2. Architecture Layers
1. **Telemetry Aggregation:** AWS CloudTrail, Amazon CloudWatch Logs (Stream and parse data access API call signatures).
2. **Autonomic Decisions:** AWS Lambda (Python Engine), Amazon Kinesis (Calculate idle duration gaps and track active vulnerability risks).
3. **Orchestrated Enforcement:** AWS Step Functions, AWS IAM Engine (Dynamically detach standing broad policies and attach a Deny isolation role).
4. **Just-In-Time Leasing:** Amazon API Gateway, AWS STS (Validate microservice status, issuing localized 5-minute transient access tokens).

## 3. Implementation Phases & Agent Tasks

### Phase 1: Declarative Infrastructure Coding (Weeks 1-2)
- **Goal:** Set up baseline AWS infrastructure and quarantine parameters.
- **Tasks:**
  - [ ] Initialize Terraform configuration scripts (Terraform CLI v1.5.0+).
  - [ ] Define target microservice test nodes (Amazon EC2 micro instances).
  - [ ] Configure isolated subnets within an Amazon VPC.
  - [ ] Create baseline functional IAM roles and the quarantine isolation profile parameters.

### Phase 2: Event Stream Integration (Weeks 3-4)
- **Goal:** Build the telemetry parsing and decision engine.
- **Tasks:**
  - [ ] Set up Python 3.11 environment for Lambda development.
  - [ ] Develop the AWS Lambda analytics engine to process incoming streams.
  - [ ] Parse structural CloudTrail API call strings.
  - [ ] Implement logic to compute time-decay parameters.

### Phase 3: State-Machine Loop Engineering (Weeks 5-6)
- **Goal:** Orchestrate revocation and JIT leasing.
- **Tasks:**
  - [ ] Construct the AWS Step Functions workflow to execute active revocation loops.
  - [ ] Launch the Amazon API Gateway JIT authorization layer.
  - [ ] Integrate AWS STS to issue the 5-minute transient tokens upon validation.

### Phase 4: Empirical Load Testing & Validation (Weeks 7-8)
- **Goal:** Validate performance and security under load.
- **Tasks:**
  - [ ] Configure Apache JMeter for synthetic transaction traffic spikes.
  - [ ] Note for local test execution: Ensure Windows system environments (especially those utilizing Hyper-V, virtual Ethernet bridges, or Docker network adapters on HP machines) are properly configured to map local mock traffic to the AWS API Gateway endpoints without conflict.
  - [ ] Collect raw performance and security metrics during load testing.

## 4. Tech Stack Requirements
- **Cloud:** AWS Free Tier (EC2 micro, Lambda, IAM, DynamoDB, Step Functions, CloudTrail, CloudWatch, API Gateway, STS).
- **IaC:** Terraform CLI (v1.5.0+).
- **Runtime:** Python 3.11.
- **Testing:** Apache JMeter.
- **VCS:** Git.
