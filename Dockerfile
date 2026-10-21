FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY src ./src
COPY runpod ./runpod
COPY data ./data
COPY scripts ./scripts
RUN python scripts/train_career_models.py

CMD ["python", "-u", "runpod/handler.py"]
