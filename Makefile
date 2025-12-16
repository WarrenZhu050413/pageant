.PHONY: help dev frontend backend install clean

# Default target
help:
	@echo "Pageant - Image Generation Studio"
	@echo ""
	@echo "Commands:"
	@echo "  make dev       - Start both frontend and backend"
	@echo "  make frontend  - Start frontend dev server (port 5173)"
	@echo "  make backend   - Start backend server (port 8765)"
	@echo "  make install   - Install all dependencies"
	@echo "  make clean     - Clean build artifacts"
	@echo ""

# Development
dev:
	@echo "Starting Pageant..."
	@make -j2 frontend backend

frontend:
	bun run dev

backend:
	cd backend && uv run uvicorn server:app --reload --host 0.0.0.0 --port 8765

# Installation
install:
	bun install
	cd backend && uv sync

# Cleanup
clean:
	rm -rf node_modules dist .vite
	cd backend && rm -rf __pycache__ .pytest_cache

# Build for production
build:
	bun run build
