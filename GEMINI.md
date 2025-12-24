# Pageant

Pageant is an image generation studio built on Google's Gemini API, designed for "context engineering" and batch experimentation. It allows users to refine prompts, manage reference images with annotations, and extract "design tokens" to maintain consistent visual styles across generations.

## Project Overview

*   **Goal:** Provide a high-leverage interface for interacting with image generation models (specifically Gemini), focusing on iterative refinement and context management rather than just one-off prompting.
*   **Key Features:**
    *   **Context Engineering:** Attach images with specific design axes (color, mood, composition) that the model respects.
    *   **Batch Experimentation:** Generate multiple prompt variations and resulting images in parallel.
    *   **Design Tokens:** Extract and reuse core visual concepts.
    *   **Local-First:** Images and metadata are stored locally.

## Architecture

### Frontend (React + Zustand)
*   **Stack:** React 19, TypeScript, Vite 7, Bun, Tailwind CSS v4, Zustand.
*   **Store** (`src/store/`): Zustand store with slices for generation, selection, session, navigation, and library state.
*   **API Layer** (`src/api/`): Endpoint handlers with generic fetcher utilities.
*   **UI Structure:** Three-pane layout (Sidebar -> Main Stage -> Right Panel).
*   **Communication:** Proxies API requests to the Python backend via Vite config.

### Backend (FastAPI)
*   **Stack:** Python 3.11+, FastAPI, Google Generative AI SDK (`google-genai`).
*   **Entry Point:** `backend/server.py`.
*   **Data Storage:** Local filesystem.
    *   Images: `generated_images/`
    *   Metadata: `generated_images/metadata.json` (managed by `MetadataManager`).
*   **AI Service:** `backend/gemini_service.py` handles interactions with the Gemini API.

### Data Flow
- Frontend proxies API calls through Vite dev server to backend at `:8765`.
- Images stored in `generated_images/` directory.
- All metadata persisted to single `metadata.json` file.

## Key Patterns

### Two-Phase Generation
1.  `POST /api/generate-prompts` - Generate prompt variations from a single prompt.
2.  User edits/refines variations.
3.  `POST /api/generate-images` - Batch generate images from refined variations.

### Design Axis System
Images can be tagged on multiple design axes (colors, composition, mood, layout, aesthetic). The system tracks user preferences via the `liked_axes` field on images.

### Store Slices
State is organized into modular slices in `src/store/slices/`:
-   `generationSlice` - generation status, pending prompts
-   `selectionSlice` - selection mode, selected IDs
-   `sessionSlice` - current session tracking
-   `navigationSlice` - current prompt/image, view modes
-   `librarySlice` - library items management

## GitHub Issues Workflow

GitHub Issues is the **single source of truth** for tracking bugs, features, and improvements. It serves as persistent memory across sessions and a first place to check when problems arise.

### Core Principle

**Every identified problem or feature MUST have a GitHub issue.** Before starting any work, check if an issue already exists. If not, create one.

### Workflow

#### 1. Identify & Create Issue
When you identify a bug, new feature, or improvement:
```bash
# Check existing issues first
gh issue list
gh issue list --state all | grep -i "keyword"

# Create new issue if none exists
gh issue create --title "Short description" --label "bug,size:small" --body "..."
```

**Issue body contains:**
- Description of the problem/feature
- Current behavior (for bugs)
- Expected/desired behavior
- Relevant context (files, screenshots, error messages)

**Issue body does NOT contain:**
- The fix or implementation plan (that goes in comments)

#### 2. Plan in Comments
Add the fix/implementation plan as **comments** on the issue:
```bash
gh issue comment 123 --body "## Plan
1. Update X in file Y
2. Add tests for Z
3. ..."
```

Multiple comments are fine as the plan evolves.

#### 3. Implement & Test
- Write tests that verify the fix/feature
- Implement the solution
- Ensure `bun run build` passes

#### 4. Commit & Close
**IMPORTANT: Always commit BEFORE closing the issue.** Never close an issue without first committing the related changes.

Commit with issue reference:
```bash
git commit -m "Short description

- Detail 1
- Detail 2
- Tests: src/path/to/test.ts

Fixes #123"
```

Then close with a summary comment:
```bash
gh issue comment 123 --body "Fixed in commit abc1234. Tests added in src/path/to/test.ts"
# Issue auto-closes from "Fixes #123" in commit message
```

### Size Labels
- `size:small` - Quick fixes, renames, single-file changes
- `size:medium` - Multi-file features, moderate refactors
- `size:large` - Architectural changes, major features

### Quick Reference
```bash
gh issue list                         # Open issues
gh issue list --state all             # All issues (check for regressions)
gh issue view 123                     # Read issue details
gh issue comment 123 --body "..."     # Add plan/update
gh issue close 123                    # Close manually
gh issue reopen 123                   # Reopen if regression found
```

## Building and Running

### Prerequisites
*   **Bun:** JavaScript runtime and package manager.
*   **uv:** Python package manager.
*   **Gemini API Key:** Required for generation.

### Setup
1.  **Install Dependencies:**
    ```bash
    make install
    ```
2.  **Configure API Key:**
    Create `~/.gemini/apikey.txt` containing your Google Gemini API key, or set the `GEMINI_API_KEY` environment variable.

### Development
*   **Start All (Frontend + Backend):**
    ```bash
    make dev
    ```
    Access the app at `http://localhost:5180`.

*   **Frontend Only:** `make frontend`
*   **Backend Only:** `make backend` (runs on port 8765)

### Testing
*   **Frontend (Vitest):**
    ```bash
    bun run test          # Watch mode
    bun run test:run      # Single run
    bun run test:coverage # Coverage report
    ```
*   **Backend (Pytest):**
    ```bash
    uv run pytest backend/tests/
    ```

### Linting and Building
*   **Lint:** `bun run lint` (ESLint)
*   **Build:** `bun run build` (TypeScript check + Vite bundle)

## Configuration

Gemini API key location (checked in order):
1. `~/.gemini/apikey.txt`
2. `GEMINI_API_KEY` environment variable
3. `GEMINI_API_KEY_PATH` pointing to key file