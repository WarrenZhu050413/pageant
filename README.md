# Pageant

My interface for vibe-creating with nano-banana pro. It's built around two ideas:

### 1. Context Engineering for Image Models

Prompts are only half the story. What images you attach, what you say about them, what preferences you express—that's the context that shapes what you get back.

Pageant makes this easy:

- **Auto-selected reference images.** Gemini picks which images to attach to each prompt variation based on what you're trying to achieve.
- **Annotations that travel with images.** Annotate an image, like specific design axes (color palette, composition, mood), and those preferences get sent as context whenever the image is attached.
- **Design Tokens.** Extract a core visual concept from an image—isolate the thing that makes it work—and apply it to future generations.

### 2. Batch Experimentation

Great art comes from lots of experimentation. Pageant is built for volume:

- Enter one prompt idea → Gemini generates *n* variations, each with its own reference images and annotations
- Fire off many prompt sets in parallel, no waiting
- Refine what works, discard what doesn't, iterate fast

![Pageant UI - Prompt Refinement](docs/screenshot-1.png)

![Pageant UI - Design Token Gallery](docs/screenshot-2.png)

## Quick Start

```bash
# Install Bun and uv (if you haven't)
curl -fsSL https://bun.sh/install | bash
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies + seed data
make install

# Get your Gemini API key from Google AI Studio
# https://aistudio.google.com/app/apikey

# Save the key
mkdir -p ~/.gemini
echo "your-key-here" > ~/.gemini/apikey.txt

# Run
make dev
```

Open **http://localhost:5173**.

> **Tip:** `make install` includes sample design tokens and concept images so you can explore the UI right away.

## Other Features

- **View Modes**: Single and Grid (`1`/`2` keys)
- **Collections**: Group images into collections
- **Templates**: Save reusable prompt structures
- **Favorites**: Star images (`F` key)
- **Keyboard navigation**: `←`/`→` to move through images

## Tech Stack

**Frontend**: React 19, TypeScript, Vite 7, Bun, Tailwind CSS v4, Zustand, Framer Motion

**Backend**: FastAPI, Google Gemini API, Pydantic

## Development

```bash
make dev          # Start frontend + backend
bun run test      # Run tests
bun run lint      # Lint
bun run build     # Type check + build
```

## API Key

Checked in order:
1. `~/.gemini/apikey.txt`
2. `GEMINI_API_KEY` env var
3. `GEMINI_API_KEY_PATH` pointing to key file

## License

MIT
