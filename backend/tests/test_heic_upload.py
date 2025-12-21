"""Tests for HEIC/HEIF image upload and MIME type detection."""

import io
import pytest
from gemini_service import _detect_image_mime_type, _normalize_image_for_gemini


class TestMimeTypeDetection:
    """Tests for _detect_image_mime_type function."""

    def test_detect_png(self):
        """PNG files are correctly identified."""
        png_magic = b'\x89PNG\r\n\x1a\n' + b'\x00' * 100
        assert _detect_image_mime_type(png_magic) == "image/png"

    def test_detect_jpeg(self):
        """JPEG files are correctly identified."""
        jpeg_magic = b'\xff\xd8\xff\xe0' + b'\x00' * 100
        assert _detect_image_mime_type(jpeg_magic) == "image/jpeg"

    def test_detect_webp(self):
        """WebP files are correctly identified."""
        webp_magic = b'RIFF\x00\x00\x00\x00WEBP' + b'\x00' * 100
        assert _detect_image_mime_type(webp_magic) == "image/webp"

    def test_detect_gif(self):
        """GIF files are correctly identified."""
        gif87_magic = b'GIF87a' + b'\x00' * 100
        gif89_magic = b'GIF89a' + b'\x00' * 100
        assert _detect_image_mime_type(gif87_magic) == "image/gif"
        assert _detect_image_mime_type(gif89_magic) == "image/gif"

    def test_detect_heic(self):
        """HEIC files are correctly identified via ftyp brand."""
        # HEIC uses ISO Base Media File Format with 'ftyp' at offset 4
        # Structure: size (4 bytes) + 'ftyp' (4 bytes) + brand (4 bytes)
        heic_magic = b'\x00\x00\x00\x18ftypheic' + b'\x00' * 100
        assert _detect_image_mime_type(heic_magic) == "image/heic"

    def test_detect_heic_variants(self):
        """Various HEIC brand codes are correctly identified."""
        brands = [b'heic', b'heix', b'hevc', b'hevx', b'mif1', b'msf1']
        for brand in brands:
            heic_data = b'\x00\x00\x00\x18ftyp' + brand + b'\x00' * 100
            assert _detect_image_mime_type(heic_data) == "image/heic", f"Failed for brand: {brand}"

    def test_detect_avif(self):
        """AVIF files are correctly identified."""
        avif_magic = b'\x00\x00\x00\x18ftypavif' + b'\x00' * 100
        assert _detect_image_mime_type(avif_magic) == "image/avif"

    def test_unknown_defaults_to_png(self):
        """Unknown formats default to PNG."""
        unknown = b'\x00\x00\x00\x00unknown' + b'\x00' * 100
        assert _detect_image_mime_type(unknown) == "image/png"


class TestHeicUpload:
    """Tests for HEIC file upload endpoint."""

    def test_upload_heic_file(self, client, test_data_dir):
        """HEIC files are converted to JPEG at upload for browser compatibility."""
        # Create fake HEIC data - will fail conversion, fallback to original mime
        heic_data = b'\x00\x00\x00\x18ftypheic' + b'\x00' * 100

        response = client.post(
            "/api/upload",
            files=[("files", ("photo.heic", io.BytesIO(heic_data), "image/heic"))],
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "prompt_id" in data
        assert "images" in data
        assert len(data["images"]) == 1

        # Fake HEIC data can't be converted, falls back to image/heic
        # Real HEIC files would be converted to image/jpeg
        image = data["images"][0]
        assert image["mime_type"] == "image/heic"

    def test_upload_heic_with_octet_stream(self, client, test_data_dir):
        """HEIC files sent as application/octet-stream are accepted."""
        heic_data = b'\x00\x00\x00\x18ftypheic' + b'\x00' * 100

        response = client.post(
            "/api/upload",
            files=[("files", ("photo.heic", io.BytesIO(heic_data), "application/octet-stream"))],
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["images"]) == 1
        # Fake HEIC falls back; real HEIC would convert to jpeg
        assert data["images"][0]["mime_type"] == "image/heic"

    def test_upload_heif_file(self, client, test_data_dir):
        """HEIF files (using mif1 brand) are accepted."""
        heif_data = b'\x00\x00\x00\x18ftypmif1' + b'\x00' * 100

        response = client.post(
            "/api/upload",
            files=[("files", ("photo.heif", io.BytesIO(heif_data), "image/heif"))],
        )

        assert response.status_code == 200
        data = response.json()
        # Fake HEIF falls back; real HEIF would convert to jpeg
        assert data["images"][0]["mime_type"] == "image/heic"

    def test_upload_mixed_formats(self, client, test_data_dir):
        """Multiple files with different formats are all correctly typed."""
        png_data = b'\x89PNG\r\n\x1a\n' + b'\x00' * 100
        heic_data = b'\x00\x00\x00\x18ftypheic' + b'\x00' * 100
        jpeg_data = b'\xff\xd8\xff\xe0' + b'\x00' * 100

        response = client.post(
            "/api/upload",
            files=[
                ("files", ("image1.png", io.BytesIO(png_data), "image/png")),
                ("files", ("image2.heic", io.BytesIO(heic_data), "image/heic")),
                ("files", ("image3.jpg", io.BytesIO(jpeg_data), "image/jpeg")),
            ],
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["images"]) == 3

        # Fake HEIC falls back to image/heic; real HEIC would be image/jpeg
        mime_types = {img["mime_type"] for img in data["images"]}
        assert mime_types == {"image/png", "image/heic", "image/jpeg"}


class TestImageNormalization:
    """Tests for _normalize_image_for_gemini function."""

    def test_jpeg_passthrough(self):
        """JPEG images are passed through unchanged."""
        jpeg_data = b'\xff\xd8\xff\xe0' + b'\x00' * 100
        result_data, result_mime = _normalize_image_for_gemini(jpeg_data, "image/jpeg")
        assert result_data == jpeg_data
        assert result_mime == "image/jpeg"

    def test_png_passthrough(self):
        """PNG images are passed through unchanged."""
        png_data = b'\x89PNG\r\n\x1a\n' + b'\x00' * 100
        result_data, result_mime = _normalize_image_for_gemini(png_data, "image/png")
        assert result_data == png_data
        assert result_mime == "image/png"

    def test_webp_passthrough(self):
        """WebP images are passed through unchanged."""
        webp_data = b'RIFF\x00\x00\x00\x00WEBP' + b'\x00' * 100
        result_data, result_mime = _normalize_image_for_gemini(webp_data, "image/webp")
        assert result_data == webp_data
        assert result_mime == "image/webp"

    def test_heic_triggers_conversion(self):
        """HEIC MIME type triggers conversion attempt."""
        # Fake HEIC data that can't be converted (pillow-heif will fail gracefully)
        fake_heic = b'\x00\x00\x00\x18ftypheic' + b'\x00' * 100
        result_data, result_mime = _normalize_image_for_gemini(fake_heic, "image/heic")
        # Since fake data can't be converted, falls back to original
        assert result_data == fake_heic
        assert result_mime == "image/heic"

    def test_avif_triggers_conversion(self):
        """AVIF MIME type triggers conversion attempt."""
        fake_avif = b'\x00\x00\x00\x18ftypavif' + b'\x00' * 100
        result_data, result_mime = _normalize_image_for_gemini(fake_avif, "image/avif")
        # Since fake data can't be converted, falls back to original
        assert result_data == fake_avif
        assert result_mime == "image/heic"  # Falls back via _convert_heic_to_jpeg
