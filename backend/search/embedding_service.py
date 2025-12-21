"""
Embedding service using SigLIP 2 for image and text embeddings.
Uses MPS (Apple Silicon) with CPU fallback.
"""

import logging
import threading
from pathlib import Path
from typing import Optional

import numpy as np
import torch
from PIL import Image

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Singleton service for generating embeddings using SigLIP 2."""

    _instance: Optional["EmbeddingService"] = None
    _initialized: bool = False
    _init_lock: threading.Lock = threading.Lock()

    # SigLIP 2 ViT-B model - 86M params, 768-dim embeddings
    MODEL_NAME = "google/siglip2-base-patch16-224"
    EMBEDDING_DIM = 768

    def __new__(cls) -> "EmbeddingService":
        if cls._instance is None:
            with cls._init_lock:
                # Double-check after acquiring lock
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        # Only initialize once
        if EmbeddingService._initialized:
            return

        self.model = None
        self.processor = None
        self.device = None
        self._model_lock = threading.Lock()
        EmbeddingService._initialized = True

    def _ensure_loaded(self) -> None:
        """Lazy-load the model on first use. Thread-safe."""
        if self.model is not None:
            return

        with self._model_lock:
            # Double-check after acquiring lock (another thread may have loaded)
            if self.model is not None:
                return

            logger.info(f"Loading SigLIP 2 model: {self.MODEL_NAME}")

            # Import here to avoid slow startup
            from transformers import AutoModel, AutoProcessor

            # Load model and processor with automatic device placement
            self.processor = AutoProcessor.from_pretrained(self.MODEL_NAME)
            self.model = AutoModel.from_pretrained(self.MODEL_NAME, device_map="auto")
            self.model.eval()

            # Get actual device from model
            self.device = next(self.model.parameters()).device
            logger.info(f"Model loaded on device: {self.device}")

            logger.info("SigLIP 2 model loaded successfully")

    def embed_image(self, image_path: str | Path) -> np.ndarray:
        """
        Generate embedding for an image file.

        Args:
            image_path: Path to the image file

        Returns:
            768-dimensional numpy array
        """
        self._ensure_loaded()

        image = Image.open(image_path).convert("RGB")
        inputs = self.processor(images=image, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = self.model.get_image_features(**inputs)
            # Normalize the embedding
            embedding = outputs / outputs.norm(dim=-1, keepdim=True)

        return embedding.cpu().numpy().flatten()

    def embed_text(self, text: str) -> np.ndarray:
        """
        Generate embedding for a text query.

        Args:
            text: Text query to embed

        Returns:
            768-dimensional numpy array
        """
        self._ensure_loaded()

        inputs = self.processor(text=[text], return_tensors="pt", padding=True)
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = self.model.get_text_features(**inputs)
            # Normalize the embedding
            embedding = outputs / outputs.norm(dim=-1, keepdim=True)

        return embedding.cpu().numpy().flatten()

    def embed_images_batch(self, image_paths: list[str | Path]) -> np.ndarray:
        """
        Generate embeddings for multiple images in a batch.

        Args:
            image_paths: List of paths to image files

        Returns:
            Array of shape (n_images, 768)
        """
        self._ensure_loaded()

        images = [Image.open(p).convert("RGB") for p in image_paths]
        inputs = self.processor(images=images, return_tensors="pt", padding=True)
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = self.model.get_image_features(**inputs)
            embeddings = outputs / outputs.norm(dim=-1, keepdim=True)

        return embeddings.cpu().numpy()


# Global singleton instance
_embedding_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    """Get the global embedding service instance."""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
