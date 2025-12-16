"""MetadataManager: Centralized metadata operations for pageant."""

import json
import uuid
from datetime import datetime
from pathlib import Path


class MetadataManager:
    """Manages metadata loading, saving, and common operations.

    Centralizes the repeated load/save pattern used throughout server.py.

    Can be used as a context manager for atomic operations:
        with MetadataManager(path, dir) as data:
            data["prompts"].append(...)
        # Auto-saves on exit
    """

    def __init__(self, metadata_path: Path, images_dir: Path):
        """Initialize with paths to metadata file and images directory.

        Args:
            metadata_path: Path to metadata.json file
            images_dir: Path to generated_images directory
        """
        self.metadata_path = metadata_path
        self.images_dir = images_dir
        self._context_data: dict | None = None

    def __enter__(self) -> dict:
        """Enter context manager, loading metadata.

        Returns:
            dict: The loaded metadata dictionary
        """
        self._context_data = self.load()
        return self._context_data

    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:
        """Exit context manager, saving metadata.

        Saves data even if an exception occurred.

        Returns:
            bool: False to propagate any exception
        """
        if self._context_data is not None:
            self.save(self._context_data)
            self._context_data = None
        return False  # Don't suppress exceptions

    def load(self) -> dict:
        """Load existing metadata or create new with default structure.

        Handles migration from old 'images' array to 'prompts' structure.

        Returns:
            dict: The metadata dictionary
        """
        if self.metadata_path.exists():
            with open(self.metadata_path) as f:
                data = json.load(f)
                # Migration: ensure prompts structure exists
                if "prompts" not in data:
                    data["prompts"] = []
                    # Migrate old images to prompts if needed
                    if data.get("images"):
                        prompt_groups: dict[str, list] = {}
                        for img in data["images"]:
                            prompt_text = img.get("prompt", "Unknown")
                            if prompt_text not in prompt_groups:
                                prompt_groups[prompt_text] = []
                            prompt_groups[prompt_text].append(img)

                        for prompt_text, imgs in prompt_groups.items():
                            prompt_id = f"prompt-{uuid.uuid4().hex[:8]}"
                            data["prompts"].append({
                                "id": prompt_id,
                                "prompt": prompt_text,
                                "title": imgs[0].get("title", "Untitled"),
                                "category": imgs[0].get("category", "Custom"),
                                "created_at": imgs[0].get("generated_at", datetime.now().isoformat()),
                                "images": imgs,
                            })
                        data["images"] = []  # Clear old structure
                return data

        # Return default structure for new metadata
        return {
            "generated_at": datetime.now().isoformat(),
            "model": "gemini-2.5-flash-image",
            "prompts": [],
            "favorites": [],
            "templates": [],
            "stories": [],
            "collections": [],
            "sessions": [],
        }

    def save(self, data: dict) -> None:
        """Save metadata to disk.

        Args:
            data: The metadata dictionary to save
        """
        with open(self.metadata_path, "w") as f:
            json.dump(data, f, indent=2)

    def find_image_by_id(
        self, metadata: dict, image_id: str
    ) -> tuple[dict | None, dict | None]:
        """Find an image by ID and return its data along with parent prompt.

        Args:
            metadata: The metadata dictionary to search
            image_id: The image ID to find

        Returns:
            tuple: (image_data, prompt_data) if found, (None, None) otherwise
        """
        for prompt_data in metadata.get("prompts", []):
            for img in prompt_data.get("images", []):
                if img.get("id") == image_id:
                    return img, prompt_data
        return None, None

    def find_prompt_by_id(self, metadata: dict, prompt_id: str) -> dict | None:
        """Find a prompt by ID.

        Args:
            metadata: The metadata dictionary to search
            prompt_id: The prompt ID to find

        Returns:
            dict: The prompt data if found, None otherwise
        """
        return next(
            (p for p in metadata.get("prompts", []) if p.get("id") == prompt_id),
            None
        )
