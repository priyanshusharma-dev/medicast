FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Seed DB and run first pipeline for MVP demo
RUN python data_generator.py
RUN python ml_pipeline.py

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
