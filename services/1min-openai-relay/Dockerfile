FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ALLOW_ALL_MODELS=true \
    HOST=0.0.0.0 \
    PORT=5001

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY models.py app.py ./

EXPOSE 5001

CMD ["gunicorn", "-b", "0.0.0.0:5001", "-w", "2", "--timeout", "300", "--keep-alive", "65", "app:app"]
