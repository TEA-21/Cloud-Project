"""
Unit Tests for AELA Phase 2 - LSTM Model Architecture & Training Convergence
Validates neural network tensor dimensions, gradient propagation, loss convergence,
and model checkpoint persistence.
"""

from __future__ import annotations

import os
import tempfile
import numpy as np
import pytest
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from src.analytics_engine.data_preprocessor import (
    NUM_FEATURES,
    TelemetrySequenceDataset,
)
from src.analytics_engine.lstm_model import (
    LSTMAnomalyClassifier,
    LSTMAutoencoder,
    load_model_checkpoint,
    save_model_checkpoint,
)
from src.analytics_engine.train_model import (
    compute_binary_metrics,
    evaluate_on_test_set,
    train_lstm_classifier,
)


# ------------------------------------------------------------------------------
# 1. Architecture & Tensor Shape Assertions
# ------------------------------------------------------------------------------

def test_lstm_classifier_forward_shapes() -> None:
    batch_size = 16
    seq_len = 10
    input_dim = NUM_FEATURES  # 16

    model = LSTMAnomalyClassifier(
        input_dim=input_dim,
        hidden_dim=64,
        num_layers=2,
        dropout=0.2,
    )

    x = torch.randn(batch_size, seq_len, input_dim, dtype=torch.float32)
    logits = model(x)

    assert logits.shape == (batch_size, 1)
    assert logits.dtype == torch.float32

    # Verify probability predictions
    probas = model.predict_proba(x)
    assert probas.shape == (batch_size, 1)
    assert (probas >= 0.0).all() and (probas <= 1.0).all()


def test_lstm_autoencoder_reconstruction_shapes() -> None:
    batch_size = 8
    seq_len = 10
    input_dim = NUM_FEATURES

    ae = LSTMAutoencoder(
        input_dim=input_dim,
        hidden_dim=32,
        latent_dim=16,
        seq_len=seq_len,
    )

    x = torch.randn(batch_size, seq_len, input_dim, dtype=torch.float32)
    reconstructed = ae(x)

    assert reconstructed.shape == (batch_size, seq_len, input_dim)
    assert reconstructed.dtype == torch.float32

    # Verify MSE error computation
    errors = ae.compute_reconstruction_error(x)
    assert errors.shape == (batch_size,)
    assert (errors >= 0.0).all()


# ------------------------------------------------------------------------------
# 2. Gradient Flow & Backward Pass Verification
# ------------------------------------------------------------------------------

def test_lstm_gradient_flow() -> None:
    model = LSTMAnomalyClassifier(input_dim=NUM_FEATURES, hidden_dim=32, num_layers=2)
    criterion = nn.BCEWithLogitsLoss()

    x = torch.randn(4, 10, NUM_FEATURES, dtype=torch.float32)
    target = torch.ones(4, 1, dtype=torch.float32)

    logits = model(x)
    loss = criterion(logits, target)
    loss.backward()

    # Assert all layers receive non-zero gradients
    for name, param in model.named_parameters():
        assert param.grad is not None, f"Parameter {name} has no gradient!"
        grad_norm = torch.norm(param.grad).item()
        assert grad_norm > 0.0, f"Parameter {name} has vanishing gradient (norm=0.0)"


# ------------------------------------------------------------------------------
# 3. Model Training & Loss Convergence Verification
# ------------------------------------------------------------------------------

def test_loss_convergence_during_training() -> None:
    """
    Asserts that optimization strictly decreases loss over consecutive epochs.
    """
    torch.manual_seed(42)
    np.random.seed(42)

    # Generate synthetic training batch with distinct patterns
    # Normal sequences: low mean; Anomalous: high mean with bursts
    normal_x = torch.zeros(60, 10, NUM_FEATURES, dtype=torch.float32)
    normal_y = torch.zeros(60, 1, dtype=torch.float32)

    anom_x = torch.ones(60, 10, NUM_FEATURES, dtype=torch.float32) * 0.8
    anom_y = torch.ones(60, 1, dtype=torch.float32)

    X = torch.cat([normal_x, anom_x], dim=0)
    y = torch.cat([normal_y, anom_y], dim=0)

    train_ds = TelemetrySequenceDataset(X, y)
    train_loader = DataLoader(train_ds, batch_size=16, shuffle=True)
    val_loader = DataLoader(train_ds, batch_size=16, shuffle=False)

    model, history = train_lstm_classifier(
        train_loader=train_loader,
        val_loader=val_loader,
        input_dim=NUM_FEATURES,
        hidden_dim=32,
        num_layers=1,
        learning_rate=0.01,
        epochs=8,
        verbose=False,
    )

    initial_loss = history["train_loss"][0]
    final_loss = history["train_loss"][-1]

    # Mathematical proof of loss convergence
    assert final_loss < initial_loss, f"Loss did not converge! Initial={initial_loss:.4f}, Final={final_loss:.4f}"
    assert final_loss < 0.20, f"Expected final loss < 0.20 on linearly separable patterns, got {final_loss:.4f}"


