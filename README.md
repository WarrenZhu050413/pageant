# Pageant

An image generation studio built on Google's Gemini API.

Everything you'd want in an image experimentation interface: two-phase generation workflow, design tokens, collections, batch operations, and keyboard shortcuts. Fork it, hack on it, make cool stuff.

## Quick Start

```bash
# 1. Install Bun and uv (if you haven't)
curl -fsSL https://bun.sh/install | bash
curl -LsSf https://astral.sh/uv/install.sh | sh

# 2. Install dependencies
make install

# 3. Get your Gemini API key from Google AI Studio
#    https://aistudio.google.com/app/apikey
#    Click "Create API key" → copy it

# 4. Save the key
mkdir -p ~/.gemini
echo "your-key-here" > ~/.gemini/apikey.txt

# 5. Run
make dev
```

Open **http://localhost:5173** and start generating.

## Features

- **Two-Phase Generation**: Generate prompt variations first, refine them, then batch generate images
- **Design Tokens**: Extract reusable design concepts from images (colors, composition, mood, etc.)
- **View Modes**: Single image and Grid views for examining generations
- **Collections**: Group images into custom collections, add from any view
- **Context Images**: Use existing images as style references for new generations
- **Templates**: Save and reuse prompt templates
- **Favorites**: Star your best generations for quick access
- **Batch Operations**: Select multiple images for bulk actions
- **Keyboard Shortcuts**: Fast navigation and actions
- **Sessions & Notes**: Keep track of your creative process

## How It Works

### Two-Phase Generation

1. **Generate Prompts** (`POST /api/generate-prompts`) - Enter a base prompt, get AI-generated variations with annotation suggestions
2. **Refine** - Edit the variations, adjust annotations, select which to generate
3. **Generate Images** (`POST /api/generate-images`) - Batch generate images from your refined prompts

### Design Tokens

Extract reusable design concepts from your best images:
- Select images → Extract Token → Choose a design dimension
- Tokens capture style attributes (color palette, composition, mood, aesthetic)
- Apply tokens to new generations for consistent style

## Tech Stack

### Frontend

- **React 19** with TypeScript
- **Vite 7** for blazing-fast builds
- **Bun** as package manager and runtime
- **Tailwind CSS v4** with custom design system
- **Zustand** for state management
- **Framer Motion** for animations
- **Lucide React** for icons

### Backend

- **FastAPI** (Python)
- **Google Gemini API** for image generation
- **Pydantic** for structured outputs

## Project Structure

```
pageant/
├── src/
│   ├── api/              # API service layer
│   ├── store/            # Zustand state management (slices pattern)
│   ├── types/            # TypeScript type definitions
│   ├── hooks/            # Custom React hooks
│   └── components/
│       ├── ui/           # Reusable UI components (Button, Dialog, Input, etc.)
│       ├── layout/       # App shell and layout
│       ├── sidebar/      # Left sidebar (prompts, collections, library, etc.)
│       ├── stage/        # Main viewing area (SingleView, GridView, etc.)
│       └── panel/        # Right panel (GenerateTab, SettingsTab)
├── backend/
│   ├── server.py         # FastAPI application
│   ├── gemini_service.py # Gemini API integration
│   ├── metadata_manager.py # JSON persistence
│   └── prompts/          # Externalized prompt templates
└── e2e/                  # Playwright E2E tests
```

## Keyboard Shortcuts

| Key     | Action             |
| ------- | ------------------ |
| `1`     | Single view        |
| `2`     | Grid view          |
| `←` `→` | Navigate images    |
| `A`     | Add to context     |
| `F`     | Toggle favorite    |
| `S`     | Select mode        |
| `B`     | Batch mode         |
| `G`     | Go to Generate tab |
| `Esc`   | Exit current mode  |

## API Endpoints

### Generation (Two-Phase)

- `POST /api/generate-prompts` - Generate prompt variations from base prompt
- `POST /api/generate-images` - Batch generate images from prompts
- `POST /api/polish-prompts` - Polish/improve prompts

### Prompts

- `GET /api/prompts` - List all prompts
- `GET /api/prompts/:id` - Get single prompt
- `DELETE /api/prompts/:id` - Delete prompt

### Images

- `PATCH /api/images/:id/notes` - Update notes/annotation
- `DELETE /api/images/:id` - Delete image

### Design Tokens

- `GET /api/tokens` - List design tokens
- `POST /api/tokens` - Create token from images
- `DELETE /api/tokens/:id` - Delete token
- `POST /api/tokens/:id/use` - Apply token to generation
- `POST /api/suggest-dimensions` - AI-suggest dimensions from images

### Collections

- `GET /api/collections` - List collections
- `POST /api/collections` - Create collection
- `POST /api/collections/:id/images` - Add images to collection
- `DELETE /api/collections/:id/images` - Remove images
- `DELETE /api/collections/:id` - Delete collection

### Favorites

- `GET /api/favorites` - List favorites
- `POST /api/favorites` - Toggle favorite

### Batch Operations

- `POST /api/batch/delete` - Delete multiple images

### Templates

- `GET /api/templates` - List templates
- `POST /api/templates` - Create template
- `DELETE /api/templates/:id` - Delete template

### Settings

- `GET /api/settings` - Get settings
- `PUT /api/settings` - Update settings

### Upload & Export

- `POST /api/upload` - Upload images
- `GET /api/export/favorites` - Export favorites as ZIP

## Design System

### Typography

- **Display**: Playfair Display (headings)
- **Body**: DM Sans (UI text)
- **Mono**: IBM Plex Mono (code, metadata)

### Colors

- **Canvas**: Warm off-white backgrounds
- **Ink**: Deep charcoal text
- **Brass**: Golden accent color (#a08a5c)
- **Accent**: Deep teal for actions

## Development

```bash
# Start dev servers (frontend + backend)
make dev

# Run tests
bun run test

# Run linting
bun run lint

# Type check + build
bun run build

# Backend tests
uv run pytest backend/tests/
```

## Environment Variables

The Gemini API key can be configured via:

1. `~/.gemini/apikey.txt` (recommended, see Quick Start)
2. `GEMINI_API_KEY` environment variable
3. `GEMINI_API_KEY_PATH` pointing to a key file

## License

MIT
