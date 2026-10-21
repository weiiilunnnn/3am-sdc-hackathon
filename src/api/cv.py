"""Synthetic-only CV text extraction endpoint."""

from fastapi import APIRouter, HTTPException, Request

from src.models.cv import CVExtraction
from src.services.cv_extractor import CVExtractionError, MAX_UPLOAD_BYTES, extract_synthetic_cv

router = APIRouter(prefix="/api")


@router.post("/profiles/extract-cv", response_model=CVExtraction)
async def extract_cv(request: Request) -> CVExtraction:
    if request.headers.get("x-synthetic-demo-confirmed", "").casefold() != "true":
        raise HTTPException(status_code=400, detail="Confirm that the uploaded CV is fictional demo data only.")
    filename = request.headers.get("x-filename", "")
    content_type = request.headers.get("content-type", "").split(";", 1)[0].casefold()
    if not filename or len(filename) > 200:
        raise HTTPException(status_code=400, detail="A valid PDF or DOCX filename is required.")

    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Files must be 2 MB or smaller.")
        chunks.append(chunk)
    try:
        return extract_synthetic_cv(filename, content_type, b"".join(chunks))
    except CVExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