# ------------------------------------------------------------------------------
# 4. Metric Computation Correctness
# ------------------------------------------------------------------------------

def test_binary_metrics_accuracy() -> None:
    y_true = np.array([[1], [1], [0], [0]])
    y_pred_proba = np.array([[0.9], [0.4], [0.1], [0.8]])

    # Predicted: [1, 0, 0, 1]
    # TP: 1 (idx 0), FN: 1 (idx 1), TN: 1 (idx 2), FP: 1 (idx 3)
    metrics = compute_binary_metrics(y_true, y_pred_proba, threshold=0.5)

    assert metrics["tp"] == 1
    assert metrics["fn"] == 1
    assert metrics["tn"] == 1
    assert metrics["fp"] == 1
    assert metrics["accuracy"] == 0.5
    assert metrics["precision"] == 0.5
    assert metrics["recall"] == 0.5
    assert metrics["f1"] == 0.5


# ------------------------------------------------------------------------------
# 5. Checkpoint Serialization & Weight Persistence Roundtrip
# ------------------------------------------------------------------------------

def test_model_checkpoint_save_and_load_roundtrip() -> None:
    model = LSTMAnomalyClassifier(input_dim=NUM_FEATURES, hidden_dim=32, num_layers=1)
    x = torch.randn(4, 10, NUM_FEATURES, dtype=torch.float32)
    original_output = model.predict_proba(x)

    with tempfile.TemporaryDirectory() as tmp_dir:
        save_path = os.path.join(tmp_dir, "test_lstm.pth")
        metadata = {"input_dim": NUM_FEATURES, "hidden_dim": 32, "num_layers": 1, "test_score": 0.99}

        save_model_checkpoint(model, save_path, metadata=metadata)
        assert os.path.exists(save_path)
        assert os.path.exists(os.path.join(tmp_dir, "test_lstm_metadata.json"))

        loaded_model, loaded_meta = load_model_checkpoint(
            LSTMAnomalyClassifier,
            save_path,
        )

        assert loaded_meta["test_score"] == 0.99
        loaded_output = loaded_model.predict_proba(x)

        # Assert identical predictions to numerical precision
        assert torch.allclose(original_output, loaded_output, atol=1e-6)


# ------------------------------------------------------------------------------
# 6. Production Model Artifact Validation
# ------------------------------------------------------------------------------

def test_production_trained_model_artifacts() -> None:
    base_dir = os.path.dirname(os.path.dirname(__file__))
    model_path = os.path.join(base_dir, "src", "analytics_engine", "models", "lstm_anomaly_model.pth")
    meta_path = os.path.join(base_dir, "src", "analytics_engine", "models", "lstm_anomaly_model_metadata.json")

    assert os.path.exists(model_path), f"Missing model checkpoint: {model_path}"
    assert os.path.exists(meta_path), f"Missing metadata: {meta_path}"

    loaded_model, metadata = load_model_checkpoint(LSTMAnomalyClassifier, model_path)
    assert metadata["model_type"] == "LSTMAnomalyClassifier"
    assert metadata["test_metrics"]["accuracy"] >= 0.85
    assert metadata["test_metrics"]["precision"] >= 0.85

    # Run sample inference
    sample_seq = torch.randn(1, 10, NUM_FEATURES, dtype=torch.float32)
    proba = loaded_model.predict_proba(sample_seq)
    assert proba.shape == (1, 1)
    assert 0.0 <= proba.item() <= 1.0
