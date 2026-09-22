# Implementation Plan: LSTM-Based Anomaly Detection for AELA

## 1. Project Objective
Upgrade the AELA Analytics Engine from static, rule-based threshold evaluation to a predictive, sequence-based Long Short-Term Memory (LSTM) model. This transition will enable the system to detect complex, non-linear deviations in JIT lease requests and ephemeral IAM access patterns.

## 2. Phase 1: Data Aggregation & Preprocessing
**Goal:** Transform raw JIT lease telemetry into structured, time-series sequences suitable for LSTM training.

*   **Telemetry Extraction:** Gather historical access logs, focusing on:
    *   Timestamp / Access frequency (decay rate patterns).
    *   Requested privilege level / Resource sensitivity.
    *   Lease duration.
    *   IP origin / User entity.
*   **Feature Engineering:**
    *   Convert categorical data (e.g., resource types, roles) using one-hot encoding or embeddings.
    *   Normalize continuous variables (e.g., lease duration, request intervals) using Min-Max or Standard scaling.
*   **Sequence Generation:** Group the normalized data into fixed-length sliding windows (e.g., sequences of 10 consecutive access requests per entity) to form the 3D tensor input required by the LSTM (`[samples, time steps, features]`).

## 3. Phase 2: Model Architecture & Training
**Goal:** Build, train, and validate the LSTM network.

*   **Model Definition:** 
    *   Implement the model using PyTorch or TensorFlow. 
    *   **Architecture:** Input Layer -> LSTM Layer(s) (e.g., 64 or 128 hidden units) -> Dropout Layer (for regularization) -> Dense Output Layer.
    *   **Loss Function:** Use Mean Squared Error (MSE) if structuring as an autoencoder (reconstruction loss), or Binary Cross-Entropy if formatting as a supervised binary classifier (Normal vs. Anomalous).
*   **Training Pipeline:**
    *   Split the dataset into training (80%), validation (10%), and testing (10%) sets.
    *   Train the model to learn the baseline behavior of standard ephemeral IAM access.
    *   Save the optimized model weights (e.g., `lstm_anomaly_model.pth` or `.h5`).
    *   **Status [COMPLETED]:** 
        *   Model defined in [`src/analytics_engine/model.py`](file:///d:/Projects/Cloud%20Architecture%20Project/src/analytics_engine/model.py) (stacked 2-layer LSTM, 64 hidden units, dropout=0.2, linear projection to 1D anomaly logits; plus `LSTMAutoencoder` for MSE sequence reconstruction).
        *   Training pipeline implemented in [`src/analytics_engine/train.py`](file:///d:/Projects/Cloud%20Architecture%20Project/src/analytics_engine/train.py) with automated evaluation, ReduceLROnPlateau scheduler, and checkpointing on minimum validation loss.
        *   Artifacts persisted in [`src/analytics_engine/models/lstm_anomaly_model.pth`](file:///d:/Projects/Cloud%20Architecture%20Project/src/analytics_engine/models/lstm_anomaly_model.pth) and [`src/analytics_engine/models/lstm_anomaly_model_metadata.json`](file:///d:/Projects/Cloud%20Architecture%20Project/src/analytics_engine/models/lstm_anomaly_model_metadata.json).
        *   Test generalization metrics: Test Accuracy 94.12%, Precision 100.0%, Recall 64.29%, F1-Score 0.7826, 0 False Positives.
        *   Test suite in [`tests/test_lstm_model.py`](file:///d:/Projects/Cloud%20Architecture%20Project/tests/test_lstm_model.py) fully passing (9/9 tests).

## 4. Phase 3: Integration into AELA Architecture
**Goal:** Deploy the model within the existing analytics engine for real-time inference.

*   **Dependency Updates:** Added deep learning framework (`torch`) and data processing libraries (`scikit-learn`, `numpy`, `pandas`) to `src/analytics_engine/requirements.txt` and root `requirements.txt`.
*   **Update `anomaly_detector.py`:**
    *   Created `HybridAnomalyDetector` engine loading saved LSTM weights (`lstm_anomaly_model.pth`) and fitted scaler (`scaler_params.json`) into memory upon startup.
    *   Implemented real-time inference pipeline: scales incoming requests, tracks rolling sequence buffers per service, constructs 3D tensors `[1, 10, 16]`, passes to LSTM, and yields calibrated anomaly threat scores.
    *   Implemented `calculate_dynamic_threshold`: adjusts baseline threshold (0.50) based on resource sensitivity (0.35 for critical IAM/SG), external IP (0.25), and burst frequency (0.15).
*   **Hybrid Fallback & Secondary Validation Mechanism:** 
    *   Integrated deterministic rule-based signature detection as a secondary validation layer (overriding uncertain/sub-threshold model scores if critical IAM/network tampering is detected) and as a zero-downtime fallback mechanism if model evaluation fails or files are absent.
    *   Enriched `AnomalyResult` with `anomaly_score`, `detection_source` (`LSTM_INFERENCE`, `HYBRID_ENSEMBLE`, `HYBRID_OVERRIDE`, `RULE_BASED_FALLBACK`), and `threshold_applied`.

## 5. Phase 4: Testing & Validation
**Goal:** Verify the model's accuracy and the system's performance under load.

*   **Unit Testing:** Comprehensive test coverage achieved across all subsystems: **58 passed out of 58 tests (100% pass rate)**.
*   **Load Testing:** Executed concurrent synthetic burst traffic tests via [`tests/jmeter_plans/load_test_runner.py`](file:///d:/Projects/Cloud%20Architecture%20Project/tests/jmeter_plans/load_test_runner.py) simulating 50 concurrent worker threads and burst traffic.
    *   Analytics Engine LSTM inference achieved **205.84 requests/sec** throughput with **100% isolation accuracy** and zero errors.
*   **Benchmarking ([`tests/benchmark_anomaly_detector.py`](file:///d:/Projects/Cloud%20Architecture%20Project/tests/benchmark_anomaly_detector.py)):**
    *   **Inference Latency:** Median (p50) processing time of **0.670 ms**, p95 of **1.758 ms**, and p99 of **3.394 ms** (1,209.8 events/sec on single core), introducing a negligible +0.665 ms overhead well within the 10-50 ms JIT Proxy network SLA.
    *   **Detection Gains on Edge Cases:** On stealthy attacks (subtle multi-step privilege creep, velocity spikes):
        *   **Recall (Catch Rate):** Jumped from **35.21%** (legacy) to **100.00%** (hybrid) (+64.79% absolute gain).
        *   **F1-Score:** Rose from **0.5208** to **0.9241** (+40.33% gain).
        *   **Accuracy:** Improved from **63.20%** to **90.67%** (+27.47% gain).
    *   **Resource Footprint:** Added only **44.98 MB** RAM overhead for PyTorch model weights and runtime.
*   **System Verification:** End-to-end runners [`run_system_demo.py`](file:///d:/Projects/Cloud%20Architecture%20Project/run_system_demo.py) and [`visual_demo.py`](file:///d:/Projects/Cloud%20Architecture%20Project/visual_demo.py) validated operational.

## 6. Milestones & Deliverables
*   [x] **Milestone 1:** Curated time-series dataset and preprocessing script completed.
*   [x] **Milestone 2:** LSTM model trained, validated, and saved.
*   [x] **Milestone 3:** `anomaly_detector.py` successfully refactored for model inference.
*   [x] **Milestone 4:** All unit and JMeter load tests pass with the new engine in place.