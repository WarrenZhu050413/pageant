# Build frontend
FROM oven/bun:1 AS frontend-builder
WORKDIR /app

# Install frontend dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Build frontend
COPY . .
RUN bun run build

# Production image
FROM python:3.12-slim

# Install uv for fast Python package management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Install Python dependencies
COPY pyproject.toml ./
RUN uv sync --no-dev --no-install-project

# Copy backend code
COPY backend/ ./backend/

# Copy built frontend
COPY --from=frontend-builder /app/dist ./dist

# Create directories
RUN mkdir -p generated_images logs

# Copy sample data for first run
COPY sample_data/ ./sample_data/

# Environment
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/api/settings || exit 1

# Run with uv
CMD ["uv", "run", "uvicorn", "backend.server:app", "--host", "0.0.0.0", "--port", "8080"]
