"""Tests that server module imports work correctly when run as backend.server."""

import subprocess
import sys
from pathlib import Path


class TestServerImports:
    """Test that server can be imported as backend.server (how uvicorn runs it)."""

    def test_server_module_can_be_imported_as_backend_server(self):
        """
        When running 'uvicorn backend.server:app', Python imports the module as 'backend.server'.
        This test verifies the import works by running Python subprocess from project root.
        """
        project_root = Path(__file__).parent.parent.parent

        # Run Python from project root, importing backend.server as uvicorn would
        result = subprocess.run(
            [
                sys.executable, "-c",
                "import backend.server; print('Import successful')"
            ],
            cwd=project_root,
            capture_output=True,
            text=True,
            timeout=30,
        )

        assert result.returncode == 0, (
            f"Failed to import backend.server:\n"
            f"stdout: {result.stdout}\n"
            f"stderr: {result.stderr}"
        )
        assert "Import successful" in result.stdout

    def test_metadata_manager_importable_from_backend_package(self):
        """MetadataManager should be importable via backend.metadata_manager."""
        project_root = Path(__file__).parent.parent.parent

        result = subprocess.run(
            [
                sys.executable, "-c",
                "from backend.metadata_manager import MetadataManager; print('Import successful')"
            ],
            cwd=project_root,
            capture_output=True,
            text=True,
            timeout=30,
        )

        assert result.returncode == 0, (
            f"Failed to import backend.metadata_manager:\n"
            f"stdout: {result.stdout}\n"
            f"stderr: {result.stderr}"
        )
