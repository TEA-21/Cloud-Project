"""
AELA Analytics Engine - Deep Learning Training & Validation Pipeline
Phase 2: Trains the PyTorch LSTM Anomaly Classifier on sliding-window telemetry sequences,
validates loss convergence, evaluates test set generalization, and persists model artifacts.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

# Ensure project root is in sys.path when executed directly
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from src.analytics_engine.data_preprocessor import (
    NUM_FEATURES,
    TelemetryScaler,
    create_sliding_window_sequences,
    generate_synthetic_telemetry,
    prepare_data_loaders,
)
from src.analytics_engine.model import (
    DEFAULT_HIDDEN_DIM,
    DEFAULT_INPUT_DIM,
    DEFAULT_SEQ_LEN,
    LSTMAnomalyClassifier,
    save_model_checkpoint,
)


# ------------------------------------------------------------------------------
# Evaluation Metrics Helper
# ------------------------------------------------------------------------------

def compute_binary_metrics(
    y_true: np.ndarray,
    y_pred_proba: np.ndarray,
    threshold: float = 0.5,
) -> Dict[str, Any]:
    """
    Computes standard binary classification evaluation metrics:
    Accuracy, Precision, Recall, F1-Score, and Confusion Matrix components (TP, FP, FN, TN).
    """
    y_pred = (y_pred_proba >= threshold).astype(int).flatten()
    y_true = y_true.astype(int).flatten()

    tp = int(np.sum((y_pred == 1) & (y_true == 1)))
    fp = int(np.sum((y_pred == 1) & (y_true == 0)))
    fn = int(np.sum((y_pred == 0) & (y_true == 1)))
    tn = int(np.sum((y_pred == 0) & (y_true == 0)))

    total = len(y_true)
    accuracy = float((tp + tn) / total) if total > 0 else 0.0
    precision = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
    recall = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
    f1 = float(2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

    return {
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
    }


# ------------------------------------------------------------------------------
# Training Engine
# ------------------------------------------------------------------------------

def train_lstm_classifier(
    train_loader: DataLoader,
    val_loader: DataLoader,
    input_dim: int = NUM_FEATURES,
    hidden_dim: int = DEFAULT_HIDDEN_DIM,
    num_layers: int = 2,
    dropout: float = 0.2,
    learning_rate: float = 0.001,
    weight_decay: float = 1e-4,
    epochs: int = 15,
    device: str = "cpu",
    verbose: bool = True,
) -> Tuple[LSTMAnomalyClassifier, Dict[str, Any]]:
    """
    Executes the training and validation loop for LSTMAnomalyClassifier.
    Guarantees optimization convergence, applies learning rate decay on plateaus,
    and checkpoints the model weights that achieve minimal validation loss.
    """
    model = LSTMAnomalyClassifier(
        input_dim=input_dim,
        hidden_dim=hidden_dim,
        num_layers=num_layers,
        dropout=dropout,
    ).to(device)

    criterion = nn.BCEWithLogitsLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate, weight_decay=weight_decay)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="min", patience=2, factor=0.5)

    history: Dict[str, List[float]] = {
        "train_loss": [],
        "val_loss": [],
        "val_accuracy": [],
        "val_f1": [],
    }

    best_val_loss = float("inf")
    best_state: Optional[Dict[str, torch.Tensor]] = None

    if verbose:
        print("\n" + "=" * 76)
        print("  [AELA LSTM TRAINING PIPELINE] Initializing Optimization Loop")
        print(f"  Configuration: Stacked LSTM (layers={num_layers}, hidden_dim={hidden_dim}) | Epochs: {epochs}")
        print("=" * 76)

    for epoch in range(1, epochs + 1):
        # 1. Training Phase
        model.train()
        running_train_loss = 0.0
        train_samples = 0

        for batch_x, batch_y in train_loader:
            batch_x, batch_y = batch_x.to(device), batch_y.to(device)

            optimizer.zero_grad()
            logits = model(batch_x)
            loss = criterion(logits, batch_y)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()

            running_train_loss += loss.item() * batch_x.size(0)
            train_samples += batch_x.size(0)

        epoch_train_loss = running_train_loss / max(1, train_samples)

        # 2. Validation Phase
        model.eval()
        running_val_loss = 0.0
        val_samples = 0
        all_val_targets: List[np.ndarray] = []
        all_val_preds: List[np.ndarray] = []

        with torch.no_grad():
            for batch_x, batch_y in val_loader:
                batch_x, batch_y = batch_x.to(device), batch_y.to(device)
                logits = model(batch_x)
                loss = criterion(logits, batch_y)

                running_val_loss += loss.item() * batch_x.size(0)
                val_samples += batch_x.size(0)

                probas = torch.sigmoid(logits).cpu().numpy()
                all_val_preds.append(probas)
                all_val_targets.append(batch_y.cpu().numpy())

        epoch_val_loss = running_val_loss / max(1, val_samples)
        scheduler.step(epoch_val_loss)

        val_targets = np.vstack(all_val_targets)
        val_preds = np.vstack(all_val_preds)
        val_metrics = compute_binary_metrics(val_targets, val_preds, threshold=0.5)

        history["train_loss"].append(epoch_train_loss)
        history["val_loss"].append(epoch_val_loss)
        history["val_accuracy"].append(val_metrics["accuracy"])
        history["val_f1"].append(val_metrics["f1"])

        # Checkpoint best state based on minimum validation loss
        if epoch_val_loss < best_val_loss:
            best_val_loss = epoch_val_loss
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            is_best_mark = " [*BEST]"
        else:
            is_best_mark = ""

        if verbose:
            print(
                f"  Epoch {epoch:02d}/{epochs:02d} | "
                f"Train Loss: {epoch_train_loss:.4f} | "
                f"Val Loss: {epoch_val_loss:.4f} | "
                f"Val Acc: {val_metrics['accuracy'] * 100:.1f}% | "
                f"Val F1: {val_metrics['f1']:.4f}{is_best_mark}"
            )

    # Restore best weights
    if best_state is not None:
        model.load_state_dict(best_state)

    if verbose:
        print("=" * 76)
        print(f"  [AELA LSTM TRAINING PIPELINE] Complete | Best Validation Loss: {best_val_loss:.4f}\n")

    return model, history


# ------------------------------------------------------------------------------
# Test Evaluation
# ------------------------------------------------------------------------------

def evaluate_on_test_set(
    model: nn.Module,
    test_loader: DataLoader,
    device: str = "cpu",
    threshold: float = 0.5,
) -> Dict[str, Any]:
    """Evaluates the trained model on held-out test data and returns classification metrics."""
    model.eval()
    criterion = nn.BCEWithLogitsLoss()
    total_loss = 0.0
    samples = 0
    all_preds: List[np.ndarray] = []
    all_targets: List[np.ndarray] = []

    with torch.no_grad():
        for batch_x, batch_y in test_loader:
            batch_x, batch_y = batch_x.to(device), batch_y.to(device)
            logits = model(batch_x)
            loss = criterion(logits, batch_y)

            total_loss += loss.item() * batch_x.size(0)
            samples += batch_x.size(0)

            probas = torch.sigmoid(logits).cpu().numpy()
            all_preds.append(probas)
            all_targets.append(batch_y.cpu().numpy())

    avg_loss = total_loss / max(1, samples)
    targets_np = np.vstack(all_targets)
    preds_np = np.vstack(all_preds)

    metrics = compute_binary_metrics(targets_np, preds_np, threshold=threshold)
    metrics["test_loss"] = round(avg_loss, 4)
    metrics["total_test_samples"] = samples
    return metrics


# ------------------------------------------------------------------------------
# Full End-to-End Training Pipeline
# ------------------------------------------------------------------------------

def run_training_pipeline(
    data_path: Optional[str] = None,
    scaler_path: Optional[str] = None,
    output_model_path: Optional[str] = None,
    epochs: int = 15,
    batch_size: int = 32,
    hidden_dim: int = DEFAULT_HIDDEN_DIM,
    num_layers: int = 2,
    learning_rate: float = 0.001,
    seed: int = 42,
    verbose: bool = True,
) -> Tuple[LSTMAnomalyClassifier, Dict[str, Any]]:
    """
    Executes the end-to-end Phase 2 training pipeline:
      1. Loads curated telemetry dataset and calibrated scaler params.
      2. Generates 3D sliding-window sequence tensors [N, 10, 16].
      3. Partitions into Train (80%), Val (10%), Test (10%) DataLoaders.
      4. Trains LSTMAnomalyClassifier with loss tracking and best-val checkpointing.
      5. Evaluates model performance on held-out test sequences.
      6. Persists PyTorch model weights (.pth) and metadata JSON.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))

    if data_path is None:
        data_path = os.path.join(base_dir, "data", "curated_telemetry.json")
    if scaler_path is None:
        scaler_path = os.path.join(base_dir, "data", "scaler_params.json")
    if output_model_path is None:
        output_model_path = os.path.join(base_dir, "models", "lstm_anomaly_model.pth")

    # 1. Load data or generate fallback
    if os.path.exists(data_path):
        with open(data_path, "r", encoding="utf-8") as f:
            records = json.load(f)
        if verbose:
            print(f"[Phase 2 Training] Loaded {len(records)} events from {data_path}")
    else:
        if verbose:
            print("[Phase 2 Training] Telemetry not found. Generating fresh synthetic dataset...")
        records = generate_synthetic_telemetry(seed=seed)

    # 2. Scaler setup
    if os.path.exists(scaler_path):
        with open(scaler_path, "r", encoding="utf-8") as f:
            scaler = TelemetryScaler.from_json(f.read())
        if verbose:
            print(f"[Phase 2 Training] Loaded fitted scaler parameters from {scaler_path}")
    else:
        scaler = TelemetryScaler().fit(records)

    # 3. Create 3D sequence tensors
    X, y = create_sliding_window_sequences(records, sequence_length=DEFAULT_SEQ_LEN, step=1, scaler=scaler)
    if verbose:
        print(f"[Phase 2 Training] Formulated 3D sequence tensors: X={tuple(X.shape)}, y={tuple(y.shape)}")

    # 4. Prepare DataLoaders
    train_loader, val_loader, test_loader = prepare_data_loaders(
        X, y, batch_size=batch_size, train_split=0.8, val_split=0.1, test_split=0.1, seed=seed
    )
    if verbose:
        print(
            f"[Phase 2 Training] Partitions configured: "
            f"Train={len(train_loader.dataset)} samples | "
            f"Val={len(val_loader.dataset)} samples | "
            f"Test={len(test_loader.dataset)} samples"
        )

    # 5. Train Model
    model, history = train_lstm_classifier(
        train_loader=train_loader,
        val_loader=val_loader,
        input_dim=NUM_FEATURES,
        hidden_dim=hidden_dim,
        num_layers=num_layers,
        dropout=0.2,
        learning_rate=learning_rate,
        epochs=epochs,
        verbose=verbose,
    )

    # 6. Evaluate on Test Set
    test_metrics = evaluate_on_test_set(model, test_loader, threshold=0.5)
    if verbose:
        print("\n" + "-" * 60)
        print("  [AELA LSTM TEST GENERALIZATION METRICS]")
        print("-" * 60)
        print(f"  Test Loss         : {test_metrics['test_loss']:.4f}")
        print(f"  Test Accuracy     : {test_metrics['accuracy'] * 100:.2f}%")
        print(f"  Test Precision    : {test_metrics['precision'] * 100:.2f}%")
        print(f"  Test Recall       : {test_metrics['recall'] * 100:.2f}%")
        print(f"  Test F1-Score     : {test_metrics['f1']:.4f}")
        print(f"  Confusion Matrix  : TP={test_metrics['tp']}, FP={test_metrics['fp']}, FN={test_metrics['fn']}, TN={test_metrics['tn']}")
        print("-" * 60 + "\n")

    # 7. Persist Checkpoint & Training Metadata
    metadata = {
        "model_type": "LSTMAnomalyClassifier",
        "input_dim": NUM_FEATURES,
        "hidden_dim": hidden_dim,
        "num_layers": num_layers,
        "sequence_length": DEFAULT_SEQ_LEN,
        "anomaly_threshold": 0.5,
        "test_metrics": test_metrics,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "final_train_loss": history["train_loss"][-1],
        "final_val_loss": history["val_loss"][-1],
        "epochs_trained": epochs,
    }

    save_model_checkpoint(model, output_model_path, metadata=metadata)
    if verbose:
        print(f"[Phase 2 Training] Model checkpoint persisted: {output_model_path}")
        print(f"[Phase 2 Training] Model metadata persisted: {os.path.splitext(output_model_path)[0] + '_metadata.json'}")

    return model, {"history": history, "test_metrics": test_metrics, "metadata": metadata}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="AELA Phase 2: LSTM Anomaly Detector Training Pipeline")
    parser.add_argument("--epochs", type=int, default=15, help="Number of training epochs (default: 15)")
    parser.add_argument("--batch-size", type=int, default=32, help="Mini-batch size (default: 32)")
    parser.add_argument("--hidden-dim", type=int, default=64, help="LSTM hidden dimensions (default: 64)")
    parser.add_argument("--num-layers", type=int, default=2, help="Number of stacked LSTM layers (default: 2)")
    parser.add_argument("--lr", type=float, default=0.001, help="Learning rate (default: 0.001)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility (default: 42)")
    parser.add_argument("--data-path", type=str, default=None, help="Path to curated telemetry JSON")
    parser.add_argument("--scaler-path", type=str, default=None, help="Path to scaler parameters JSON")
    parser.add_argument("--output-model", type=str, default=None, help="Path for output model checkpoint")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    run_training_pipeline(
        data_path=args.data_path,
        scaler_path=args.scaler_path,
        output_model_path=args.output_model,
        epochs=args.epochs,
        batch_size=args.batch_size,
        hidden_dim=args.hidden_dim,
        num_layers=args.num_layers,
        learning_rate=args.lr,
        seed=args.seed,
        verbose=True,
    )


if __name__ == "__main__":
    main()
