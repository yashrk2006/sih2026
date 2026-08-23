"""
OCR and Text Extraction Service.

Pipeline:
  1. Try PyMuPDF text layer extraction (fast, accurate for digital PDFs)
  2. If text is sparse/empty → fall back to OCR via Tesseract
  3. Preprocessing for scanned images: grayscale, denoise, threshold, deskew

Supports: PDF, scanned PDF, PNG, JPG, JPEG
"""
import os
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENCV_FOR_THREADS_NUM"] = "1"

import io
import logging
import re
from pathlib import Path
from typing import Optional

from PIL import Image

fitz = None

logger = logging.getLogger(__name__)

# Minimum character count below which we consider PDF text extraction failed
# and fall back to OCR
MIN_TEXT_CHARS_FOR_PDF = 50


def _preprocess_image_for_ocr(image: Image.Image) -> Image.Image:
    """
    Apply preprocessing to improve OCR accuracy on scanned documents.
    Steps: Convert to grayscale → denoise → threshold
    """
    try:
        import cv2
        import numpy as np
        cv2.setNumThreads(1)

        # Convert PIL → NumPy (BGR for OpenCV)
        img_array = np.array(image.convert("RGB"))
        img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)

        # Grayscale
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

        # Denoise
        denoised = cv2.fastNlMeansDenoising(gray, h=10)
    except Exception as e:
        logger.warning("OpenCV preprocessing skipped: %s", e)
        return image

    # Adaptive threshold (better for variable lighting)
    thresholded = cv2.adaptiveThreshold(
        denoised, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 11, 2
    )

    # Convert back to PIL
    return Image.fromarray(thresholded)


def _ocr_image(image: Image.Image) -> str:
    """Run Tesseract OCR on a PIL image."""
    try:
        import pytesseract
        preprocessed = _preprocess_image_for_ocr(image)
        config = "--oem 3 --psm 6"
        text = pytesseract.image_to_string(preprocessed, config=config)
        return text
    except Exception as e:
        logger.warning("Tesseract OCR failed: %s", e)
        return ""


def extract_text_from_pdf(pdf_bytes: bytes) -> dict:
    """
    Extract text from a PDF document.
    
    1. Try native text layer (digital PDF)
    2. If insufficient → render each page and OCR
    
    Returns:
        {
            "text": str,
            "method": "pdf_text" | "ocr_tesseract",
            "page_count": int,
            "confidence": float  (0-1 estimate)
        }
    """
    global fitz
    if fitz is None:
        try:
            import pymupdf as fitz
        except Exception as e:
            try:
                import fitz
            except Exception as e2:
                logger.warning("PyMuPDF not available: %s", e2)
                return {"text": "", "method": "pdf_failed", "page_count": 0, "confidence": 0.0}

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        logger.warning("PDF open failed: %s", e)
        return {"text": "", "method": "pdf_failed", "page_count": 0, "confidence": 0.0}
    page_count = len(doc)
    all_text = []

    # Try native text extraction
    for page in doc:
        all_text.append(page.get_text())

    combined_text = "\n".join(all_text).strip()

    if len(combined_text) >= MIN_TEXT_CHARS_FOR_PDF:
        logger.debug("PDF native text extraction succeeded: %d chars", len(combined_text))
        return {
            "text": combined_text,
            "method": "pdf_text",
            "page_count": page_count,
            "confidence": 0.95,
        }

    # Fallback: render pages and OCR
    logger.info("PDF text sparse (%d chars), falling back to OCR", len(combined_text))
    ocr_texts = []
    for page_num, page in enumerate(doc):
        mat = fitz.Matrix(2.0, 2.0)  # 2x zoom for better OCR
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        page_text = _ocr_image(img)
        if page_text:
            ocr_texts.append(f"--- Page {page_num + 1} ---\n{page_text}")

    full_ocr_text = "\n".join(ocr_texts).strip()
    return {
        "text": full_ocr_text or combined_text,
        "method": "ocr_tesseract",
        "page_count": page_count,
        "confidence": 0.70 if full_ocr_text else 0.30,
    }


def extract_text_from_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    """
    Extract text from an image file (JPG/PNG) via OCR.
    
    Returns same structure as extract_text_from_pdf.
    """
    try:
        image = Image.open(io.BytesIO(image_bytes))
        text = _ocr_image(image)
        return {
            "text": text.strip(),
            "method": "ocr_tesseract",
            "page_count": 1,
            "confidence": 0.70 if text.strip() else 0.20,
        }
    except Exception as e:
        logger.error("Image OCR failed: %s", e)
        return {"text": "", "method": "ocr_failed", "page_count": 1, "confidence": 0.0}


def extract_text(file_bytes: bytes, mime_type: str) -> dict:
    """
    Main entry point: extract text from any supported document type.
    
    Supported mime types:
      application/pdf
      image/jpeg, image/jpg, image/png
      text/plain
    """
    mime_type = mime_type.lower().strip()

    if mime_type == "application/pdf":
        return extract_text_from_pdf(file_bytes)
    elif mime_type in ("image/jpeg", "image/jpg", "image/png"):
        return extract_text_from_image(file_bytes, mime_type)
    elif mime_type == "text/plain":
        try:
            text = file_bytes.decode("utf-8", errors="replace")
        except Exception:
            text = ""
        return {"text": text, "method": "plain_text", "page_count": 1, "confidence": 1.0}
    else:
        logger.warning("Unsupported mime type for text extraction: %s", mime_type)
        return {"text": "", "method": "unsupported", "page_count": 0, "confidence": 0.0}
