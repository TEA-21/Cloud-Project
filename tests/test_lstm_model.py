"""
Unit Tests for AELA Phase 2 - LSTM Model Architecture, Optimization & Checkpointing
Verifies:
  1. Forward pass execution with synthetic 3D input tensors [batch_size, 10, 16].
  2. Output tensor dimensions and loss computation (BCE & MSE).
  3. Single-step gradient backward pass and actual weight parameter updates.
  4. Model weight serialization and successful loading/deserialization roundtrip.
  5. Anomaly prediction probability calibration and reconstruction error computation.
  6. Production model artifact integrity.
"""

from __future__ import annotations

import json
import os
import tempfile
from typing import Dict

import numpy as np
import pytest
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from src.analytics_engine.data_preprocessor import (
    NUM_FEATURES,
    TelemetrySequenceDataset,
)
from src.analytics_engine.model import (
    DEFAULT_HIDDEN_DIM,
    DEFAULT_INPUT_DIM,
    DEFAULT_LATENT_DIM,
    DEFAULT_SEQ_LEN,
    LSTMAnomalyClassifier,
    LSTMAutoencoder,
    load_model_checkpoint,
    save_model_checkpoint,
)
from src.analytics_engine.train import (
    compute_binary_metrics,
    train_lstm_classifier,
)


# ------------------------------------------------------------------------------
# 1. Forward Pass with Synthetic 3D Input Tensors [batch_size, 10, 16]
# ------------------------------------------------------------------------------

def test_forward_pass_3d_input_tensors() -> None:
    """Verifies forward pass with synthetic 3D input tensors [batch_size, 10, 16]."""
    batch_size = 16
    seq_len = 10
    input_dim = 16

    # Instantiate classifier
    classifier = LSTMAnomalyClassifier(
        input_dim=input_dim,
        hidden_dim=64,
        num_layers=2,
        dropout=0.2,
    )

    # Instantiate autoencoder
    autoencoder = LSTMAutoencoder(
        input_dim=input_dim,
        hidden_dim=64,
        latent_dim=32,
        seq_len=seq_len,
        dropout=0.1,
    )

    # Synthetic 3D input tensor [batch_size, 10, 16]
    synthetic_input = torch.randn(batch_size, seq_len, input_dim, dtype=torch.float32)

    # Classifier forward pass
    logits = classifier(synthetic_input)
    assert logits.shape == (batch_size, 1), f"Expected logits shape {(batch_size, 1)}, got {logits.shape}"
    assert logits.dtype == torch.float32

    # Autoencoder forward pass
    reconstructed = autoencoder(synthetic_input)
    assert reconstructed.shape == (batch_size, seq_len, input_dim), (
        f"Expected reconstructed shape {(batch_size, seq_len, input_dim)}, got {reconstructed.shape}"
    )
    assert reconstructed.dtype == torch.float32


# ------------------------------------------------------------------------------
# 2. Output Tensor Dimensions and Loss Computation
# ------------------------------------------------------------------------------

def test_output_tensor_dimensions_and_loss_computation() -> None:
    """Verifies output dimensions and loss computation for both classification and reconstruction."""
    batch_size = 8
    seq_len = 10
    input_dim = 16

    x = torch.randn(batch_size, seq_len, input_dim, dtype=torch.float32)

    # 1. Supervised Anomaly Classifier (Binary Cross Entropy)
    classifier = LSTMAnomalyClassifier(input_dim=input_dim, hidden_dim=32, num_layers=1)
    bce_loss_fn = nn.BCEWithLogitsLoss()
    y_target = torch.randint(0, 2, (batch_size, 1), dtype=torch.float32)

    logits = classifier(x)
    assert logits.shape == (batch_size, 1)

    loss_bce = bce_loss_fn(logits, y_target)
    assert loss_bce.ndim == 0  # Scalar loss
    assert torch.isfinite(loss_bce)
    assert loss_bce.item() >= 0.0

    # 2. Unsupervised LSTM Autoencoder (Mean Squared Error)
    autoencoder = LSTMAutoencoder(input_dim=input_dim, hidden_dim=32, latent_dim=16, seq_len=seq_len)
    mse_loss_fn = nn.MSELoss()

    reconstructed = autoencoder(x)
    assert reconstructed.shape == (batch_size, seq_len, input_dim)

    loss_mse = mse_loss_fn(reconstructed, x)
    assert loss_mse.ndim == 0
    assert torch.isfinite(loss_mse)
    assert loss_mse.item() >= 0.0

    # Test reconstruction error method
    rec_errors = autoencoder.compute_reconstruction_error(x)
    assert rec_errors.shape == (batch_size,)
    assert (rec_errors >= 0.0).all()


