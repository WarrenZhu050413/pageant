"""Compile and export design tokens as portable taste profiles."""

import base64
from dataclasses import dataclass, asdict, field
from datetime import datetime
from pathlib import Path
from typing import Any


@dataclass
class TokenImageExport:
    """An image within a design token for export."""
    id: str
    image_path: str | None
    annotation: str | None
    liked_axes: dict[str, list[str]] | None
    # Optional: base64 encoded image data
    image_base64: str | None = None


@dataclass
class TokenExport:
    """A design token ready for export."""
    id: str
    name: str
    description: str | None
    images: list[TokenImageExport]
    prompts: list[str]
    concept_image_path: str | None
    concept_image_base64: str | None
    category: str | None
    tags: list[str]
    use_count: int
    creation_method: str
    extraction: dict | None


@dataclass
class TasteExportV2:
    """Portable design token library export (v2.0)."""
    schema_version: str = "2.0.0"
    exported_at: str = ""
    source: str = "pageant"
    tokens: list[TokenExport] = field(default_factory=list)
    summary: dict = field(default_factory=dict)


def compile_taste_export(
    metadata: dict,
    include_images: bool = False,
    images_dir: Path | None = None,
) -> TasteExportV2:
    """Compile taste export from design tokens.

    Args:
        metadata: The full metadata dict from Pageant
        include_images: Whether to include base64-encoded images
        images_dir: Path to images directory (required if include_images=True)

    Returns:
        TasteExportV2 with all design tokens
    """
    tokens_data = metadata.get("tokens", [])
    exported_tokens = []

    for token in tokens_data:
        # Build image exports
        token_images = []
        for img in token.get("images", []):
            img_export = TokenImageExport(
                id=img.get("id", ""),
                image_path=img.get("image_path"),
                annotation=img.get("annotation"),
                liked_axes=img.get("liked_axes"),
                image_base64=None,
            )

            # Include base64 image if requested
            if include_images and images_dir and img.get("image_path"):
                img_path = images_dir / img["image_path"]
                if img_path.exists():
                    img_export.image_base64 = base64.b64encode(
                        img_path.read_bytes()
                    ).decode("utf-8")

            token_images.append(img_export)

        # Handle concept image
        concept_base64 = None
        if include_images and images_dir and token.get("concept_image_path"):
            concept_path = images_dir / token["concept_image_path"]
            if concept_path.exists():
                concept_base64 = base64.b64encode(
                    concept_path.read_bytes()
                ).decode("utf-8")

        # Build token export
        token_export = TokenExport(
            id=token.get("id", ""),
            name=token.get("name", ""),
            description=token.get("description"),
            images=token_images,
            prompts=token.get("prompts", []),
            concept_image_path=token.get("concept_image_path"),
            concept_image_base64=concept_base64,
            category=token.get("category"),
            tags=token.get("tags", []),
            use_count=token.get("use_count", 0),
            creation_method=token.get("creation_method", "manual"),
            extraction=token.get("extraction"),
        )
        exported_tokens.append(token_export)

    # Build summary stats
    summary = {
        "total_tokens": len(exported_tokens),
        "total_images": sum(len(t.images) for t in exported_tokens),
        "categories": _count_categories(exported_tokens),
        "creation_methods": _count_creation_methods(exported_tokens),
    }

    return TasteExportV2(
        schema_version="2.0.0",
        exported_at=datetime.now().isoformat(),
        source="pageant",
        tokens=exported_tokens,
        summary=summary,
    )


def _count_categories(tokens: list[TokenExport]) -> dict[str, int]:
    """Count tokens per category."""
    counts: dict[str, int] = {}
    for token in tokens:
        cat = token.category or "uncategorized"
        counts[cat] = counts.get(cat, 0) + 1
    return counts


def _count_creation_methods(tokens: list[TokenExport]) -> dict[str, int]:
    """Count tokens per creation method."""
    counts: dict[str, int] = {}
    for token in tokens:
        method = token.creation_method or "unknown"
        counts[method] = counts.get(method, 0) + 1
    return counts


def export_to_dict(export: TasteExportV2) -> dict:
    """Convert TasteExportV2 to a JSON-serializable dict."""
    return {
        "schema_version": export.schema_version,
        "exported_at": export.exported_at,
        "source": export.source,
        "tokens": [
            {
                "id": t.id,
                "name": t.name,
                "description": t.description,
                "images": [asdict(img) for img in t.images],
                "prompts": t.prompts,
                "concept_image_path": t.concept_image_path,
                "concept_image_base64": t.concept_image_base64,
                "category": t.category,
                "tags": t.tags,
                "use_count": t.use_count,
                "creation_method": t.creation_method,
                "extraction": t.extraction,
            }
            for t in export.tokens
        ],
        "summary": export.summary,
    }
