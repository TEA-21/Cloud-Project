"""
AELA Analytics Engine - Deep Learning Model Architectures
Phase 2: PyTorch LSTM Network Architectures for Sequence-Based Anomaly Detection

Architectures:
  1. LSTMAnomalyClassifier: Supervised sequence classifier predicting anomaly probability (BCE loss).
  2. LSTMAutoencoder: Unsupervised sequence autoencoder computing reconstruction error (MSE loss).
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional, Tuple, Type

import torch
import torch.nn as nn

DEFAULT_INPUT_DIM: int = 16
DEFAULT_SEQ_LEN: int = 10
DEFAULT_HIDDEN_DIM: int = 64
DEFAULT_LATENT_DIM: int = 32


class LSTMAnomalyClassifier(nn.Module):
    """
    Recurrent Neural Network leveraging stacked Long Short-Term Memory (LSTM) cells
    to classify multi-step access sequences as normal or anomalous.

    Architecture:
      Input (batch_size, seq_len=10, input_dim=16)
      -> Stacked LSTM (num_layers=2, hidden_dim=64, dropout=0.2)
      -> Last Time-Step Hidden State Extraction
      -> Dense Linear (hidden_dim -> hidden_dim // 2) + ReLU + Dropout
      -> Output Linear (hidden_dim // 2 -> 1)
    """

    def __init__(
        self,
        input_dim: int = DEFAULT_INPUT_DIM,
        hidden_dim: int = DEFAULT_HIDDEN_DIM,
        num_layers: int = 2,
        dropout: float = 0.2,
        bidirectional: bool = False,
    ) -> None:
        super().__init__()
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers
        self.bidirectional = bidirectional
        self.num_directions = 2 if bidirectional else 1

        self.lstm = nn.LSTM(
            input_size=input_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
            bidirectional=bidirectional,
        )

        fc_in_dim = hidden_dim * self.num_directions
        self.fc1 = nn.Linear(fc_in_dim, hidden_dim // 2)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(dropout)
        self.fc2 = nn.Linear(hidden_dim // 2, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass for anomaly classification.
        
        Args:
            x: Tensor of shape (batch_size, seq_len, input_dim)
            
        Returns:
            Logits tensor of shape (batch_size, 1)
        """
        # lstm_out: (batch_size, seq_len, hidden_dim * num_directions)
        lstm_out, _ = self.lstm(x)

        # Extract representation from the final time-step of the sequence
        last_time_step = lstm_out[:, -1, :]  # Shape: (batch_size, hidden_dim * num_directions)

        dense1 = self.dropout(self.relu(self.fc1(last_time_step)))
        logits = self.fc2(dense1)  # Shape: (batch_size, 1)
        return logits

    def predict_proba(self, x: torch.Tensor) -> torch.Tensor:
        """Computes calibrated anomaly probabilities in [0.0, 1.0] via sigmoid activation."""
        self.eval()
        with torch.no_grad():
            logits = self.forward(x)
            return torch.sigmoid(logits)


class LSTMAutoencoder(nn.Module):
    """
    Unsupervised LSTM Autoencoder for Sequence Reconstruction Anomaly Detection.
    Normal telemetry sequences yield minimal MSE reconstruction error; anomalous patterns
    deviate significantly from learned transitions and yield elevated MSE.

    Architecture:
      Encoder: Input (batch_size, seq_len=10, input_dim=16) -> LSTM -> Latent Vector (B, latent_dim=32)
      Decoder: Repeat Latent -> LSTM -> Linear -> Reconstructed Sequence (batch_size, seq_len=10, input_dim=16)
    """

    def __init__(
        self,
        input_dim: int = DEFAULT_INPUT_DIM,
        hidden_dim: int = DEFAULT_HIDDEN_DIM,
        latent_dim: int = DEFAULT_LATENT_DIM,
        seq_len: int = DEFAULT_SEQ_LEN,
        dropout: float = 0.1,
    ) -> None:
        super().__init__()
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.latent_dim = latent_dim
        self.seq_len = seq_len

        # Encoder
        self.encoder_lstm = nn.LSTM(
            input_size=input_dim,
            hidden_size=hidden_dim,
            num_layers=1,
            batch_first=True,
        )
        self.encoder_fc = nn.Linear(hidden_dim, latent_dim)
        self.dropout = nn.Dropout(dropout)

        # Decoder
        self.decoder_fc = nn.Linear(latent_dim, hidden_dim)
        self.decoder_lstm = nn.LSTM(
            input_size=hidden_dim,
            hidden_size=hidden_dim,
            num_layers=1,
            batch_first=True,
        )
        self.output_fc = nn.Linear(hidden_dim, input_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass encoding and decoding the temporal sequence.
        
        Args:
            x: Tensor of shape (batch_size, seq_len, input_dim)
            
        Returns:
            Reconstructed tensor of shape (batch_size, seq_len, input_dim)
        """
        # 1. Encode
        _, (hn, _) = self.encoder_lstm(x)
        latent = self.dropout(self.encoder_fc(hn[-1]))  # (batch_size, latent_dim)

        # 2. Decode
        dec_in = self.decoder_fc(latent).unsqueeze(1).repeat(1, self.seq_len, 1)  # (B, seq_len, hidden_dim)
        dec_out, _ = self.decoder_lstm(dec_in)
        reconstructed = self.output_fc(dec_out)  # (B, seq_len, input_dim)

        return reconstructed

    def compute_reconstruction_error(self, x: torch.Tensor) -> torch.Tensor:
        """
        Computes Mean Squared Error (MSE) per sequence sample across all features and time steps.
        
        Returns:
            Tensor of shape (batch_size,) containing MSE reconstruction loss per sample.
        """
        self.eval()
        with torch.no_grad():
            reconstructed = self.forward(x)
            mse_per_sample = torch.mean((x - reconstructed) ** 2, dim=(1, 2))
            return mse_per_sample


# ------------------------------------------------------------------------------
# Checkpoint Serialization & Deserialization
# ------------------------------------------------------------------------------

def save_model_checkpoint(
    model: nn.Module,
    save_path: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Persists model weights (state_dict) and associated hyperparameter/evaluation metadata to disk.
    """
    os.makedirs(os.path.dirname(os.path.abspath(save_path)), exist_ok=True)
    torch.save(model.state_dict(), save_path)

    if metadata is not None:
        meta_path = os.path.splitext(save_path)[0] + "_metadata.json"
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)


def load_model_checkpoint(
    model_class: Type[nn.Module],
    checkpoint_path: str,
    device: str = "cpu",
    **model_kwargs: Any,
) -> Tuple[nn.Module, Dict[str, Any]]:
    """
    Loads saved model state_dict and metadata from disk, initializing an evaluation-ready model.
    """
    meta_path = os.path.splitext(checkpoint_path)[0] + "_metadata.json"
    metadata: Dict[str, Any] = {}
    if os.path.exists(meta_path):
        with open(meta_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)

    # Populate default kwargs from metadata if available
    resolved_kwargs = dict(model_kwargs)
    for key in ("input_dim", "hidden_dim", "num_layers", "latent_dim", "seq_len"):
        if key not in resolved_kwargs and key in metadata:
            resolved_kwargs[key] = metadata[key]

    model = model_class(**resolved_kwargs)
    state_dict = torch.load(checkpoint_path, map_location=device, weights_only=True)
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()

    return model, metadata
