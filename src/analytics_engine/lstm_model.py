"""
AELA Analytics Engine - Deep Learning Model Architectures (Re-export / Compatibility Layer)
Exposes LSTMAnomalyClassifier, LSTMAutoencoder, save_model_checkpoint, and load_model_checkpoint
defined in src.analytics_engine.model.
"""

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

__all__ = [
    "DEFAULT_HIDDEN_DIM",
    "DEFAULT_INPUT_DIM",
    "DEFAULT_LATENT_DIM",
    "DEFAULT_SEQ_LEN",
    "LSTMAnomalyClassifier",
    "LSTMAutoencoder",
    "load_model_checkpoint",
    "save_model_checkpoint",
]
