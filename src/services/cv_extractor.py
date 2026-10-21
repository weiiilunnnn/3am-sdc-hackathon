"""Small, deterministic CV text extractors. Uploaded bytes are never persisted."""

from __future__ import annotations

import re
import zipfile
from collections import OrderedDict
from io import BytesIO
from xml.etree import ElementTree

from pypdf import PdfReader

from src.data.skills_taxonomy import find_skill_by_label
from src.models.cv import CVExtraction, ExtractedSkill

MAX_UPLOAD_BYTES = 2 * 1024 * 1024
MAX_EXTRACTED_CHARS = 30_000
MAX_PDF_PAGES = 30
_SECTIONS = OrderedDict(
    (
        ("summary", {"summary", "professional summary", "profile", "about me", "career profile"}),
        ("skills", {"skills", "technical skills", "competencies", "core skills"}),
        ("experience", {"experience", "work experience", "employment", "professional experience"}),
        ("education", {"education", "academic background", "qualifications"}),
        ("projects", {"projects", "selected projects", "project experience"}),
        ("certifications", {"certifications", "certificates", "licenses"}),
        ("achievements", {"achievements", "awards", "honors"}),
    )
)
_SKILL_SPLIT = re.compile(r"[,;|•·\n]+")


class CVExtractionError(ValueError):
    """Raised for unsupported, corrupt, empty, or unparseable CV input."""


def _safe_text(value: str) -> str:
    cleaned = "".join(char for char in value if char in "\n\t" or ord(char) >= 32)
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    return cleaned[:MAX_EXTRACTED_CHARS]


def _pdf_text(payload: bytes) -> str:
    try:
        reader = PdfReader(BytesIO(payload), strict=True)
        if reader.is_encrypted:
            raise CVExtractionError("This encrypted PDF cannot be read. Use an unencrypted synthetic demo PDF.")
        if len(reader.pages) > MAX_PDF_PAGES:
            raise CVExtractionError(f"PDFs must contain no more than {MAX_PDF_PAGES} pages.")
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
    except CVExtractionError:
        raise
    except Exception as exc:
        raise CVExtractionError("This PDF is corrupt or could not be parsed.") from exc
    if not text.strip():
        raise CVExtractionError(
            "No selectable text was found. Scanned PDFs are not supported; no OCR or guessed content is used."
        )
    return _safe_text(text)


def _docx_text(payload: bytes) -> str:
    try:
        with zipfile.ZipFile(BytesIO(payload)) as archive:
            names = set(archive.namelist())
            if "[Content_Types].xml" not in names or "word/document.xml" not in names:
                raise CVExtractionError("This file is not a valid DOCX document.")
            if len(names) > 2000 or archive.getinfo("word/document.xml").file_size > 5 * 1024 * 1024:
                raise CVExtractionError("This DOCX document is too complex to parse safely.")
            root = ElementTree.fromstring(archive.read("word/document.xml"))
        ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        paragraphs = []
        for paragraph in root.findall(".//w:p", ns):
            text = "".join(node.text or "" for node in paragraph.findall(".//w:t", ns)).strip()
            if text:
                paragraphs.append(text)
    except CVExtractionError:
        raise
    except (zipfile.BadZipFile, KeyError, ElementTree.ParseError, OSError) as exc:
        raise CVExtractionError("This DOCX file is corrupt or could not be parsed.") from exc
    text = _safe_text("\n".join(paragraphs))
    if not text.strip():
        raise CVExtractionError("No readable text was found in this DOCX document.")
    return text


def _section_key(line: str) -> str | None:
    key = re.sub(r"[^a-z ]", "", line.casefold()).strip()
    return next((section for section, headings in _SECTIONS.items() if key in headings), None)


def _extract_sections(text: str) -> tuple[str | None, dict[str, list[str]]]:
    sections: dict[str, list[str]] = {key: [] for key in _SECTIONS if key != "summary"}
    summary: list[str] = []
    current: str | None = None
    for raw_line in text.splitlines():
        line = raw_line.strip(" \t•·-")
        if not line:
            continue
        heading = _section_key(line.rstrip(":"))
        if heading:
            current = heading
            continue
        if current == "summary":
            summary.append(line)
        elif current in sections:
            sections[current].append(line)

    # Keep the preview bounded and preserve wording instead of guessing titles or dates.
    bounded = {key: values[:40] for key, values in sections.items()}
    joined_summary = "\n".join(summary).strip()
    return (joined_summary[:1200] or None), bounded


def extract_synthetic_cv(filename: str, content_type: str, payload: bytes) -> CVExtraction:
    extension = filename.rsplit(".", 1)[-1].casefold() if "." in filename else ""
    if extension not in {"pdf", "docx"}:
        raise CVExtractionError("Only PDF and DOCX files are supported.")
    if len(payload) > MAX_UPLOAD_BYTES:
        raise CVExtractionError("Files must be 2 MB or smaller.")
    if not payload:
        raise CVExtractionError("The selected file is empty.")

    if extension == "pdf":
        if not payload.startswith(b"%PDF-") or content_type not in {"application/pdf", "application/octet-stream"}:
            raise CVExtractionError("The selected file does not appear to be a PDF.")
        text = _pdf_text(payload)
    else:
        if not payload.startswith(b"PK") or content_type not in {
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/octet-stream",
        }:
            raise CVExtractionError("The selected file does not appear to be a DOCX document.")
        text = _docx_text(payload)

    summary, sections = _extract_sections(text)
    extracted_skills: dict[str, ExtractedSkill] = {}
    for raw in sections["skills"]:
        for candidate in _SKILL_SPLIT.split(raw):
            label = candidate.strip()
            if not label or len(label) > 100:
                continue
            match = find_skill_by_label(label)
            skill_id = match["id"] if match else None
            key = skill_id or label.casefold()
            extracted_skills.setdefault(
                key,
                ExtractedSkill(
                    original_text=label,
                    canonical_name=match["name"] if match else None,
                    skill_id=skill_id,
                    resolution="exact_local_alias_match" if match else "unmatched_user_review_required",
                ),
            )

    warnings = [
        "Extraction is rule-based and may miss fields or preserve fragments; review and edit every item before saving.",
        "Skill proficiency is not inferred. Local vocabulary matches are suggestions, not official ESCO identifiers.",
        "Uploads are processed in memory and are not saved by this endpoint.",
    ]
    if not any(sections.values()) and not summary:
        warnings.append("No recognized section headings were found; review the document manually.")
    return CVExtraction(
        filename=filename[:120],
        summary=summary,
        sections=sections,
        skills=list(extracted_skills.values())[:40],
        warnings=warnings,
    )
