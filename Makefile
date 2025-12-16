.PHONY: help dev frontend backend install clean restart stop

# Default target
help:
	@echo "Pageant - Image Generation Studio"
	@echo ""
	@echo "Commands:"
	@echo "  make dev       - Start both frontend and backend"
	@echo "  make restart   - Kill and restart both servers"
	@echo "  make stop      - Stop both servers"
	@echo "  make frontend  - Start frontend dev server (port 5173)"
	@echo "  make backend   - Start backend server (port 8765)"
	@echo "  make install   - Install all dependencies"
	@echo "  make clean     - Clean build artifacts"
	@echo ""

# Development
dev:
	@echo "Starting Pageant..."
	@make -j2 frontend backend

restart: stop
	@echo "Restarting Pageant..."
	@sleep 1
	@make -j2 frontend backend

stop:
	@echo "Stopping servers..."
	@-lsof -ti:5173 | xargs kill -9 2>/dev/null || true
	@-lsof -ti:8765 | xargs kill -9 2>/dev/null || true
	@echo "Servers stopped."

frontend:
	bun run dev

backend:
	uv run uvicorn backend.server:app --host 0.0.0.0 --port 8765

# Installation
install:
	bun install
	uv sync

# Cleanup
clean:
	rm -rf node_modules dist .vite
	rm -rf backend/__pycache__ backend/.pytest_cache .pytest_cache

# Build for production
build:
	bun run build
