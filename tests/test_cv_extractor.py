"""Unit tests for bounded, deterministic CV text extraction."""

import unittest
from io import BytesIO

from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from src.services.cv_extractor import CVExtractionError, extract_synthetic_cv


class CVExtractorTests(unittest.TestCase):
    @staticmethod
    def _text_pdf() -> bytes:
        output = BytesIO()
        writer = PdfWriter()
        page = writer.add_blank_page(width=612, height=792)
        font = DictionaryObject({
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        })
        font_ref = writer._add_object(font)
        page[NameObject("/Resources")] = DictionaryObject({
            NameObject("/Font"): DictionaryObject({NameObject("/F1"): font_ref})
        })
        content = DecodedStreamObject()
        content.set_data(b"BT /F1 12 Tf 50 700 Td (Skills) Tj 0 -18 Td (Python, Data analysis) Tj ET")
        page[NameObject("/Contents")] = writer._add_object(content)
        writer.write(output)
        return output.getvalue()

    def test_pdf_skill_text_is_extracted_and_aliases_are_suggestions_only(self):
        result = extract_synthetic_cv("fictional.pdf", "application/pdf", self._text_pdf())
        self.assertEqual([skill.canonical_name for skill in result.skills], ["Python programming", "Data analysis"])
        self.assertTrue(all(skill.resolution == "exact_local_alias_match" for skill in result.skills))
        self.assertIn("proficiency is not inferred", " ".join(result.warnings))

    def test_pdf_with_no_selectable_text_is_reported_as_scanned_or_empty(self):
        output = BytesIO()
        writer = PdfWriter()
        writer.add_blank_page(width=612, height=792)
        writer.write(output)
        with self.assertRaisesRegex(CVExtractionError, "No selectable text"):
            extract_synthetic_cv("synthetic.pdf", "application/pdf", output.getvalue())

    def test_rejects_unsupported_and_oversized_uploads(self):
        with self.assertRaisesRegex(CVExtractionError, "Only PDF and DOCX"):
            extract_synthetic_cv("notes.txt", "text/plain", b"sample")
        with self.assertRaisesRegex(CVExtractionError, "2 MB"):
            extract_synthetic_cv("large.pdf", "application/pdf", b"%PDF-" + b"x" * (2 * 1024 * 1024))


if __name__ == "__main__":
    unittest.main()
