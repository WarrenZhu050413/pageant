"""Centralized configuration for the Pageant backend.

All constants, environment variables, and configuration loading logic
lives here for easy auditing and modification.
"""

import os
from pathlib import Path

# =============================================================================
# Models
# =============================================================================
DEFAULT_TEXT_MODEL = "gemini-3-pro-preview"
DEFAULT_IMAGE_MODEL = "gemini-3-pro-image-preview"

# =============================================================================
# Paths
# =============================================================================
BACKEND_DIR = Path(__file__).parent
PROMPTS_DIR = BACKEND_DIR / "prompts"
GENERATED_IMAGES_DIR = BACKEND_DIR.parent / "generated_images"
METADATA_FILE = BACKEND_DIR.parent / "metadata.json"

# =============================================================================
# API Key Loading
# =============================================================================
def get_gemini_api_key() -> str:
    """Load Gemini API key from environment or file.

    Priority:
    1. GEMINI_API_KEY environment variable (direct key)
    2. GEMINI_API_KEY_PATH environment variable (path to file)
    3. ~/.gemini/apikey.txt (default location)

    Raises:
        ValueError: If no API key is found
    """
    # 1. Direct environment variable
    if key := os.environ.get("GEMINI_API_KEY"):
        return key

    # 2. Path from environment variable
    if key_path_str := os.environ.get("GEMINI_API_KEY_PATH"):
        key_path = Path(key_path_str)
        if key_path.exists():
            return key_path.read_text().strip()

    # 3. Default location
    default_path = Path.home() / ".gemini" / "apikey.txt"
    if default_path.exists():
        return default_path.read_text().strip()

    # Fallback to backup location
    backup_path = Path.home() / ".gemini" / "apikey_backup.txt"
    if backup_path.exists():
        return backup_path.read_text().strip()

    raise ValueError(
        "Gemini API key not found. Set GEMINI_API_KEY env var or create ~/.gemini/apikey.txt"
    )

# =============================================================================
# Prompt Loading
# =============================================================================
def load_prompt(name: str) -> str:
    """Load a prompt template from the prompts directory.

    Args:
        name: Prompt filename without extension (e.g., "variation_structured", "iteration")

    Returns:
        The prompt template content

    Raises:
        FileNotFoundError: If the prompt file doesn't exist
    """
    prompt_path = PROMPTS_DIR / f"{name}.txt"
    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt file not found: {prompt_path}")
    return prompt_path.read_text()


def load_variation_prompt() -> str:
    """Load the default variation prompt template."""
    return load_prompt("variation_structured")


def load_iteration_prompt() -> str:
    """Load the default iteration prompt template."""
    return load_prompt("iteration")
