"""Compile and export portable visual taste profiles."""

from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Any


@dataclass
class ExemplarImage:
    """An image that exemplifies the user's taste."""
    id: str
    filename: str
    detected_tags: list[str]
    liked_axes: dict[str, list[str]]
    notes: str | None
    taste_score: float


@dataclass
class VisualTasteExport:
    """Portable visual taste profile export."""
    schema_version: str
    exported_at: str
    source: str
    taste: dict
    exemplars: dict


def compile_taste_export(
    metadata: dict,
    include_images: bool = True,
    top_n_exemplars: int = 20,
    min_weight_threshold: float = 0.3,
) -> VisualTasteExport:
    """Compile full taste export from metadata.

    Args:
        metadata: The full metadata dict from Pageant
        include_images: Whether to include image data (for future base64 support)
        top_n_exemplars: Number of top exemplar images to include
        min_weight_threshold: Minimum weight for including tags in prompt fragment

    Returns:
        VisualTasteExport with taste profile and exemplars
    """
    # 1. Get or compile preferences
    user_prefs = metadata.get("user_preferences", {})
    axis_weights = user_prefs.get("axis_weights", {})

    # If no pre-compiled weights, compute them from raw data
    if not axis_weights:
        axis_weights = _compute_axis_weights(metadata)

    # 2. Generate prompt fragment from top preferences
    prompt_fragment = _build_prompt_fragment(axis_weights, min_weight_threshold)

    # 3. Find exemplar images (liked images with highest taste alignment)
    exemplars = _find_exemplars(metadata, axis_weights, top_n_exemplars)

    # 4. Build export
    return VisualTasteExport(
        schema_version="0.1.0",
        exported_at=datetime.now().isoformat(),
        source="pageant",
        taste={
            "axes": axis_weights,
            "summary": user_prefs.get("summary", ""),
            "prompt_fragment": prompt_fragment,
        },
        exemplars={
            "images": [asdict(e) for e in exemplars],
            "total_rated": _count_rated(metadata),
            "total_liked": user_prefs.get("total_liked", 0),
        }
    )


def _build_prompt_fragment(axis_weights: dict, threshold: float) -> str:
    """Extract top preferences into comma-separated prompt fragment.

    Args:
        axis_weights: Dict of axis -> tag -> weight
        threshold: Minimum weight to include

    Returns:
        Comma-separated string of top tags
    """
    terms = []
    for axis, weights in axis_weights.items():
        for tag, weight in weights.items():
            if weight >= threshold:
                terms.append((tag, weight))

    # Sort by weight descending and take top 10
    terms.sort(key=lambda x: x[1], reverse=True)
    return ", ".join(t[0] for t in terms[:10])


def _find_exemplars(
    metadata: dict,
    axis_weights: dict,
    top_n: int
) -> list[ExemplarImage]:
    """Find images that best represent the taste profile.

    Args:
        metadata: Full metadata dict
        axis_weights: Compiled preference weights
        top_n: Maximum number of exemplars to return

    Returns:
        List of ExemplarImage sorted by taste alignment score
    """
    candidates: list[tuple[dict[str, Any], float]] = []

    # Check generated images
    for prompt in metadata.get("prompts", []):
        for img in prompt.get("images", []):
            liked = img.get("liked_axes", {})
            if liked:
                score = _calc_taste_score(liked, axis_weights)
                candidates.append((img, score))

    # Check preference images (from Unsplash download flow)
    for img in metadata.get("preference_images", []):
        liked = img.get("liked_axes", {})
        vote = img.get("vote")
        if liked or vote in ("like", "super"):
            score = _calc_taste_score(liked, axis_weights)
            if vote == "super":
                score *= 1.5  # Boost super-likes
            candidates.append((img, score))

    # Sort by score, take top N
    candidates.sort(key=lambda x: x[1], reverse=True)

    exemplars = []
    for img, score in candidates[:top_n]:
        exemplars.append(ExemplarImage(
            id=img["id"],
            filename=img.get("image_path") or img.get("filename", ""),
            detected_tags=img.get("design_tags", []) or _get_annotation_tags(img),
            liked_axes=img.get("liked_axes", {}),
            notes=img.get("notes"),
            taste_score=round(score, 2),
        ))

    return exemplars


def _calc_taste_score(liked_axes: dict, axis_weights: dict) -> float:
    """Calculate how well an image's liked axes match the taste profile.

    Args:
        liked_axes: Dict of axis -> list of liked tags for this image
        axis_weights: Dict of axis -> tag -> weight from compiled preferences

    Returns:
        Score from 0.0 to 1.0+ indicating alignment with taste profile
    """
    if not liked_axes or not axis_weights:
        return 0.0

    total_score = 0.0
    total_possible = 0.0

    for axis, tags in liked_axes.items():
        weights = axis_weights.get(axis, {})
        for tag in tags:
            if tag in weights:
                total_score += weights[tag]
            total_possible += 1.0

    return total_score / max(total_possible, 1.0)


def _get_annotation_tags(img: dict) -> list[str]:
    """Extract all tags from annotations field.

    Args:
        img: Image dict that may have annotations

    Returns:
        Flat list of all annotation tags
    """
    tags = []
    annotations = img.get("annotations", {})
    for axis_tags in annotations.values():
        if isinstance(axis_tags, list):
            tags.extend(axis_tags)
    return tags


def _count_rated(metadata: dict) -> int:
    """Count total images with any rating/preference.

    Args:
        metadata: Full metadata dict

    Returns:
        Count of images that have been rated
    """
    count = 0
    for prompt in metadata.get("prompts", []):
        for img in prompt.get("images", []):
            if img.get("liked_axes") or img.get("design_tags"):
                count += 1
    for img in metadata.get("preference_images", []):
        if img.get("vote") or img.get("liked_axes"):
            count += 1
    return count


def _compute_axis_weights(metadata: dict) -> dict[str, dict[str, float]]:
    """Compute normalized axis weights from raw liked_axes data.

    Args:
        metadata: Full metadata dict

    Returns:
        Dict of axis -> tag -> normalized weight (0.0 to 1.0)
    """
    # Count raw preferences
    counts: dict[str, dict[str, int]] = {}
    max_count = 0

    # Aggregate from generated images
    for prompt in metadata.get("prompts", []):
        for img in prompt.get("images", []):
            liked_axes = img.get("liked_axes", {})
            for axis, tags in liked_axes.items():
                if axis not in counts:
                    counts[axis] = {}
                for tag in tags:
                    if tag not in counts[axis]:
                        counts[axis][tag] = 0
                    counts[axis][tag] += 1
                    max_count = max(max_count, counts[axis][tag])

    # Aggregate from preference images
    for img in metadata.get("preference_images", []):
        liked_axes = img.get("liked_axes", {})
        vote = img.get("vote")
        multiplier = 1.5 if vote == "super" else 1.0

        for axis, tags in liked_axes.items():
            if axis not in counts:
                counts[axis] = {}
            for tag in tags:
                if tag not in counts[axis]:
                    counts[axis][tag] = 0
                counts[axis][tag] += int(multiplier)
                max_count = max(max_count, counts[axis][tag])

    # Normalize to 0.0-1.0 weights
    if max_count == 0:
        return {}

    weights: dict[str, dict[str, float]] = {}
    for axis, tag_counts in counts.items():
        weights[axis] = {}
        for tag, count in tag_counts.items():
            weights[axis][tag] = round(count / max_count, 2)

    return weights
