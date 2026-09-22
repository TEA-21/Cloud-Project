"""
AELA Analytics Engine - Telemetry Dataset Generation CLI
Generates and persists curated time-series telemetry records and feature scaler metadata
for LSTM training and validation.
"""

from __future__ import annotations

import json
import os
import sys

from src.analytics_engine.data_preprocessor import (
    TelemetryScaler,
    create_sliding_window_sequences,
    generate_synthetic_telemetry,
)


def main() -> None:
    data_dir = os.path.join(os.path.dirname(__file__), "data")
    os.makedirs(data_dir, exist_ok=True)

    telemetry_path = os.path.join(data_dir, "curated_telemetry.json")
    scaler_path = os.path.join(data_dir, "scaler_params.json")

    print("[Phase 1: Dataset Generation] Generating synthetic historical JIT lease telemetry...")
    records = generate_synthetic_telemetry(
        num_entities=12,
        events_per_entity=150,
        anomaly_ratio=0.15,
        seed=1337,
    )
    print(f"[Phase 1: Dataset Generation] Generated {len(records)} raw telemetry events across 12 entities.")

    # Fit scaler
    scaler = TelemetryScaler().fit(records)

    # Create sequences to verify shapes
    X, y = create_sliding_window_sequences(records, sequence_length=10, step=1, scaler=scaler)
    print(f"[Phase 1: Dataset Generation] 3D Tensor shape: X={tuple(X.shape)}, y={tuple(y.shape)}")
    print(f"[Phase 1: Dataset Generation] Anomaly ratio in windows: {(y.sum().item() / len(y)) * 100:.2f}%")

    # Persist dataset
    with open(telemetry_path, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2)
    print(f"[Phase 1: Dataset Generation] Persisted raw dataset to: {telemetry_path}")

    # Persist scaler parameters
    with open(scaler_path, "w", encoding="utf-8") as f:
        f.write(scaler.to_json())
    print(f"[Phase 1: Dataset Generation] Persisted scaler metadata to: {scaler_path}")


if __name__ == "__main__":
    main()
