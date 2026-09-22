"""
AELA Analytics Engine - Deep Learning Training & Validation Pipeline (Re-export / Compatibility Layer)
Exposes compute_binary_metrics, train_lstm_classifier, evaluate_on_test_set, and run_training_pipeline
defined in src.analytics_engine.train.
"""

import os
import sys

# Ensure project root is in sys.path when executed directly
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.analytics_engine.train import (
    compute_binary_metrics,
    evaluate_on_test_set,
    main,
    run_training_pipeline,
    train_lstm_classifier,
)

__all__ = [
    "compute_binary_metrics",
    "evaluate_on_test_set",
    "main",
    "run_training_pipeline",
    "train_lstm_classifier",
]

if __name__ == "__main__":
    main()
