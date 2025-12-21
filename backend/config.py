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
DEFAULT_FAST_TEXT_MODEL = (
    "gemini-3-flash-preview"  # Fast model for analysis and polish operations
)

# =============================================================================
# Timeouts
# =============================================================================
GEMINI_TIMEOUT_MS = int(os.environ.get("GEMINI_TIMEOUT_MS", "300000"))  # 200 seconds

# =============================================================================
# Paths
# =============================================================================
BACKEND_DIR = Path(__file__).parent
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
