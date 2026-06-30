import asyncio
import logging
import re
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import Application
from app.models.document import ApplicationDocument, DocumentType

logger = logging.getLogger(__name__)

PLATE_PATTERNS = [
    re.compile(r"\bGA[-\s]?\d{3,4}[-\s]?[A-Z]{1,3}\b", re.I),
    re.compile(r"\b\d{4}\s?[A-Z]{2}\s?\d{1,2}\b", re.I),
    re.compile(r"\b[A-Z]{2}\s?\d{3}\s?[A-Z]{2}\b", re.I),
    re.compile(r"\b\d{3,4}\s?[A-Z]{2,3}\b", re.I),
]

DATE_PATTERN = re.compile(
    r"\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b"
)

COMPANY_HINTS = (
    "proprietaire",
    "propriétaire",
    "titulaire",
    "raison sociale",
    "denomination",
    "dénomination",
    "entreprise",
    "societe",
    "société",
)


def _normalize_plate(raw: str) -> str:
    cleaned = re.sub(r"\s+", " ", raw.upper().strip())
    cleaned = cleaned.replace("GA ", "GA-").replace("GA-", "GA-")
    return cleaned


def _extract_plate(text: str) -> str | None:
    for pattern in PLATE_PATTERNS:
        match = pattern.search(text.upper())
        if match:
            return _normalize_plate(match.group(0))
    return None


def _extract_company_name(text: str) -> str | None:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for index, line in enumerate(lines):
        lower = line.lower()
        for hint in COMPANY_HINTS:
            if hint in lower:
                if ":" in line:
                    value = line.split(":", 1)[1].strip()
                    if len(value) >= 3:
                        return value[:255]
                if index + 1 < len(lines):
                    candidate = lines[index + 1].strip()
                    if len(candidate) >= 3 and not DATE_PATTERN.search(candidate):
                        return candidate[:255]
    return None


def _extract_dates(text: str) -> list[str]:
    dates: list[str] = []
    for match in DATE_PATTERN.finditer(text):
        day, month, year = match.groups()
        if len(year) == 2:
            year = f"20{year}"
        dates.append(f"{day.zfill(2)}/{month.zfill(2)}/{year}")
    return dates


def _extract_text_from_file_sync(file_path: Path, content_type: str) -> str:
    suffix = file_path.suffix.lower()
    is_pdf = "pdf" in content_type.lower() or suffix == ".pdf"
    is_image = (
        content_type.lower().startswith("image/")
        or suffix in {".jpg", ".jpeg", ".png", ".webp"}
    )

    if is_pdf:
        try:
            import fitz  # pymupdf

            text_parts: list[str] = []
            with fitz.open(file_path) as pdf:
                for page in pdf:
                    text_parts.append(page.get_text())
                    if len("".join(text_parts)) > 50:
                        break
            combined = "\n".join(text_parts).strip()
            if combined:
                return combined
            with fitz.open(file_path) as pdf:
                if pdf.page_count > 0:
                    pix = pdf[0].get_pixmap(matrix=fitz.Matrix(2, 2))
                    return _ocr_image_bytes(pix.tobytes("png"))
        except Exception:
            logger.exception("Extraction PDF OCR échouée pour %s", file_path)

    if is_image:
        return _ocr_image_file(file_path)

    return ""


def _ocr_image_file(file_path: Path) -> str:
    try:
        from PIL import Image

        return _ocr_image_bytes(Image.open(file_path))
    except Exception:
        logger.exception("OCR image échoué pour %s", file_path)
        return ""


def _ocr_image_bytes(image_source) -> str:
    try:
        import pytesseract
        from PIL import Image

        if isinstance(image_source, (bytes, bytearray)):
            from io import BytesIO

            image = Image.open(BytesIO(image_source))
        else:
            image = image_source
        return pytesseract.image_to_string(image, lang="fra").strip()
    except Exception:
        logger.warning("Tesseract indisponible ou OCR image impossible")
        return ""


def parse_document_fields(document_type: DocumentType, text: str) -> dict[str, str]:
    if not text or len(text.strip()) < 5:
        return {}

    fields: dict[str, str] = {}
    plate = _extract_plate(text)
    if plate:
        fields["vehicle_plate"] = plate

    if document_type == DocumentType.CARTE_GRISE:
        company = _extract_company_name(text)
        if company:
            fields["company_name"] = company

    dates = _extract_dates(text)
    if document_type == DocumentType.VISITE_TECHNIQUE and dates:
        fields["technical_inspection_date"] = dates[0]
    if document_type == DocumentType.ASSURANCE and dates:
        fields["insurance_expiry"] = dates[-1]

    return fields


def apply_fields_to_application(
    application: Application,
    fields: dict[str, str],
) -> list[str]:
    applied: list[str] = []

    if fields.get("vehicle_plate") and not application.vehicle_plate:
        application.vehicle_plate = fields["vehicle_plate"]
        applied.append("vehicle_plate")

    if fields.get("company_name") and not application.company_name:
        application.company_name = fields["company_name"]
        applied.append("company_name")

    note_parts: list[str] = []
    if fields.get("technical_inspection_date"):
        note_parts.append(f"Visite technique (OCR): {fields['technical_inspection_date']}")
    if fields.get("insurance_expiry"):
        note_parts.append(f"Assurance expire (OCR): {fields['insurance_expiry']}")

    if note_parts and not application.notes:
        application.notes = " | ".join(note_parts)
        applied.append("notes")
    elif note_parts:
        for part in note_parts:
            if part not in (application.notes or ""):
                application.notes = f"{application.notes} | {part}".strip(" |")
                applied.append("notes")
                break

    return applied


async def process_document_ocr(
    db: AsyncSession,
    application: Application,
    document: ApplicationDocument,
    file_path: Path,
) -> dict:
    text = await asyncio.to_thread(
        _extract_text_from_file_sync, file_path, document.content_type
    )
    fields = parse_document_fields(document.document_type, text)

    document.ocr_text = text[:12000] if text else None
    document.ocr_fields = fields or None

    applied = apply_fields_to_application(application, fields) if fields else []
    await db.flush()

    return {
        "fields": fields,
        "applied": applied,
        "text_preview": (text[:280] + "…") if text and len(text) > 280 else text,
    }
