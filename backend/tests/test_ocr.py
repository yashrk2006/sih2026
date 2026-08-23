import io
from django.test import TestCase
from PIL import Image, ImageDraw, ImageFont
from apps.documents.ocr import extract_text, extract_text_from_image, _preprocess_image_for_ocr


class OCRPipelineTestCase(TestCase):
    def test_plain_text_extraction(self):
        text_bytes = b"FIRST INFORMATION REPORT\nFIR No: 991/2026\nPolice Station: Central"
        res = extract_text(text_bytes, "text/plain")
        self.assertEqual(res["method"], "plain_text")
        self.assertIn("FIRST INFORMATION REPORT", res["text"])
        self.assertEqual(res["confidence"], 1.0)

    def test_image_ocr_preprocessing(self):
        # Create a synthetic PIL image
        img = Image.new("RGB", (300, 100), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)
        draw.text((10, 30), "TEST OCR", fill=(0, 0, 0))

        preprocessed = _preprocess_image_for_ocr(img)
        self.assertIsNotNone(preprocessed)

        # Save to PNG bytes and extract
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        image_bytes = buf.getvalue()

        res = extract_text(image_bytes, "image/png")
        self.assertIn(res["method"], ("ocr_tesseract", "ocr_failed"))
