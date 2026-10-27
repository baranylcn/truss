FROM python:3.15-slim

WORKDIR /app


COPY pyproject.toml .
RUN mkdir -p app && touch app/__init__.py \
    && pip install --no-cache-dir . \
    && rm -rf app

COPY app ./app
COPY alembic.ini .
COPY alembic ./alembic

ENV PYTHONUNBUFFERED=1

# Apply database migrations before starting the server. The baseline is already
# stamped on existing databases, so `upgrade head` is a no-op until a real
# migration is added.
CMD alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000