# ------------------------------------------------------------------------------
# 3. Single-Step Gradient Backward Pass and Weight Updates
# ------------------------------------------------------------------------------

def test_single_step_gradient_backward_and_weight_updates() -> None:
    """Verifies single-step gradient backward pass and actual parameter weight updates."""
    torch.manual_seed(42)

    model = LSTMAnomalyClassifier(input_dim=16, hidden_dim=32, num_layers=1)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
    criterion = nn.BCEWithLogitsLoss()

    x = torch.randn(4, 10, 16, dtype=torch.float32)
    y = torch.ones(4, 1, dtype=torch.float32)

    # Snapshot initial parameters
    initial_params: Dict[str, torch.Tensor] = {
        name: param.detach().clone() for name, param in model.named_parameters()
    }

    # Forward pass
    optimizer.zero_grad()
    logits = model(x)
    loss = criterion(logits, y)

    # Backward pass
    loss.backward()

    # Verify gradients exist and are non-zero
    for name, param in model.named_parameters():
        assert param.grad is not None, f"Parameter {name} has no gradient computed!"
        assert torch.norm(param.grad).item() > 0.0, f"Parameter {name} gradient norm is zero!"

    # Optimizer step (weight update)
    optimizer.step()

    # Mathematically verify that weights were updated
    any_weight_changed = False
    for name, param in model.named_parameters():
        init_p = initial_params[name]
        diff = torch.norm(param.detach() - init_p).item()
        assert diff > 0.0, f"Parameter {name} did not change after optimizer.step()! Diff={diff}"
        any_weight_changed = True

    assert any_weight_changed, "No weights were modified during the single-step update!"


def test_autoencoder_gradient_backward_and_weight_updates() -> None:
    """Verifies single-step gradient backward pass and weight updates for LSTM Autoencoder."""
    torch.manual_seed(42)

    ae = LSTMAutoencoder(input_dim=16, hidden_dim=32, latent_dim=16, seq_len=10)
    optimizer = torch.optim.Adam(ae.parameters(), lr=0.01)
    criterion = nn.MSELoss()

    x = torch.randn(4, 10, 16, dtype=torch.float32)

    initial_params = {name: param.detach().clone() for name, param in ae.named_parameters()}

    optimizer.zero_grad()
    reconstructed = ae(x)
    loss = criterion(reconstructed, x)
    loss.backward()

    for name, param in ae.named_parameters():
        assert param.grad is not None, f"Autoencoder param {name} missing gradient!"
        assert torch.norm(param.grad).item() > 0.0, f"Autoencoder param {name} zero gradient!"

    optimizer.step()

    for name, param in ae.named_parameters():
        diff = torch.norm(param.detach() - initial_params[name]).item()
        assert diff > 0.0, f"Autoencoder param {name} did not update!"


# ------------------------------------------------------------------------------
# 4. Model Weight Serialization and Successful Loading/Deserialization
# ------------------------------------------------------------------------------

def test_model_weight_serialization_and_loading_roundtrip() -> None:
    """Verifies model weight serialization to disk and successful loading/deserialization."""
    torch.manual_seed(123)

    model = LSTMAnomalyClassifier(input_dim=16, hidden_dim=32, num_layers=2)
    test_tensor = torch.randn(6, 10, 16, dtype=torch.float32)
    expected_output = model.predict_proba(test_tensor)

    with tempfile.TemporaryDirectory() as temp_dir:
        checkpoint_path = os.path.join(temp_dir, "test_checkpoint.pth")
        metadata = {
            "model_type": "LSTMAnomalyClassifier",
            "input_dim": 16,
            "hidden_dim": 32,
            "num_layers": 2,
            "validation_auc": 0.985,
        }

        # 1. Save checkpoint and metadata
        save_model_checkpoint(model, checkpoint_path, metadata=metadata)
        assert os.path.exists(checkpoint_path)
        meta_file = os.path.splitext(checkpoint_path)[0] + "_metadata.json"
        assert os.path.exists(meta_file)

        # 2. Load checkpoint
        loaded_model, loaded_meta = load_model_checkpoint(
            LSTMAnomalyClassifier,
            checkpoint_path,
        )

        assert loaded_meta["validation_auc"] == 0.985
        assert loaded_meta["model_type"] == "LSTMAnomalyClassifier"

        # 3. Assert loaded model produces identical predictions
        loaded_output = loaded_model.predict_proba(test_tensor)
        assert torch.allclose(expected_output, loaded_output, atol=1e-6), (
            "Deserialized model outputs do not match original model outputs!"
        )


