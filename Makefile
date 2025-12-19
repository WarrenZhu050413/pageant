.PHONY: help dev frontend backend install clean stop preview build seed
.PHONY: stop-dev stop-preview
.PHONY: preview-frontend preview-backend

# Ports
DEV_FRONTEND_PORT = 5180
DEV_BACKEND_PORT = 8765
PREVIEW_FRONTEND_PORT = 4173
PREVIEW_BACKEND_PORT = 8766

# Default target
help:
	@echo "Pageant - Image Generation Studio"
	@echo ""
	@echo "Development (hot reload, fast iteration):"
	@echo "  make dev          - Start frontend + backend dev servers"
	@echo "  make frontend     - Start frontend only (port $(DEV_FRONTEND_PORT))"
	@echo "  make backend      - Start backend only (port $(DEV_BACKEND_PORT))"
	@echo "  make stop-dev     - Stop dev servers"
	@echo ""
	@echo "Preview (test production build locally):"
	@echo "  make build        - Build frontend for production"
	@echo "  make preview      - Start preview servers (auto-builds first)"
	@echo "  make preview-frontend  - Preview frontend only (port $(PREVIEW_FRONTEND_PORT))"
	@echo "  make preview-backend   - Preview backend only (port $(PREVIEW_BACKEND_PORT))"
	@echo "  make stop-preview - Stop preview servers"
	@echo ""
	@echo "Other:"
	@echo "  make stop         - Stop ALL servers (dev + preview)"
	@echo "  make install      - Install dependencies (bun + uv)"
	@echo "  make seed         - Load sample design tokens for demo"
	@echo "  make clean        - Clean build artifacts"
	@echo ""

# =============================================================================
# Development Mode
# =============================================================================
dev: stop-dev
	@echo "Starting Pageant (dev mode)..."
	@make -j2 frontend backend

frontend:
	bun run dev

backend:
	uv run uvicorn backend.server:app --host 0.0.0.0 --port $(DEV_BACKEND_PORT)

stop-dev:
	@echo "Stopping dev servers..."
	@-lsof -ti:$(DEV_FRONTEND_PORT) | xargs kill -9 2>/dev/null || true
	@-lsof -ti:$(DEV_BACKEND_PORT) | xargs kill -9 2>/dev/null || true
	@echo "Dev servers stopped."

# =============================================================================
# Preview Mode (Production Build Testing)
# =============================================================================
preview: build stop-preview
	@echo "Starting Pageant (preview mode)..."
	@echo "Starting backend..."
	@uv run uvicorn backend.server:app --host 0.0.0.0 --port $(PREVIEW_BACKEND_PORT) & \
	echo "Waiting for backend to be ready..." && \
	for i in 1 2 3 4 5 6 7 8 9 10; do \
		if curl -s http://localhost:$(PREVIEW_BACKEND_PORT)/api/settings > /dev/null 2>&1; then \
			echo "Backend ready!"; \
			break; \
		fi; \
		sleep 0.5; \
	done && \
	echo "Starting frontend..." && \
	bun run preview

preview-frontend:
	@-lsof -ti:$(PREVIEW_FRONTEND_PORT) | xargs kill -9 2>/dev/null || true
	bun run preview

preview-backend:
	@-lsof -ti:$(PREVIEW_BACKEND_PORT) | xargs kill -9 2>/dev/null || true
	uv run uvicorn backend.server:app --host 0.0.0.0 --port $(PREVIEW_BACKEND_PORT)

stop-preview:
	@echo "Stopping preview servers..."
	@-lsof -ti:$(PREVIEW_FRONTEND_PORT) | xargs kill -9 2>/dev/null || true
	@-lsof -ti:$(PREVIEW_BACKEND_PORT) | xargs kill -9 2>/dev/null || true
	@echo "Preview servers stopped."

# =============================================================================
# Build & Utilities
# =============================================================================
build:
	@echo "Building frontend for production..."
	bun run build
	@echo "Build complete."

stop: stop-dev stop-preview
	@echo "All servers stopped."

install:
	@mkdir -p generated_images
	bun install
	uv sync
	@echo ""
	@echo "✓ Setup complete! Run 'make dev' to start."
	@echo "  (Recommended: 'make seed' to load sample design tokens)"

seed:
	@echo "Loading sample design tokens..."
	@cp -r sample_data/images/* generated_images/
	@cp sample_data/metadata.json generated_images/
	@echo "✓ Loaded 6 sample design tokens"
	@echo "  Run 'make dev' and check the Library tab"

clean:
	rm -rf node_modules dist .vite
	rm -rf backend/__pycache__ backend/.pytest_cache .pytest_cache
