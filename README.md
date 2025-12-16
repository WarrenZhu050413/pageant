# Pageant

**Image Generation Studio** - A React frontend for AI image generation with Gemini.

![Pageant Screenshot](https://via.placeholder.com/800x450?text=Pageant+Screenshot)

## Features

- **Three View Modes**: Single, Grid, and Compare views for examining generated images
- **Prompt Management**: Organize generations by prompt with thumbnails and metadata
- **Collections**: Group images into custom collections
- **Templates**: Save and reuse prompt templates
- **Favorites**: Star your best generations for quick access
- **Batch Operations**: Select multiple images for bulk actions
- **Keyboard Shortcuts**: Fast navigation and actions
- **Sessions & Notes**: Keep track of your creative process

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

## Quick Start

```bash
# Install frontend dependencies
bun install

# Install backend dependencies (using uv)
uv sync

# Create images directory (generated images will be stored here)
mkdir -p generated_images

# Start development servers
make dev
```

Or run frontend and backend separately:

```bash
# Terminal 1: Frontend
bun run dev

# Terminal 2: Backend
uv run uvicorn backend.server:app --port 8765
```

Visit **http://localhost:5173**

## Project Structure

```
pageant/
├── src/
│   ├── api/              # API service layer (27 endpoints)
│   ├── store/            # Zustand state management
│   ├── types/            # TypeScript type definitions
│   ├── hooks/            # Custom React hooks
│   └── components/
│       ├── ui/           # Reusable UI components
│       ├── layout/       # App shell and layout
│       ├── sidebar/      # Left sidebar (prompts, collections, etc.)
│       ├── stage/        # Main viewing area (single, grid, compare)
│       └── panel/        # Right panel (info, generate, settings)
├── backend/
│   ├── server.py         # FastAPI application
│   └── gemini_service.py # Gemini API integration
└── tests/                # Playwright UI tests
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | Single view |
| `2` | Grid view |
| `3` | Compare view |
| `←` `→` | Navigate images |
| `F` | Toggle favorite |
| `S` | Select mode |
| `B` | Batch mode |
| `G` | Go to Generate tab |
| `Esc` | Exit current mode |

## API Endpoints

### Prompts
- `GET /api/prompts` - List all prompts
- `GET /api/prompts/:id` - Get single prompt
- `DELETE /api/prompts/:id` - Delete prompt

### Generation
- `POST /api/generate` - Generate new images
- `POST /api/iterate/:imageId` - Create variations

### Images
- `PATCH /api/images/:id/notes` - Update notes/caption
- `DELETE /api/images/:id` - Delete image

### Favorites
- `GET /api/favorites` - List favorites
- `POST /api/favorites` - Toggle favorite

### Batch Operations
- `POST /api/batch/delete` - Delete multiple images
- `POST /api/batch/favorite` - Favorite multiple images

### Templates
- `GET /api/templates` - List templates
- `POST /api/templates` - Create template
- `DELETE /api/templates/:id` - Delete template

### Collections
- `GET /api/collections` - List collections
- `POST /api/collections` - Create collection
- `PATCH /api/collections/:id` - Update collection
- `DELETE /api/collections/:id` - Delete collection

### Settings
- `GET /api/settings` - Get settings
- `PUT /api/settings` - Update settings

### Upload & Export
- `POST /api/upload` - Upload images
- `GET /api/export/favorites` - Export favorites as ZIP
- `GET /api/export/gallery` - Export gallery as HTML

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
# Run linting
bun run lint

# Type check
bun run build

# Preview production build
bun run preview
```

## Environment Variables

Create a `.env` file:

```env
GEMINI_API_KEY=your_api_key_here
```

## License

MIT