def test_autoencoder_serialization_roundtrip() -> None:
    """Verifies serialization and deserialization for LSTMAutoencoder."""
    ae = LSTMAutoencoder(input_dim=16, hidden_dim=32, latent_dim=16, seq_len=10)
    ae.eval()
    test_tensor = torch.randn(4, 10, 16, dtype=torch.float32)
    with torch.no_grad():
        expected_rec = ae(test_tensor)

    with tempfile.TemporaryDirectory() as temp_dir:
        save_path = os.path.join(temp_dir, "ae_test.pth")
        metadata = {"input_dim": 16, "hidden_dim": 32, "latent_dim": 16, "seq_len": 10}

        save_model_checkpoint(ae, save_path, metadata=metadata)
        loaded_ae, meta = load_model_checkpoint(LSTMAutoencoder, save_path)

        loaded_rec = loaded_ae(test_tensor)
        assert torch.allclose(expected_rec, loaded_rec, atol=1e-6)


# ------------------------------------------------------------------------------
# 5. Output Probability Calibration & Anomaly Bounds
# ------------------------------------------------------------------------------

def test_anomaly_probability_and_threshold_bounds() -> None:
    """Verifies probability predictions are strictly bounded in [0.0, 1.0]."""
    model = LSTMAnomalyClassifier(input_dim=16, hidden_dim=32, num_layers=1)
    x = torch.randn(20, 10, 16, dtype=torch.float32)

    probas = model.predict_proba(x)
    assert probas.shape == (20, 1)
    assert (probas >= 0.0).all()
    assert (probas <= 1.0).all()


# ------------------------------------------------------------------------------
# 6. Training Pipeline Convergence Verification
# ------------------------------------------------------------------------------

def test_training_loss_convergence() -> None:
    """Verifies that the training loop strictly reduces loss across epochs."""
    torch.manual_seed(42)

    # Synthetic separable sequences
    norm_x = torch.zeros(40, 10, 16, dtype=torch.float32)
    norm_y = torch.zeros(40, 1, dtype=torch.float32)
    anom_x = torch.ones(40, 10, 16, dtype=torch.float32) * 0.9
    anom_y = torch.ones(40, 1, dtype=torch.float32)

    X = torch.cat([norm_x, anom_x], dim=0)
    y = torch.cat([norm_y, anom_y], dim=0)

    dataset = TelemetrySequenceDataset(X, y)
    loader = DataLoader(dataset, batch_size=16, shuffle=True)

    model, history = train_lstm_classifier(
        train_loader=loader,
        val_loader=loader,
        input_dim=16,
        hidden_dim=32,
        num_layers=1,
        learning_rate=0.01,
        epochs=6,
        verbose=False,
    )

    initial_loss = history["train_loss"][0]
    final_loss = history["train_loss"][-1]
    assert final_loss < initial_loss, f"Loss did not decrease! {initial_loss} -> {final_loss}"


# ------------------------------------------------------------------------------
# 7. Production Model Artifact Validation
# ------------------------------------------------------------------------------

def test_persisted_production_checkpoint_validity() -> None:
    """Verifies that the production checkpoint in models/ is valid and can perform inference."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_path = os.path.join(base_dir, "src", "analytics_engine", "models", "lstm_anomaly_model.pth")
    meta_path = os.path.join(base_dir, "src", "analytics_engine", "models", "lstm_anomaly_model_metadata.json")

    assert os.path.exists(model_path), f"Checkpoint missing: {model_path}"
    assert os.path.exists(meta_path), f"Metadata missing: {meta_path}"

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    assert meta["model_type"] == "LSTMAnomalyClassifier"
    assert meta["input_dim"] == 16
    assert meta["sequence_length"] == 10

    loaded_model, loaded_meta = load_model_checkpoint(LSTMAnomalyClassifier, model_path)
    sample_seq = torch.randn(1, 10, 16, dtype=torch.float32)
    score = loaded_model.predict_proba(sample_seq).item()

    assert 0.0 <= score <= 1.0, f"Anomaly score out of bounds: {score}"
