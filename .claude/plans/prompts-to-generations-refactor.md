# Refactor: prompts → generations

## Scope
- 127 files affected
- ~620 identifier occurrences to rename

## Naming Changes

| Old | New |
|-----|-----|
| `Prompt` (type) | `Generation` |
| `prompts` (array) | `generations` |
| `currentPromptId` | `currentGenerationId` |
| `setCurrentPrompt` | `setCurrentGeneration` |
| `getCurrentPrompt` | `getCurrentGeneration` |
| `promptFilter` | `generationFilter` |
| `setPromptFilter` | `setGenerationFilter` |
| `pendingPrompts` | `pendingGenerations` |
| `draftPrompts` | `draftGenerations` |
| `selectedPromptIds` | `selectedGenerationIds` |
| `togglePromptSelection` | `toggleGenerationSelection` |
| `selectAllPrompts` | `selectAllGenerations` |
| `clearPromptSelection` | `clearGenerationSelection` |
| `batchDeletePrompts` | `batchDeleteGenerations` |
| `PromptsTab` | `GenerationsTab` |
| `/api/prompts` | `/api/generations` |

## Execution Order

### Phase 1: Types (src/types/index.ts)
- Rename `Prompt` interface to `Generation`
- Keep `prompt` field inside (it's the text prompt used for generation)

### Phase 2: Store (src/store/index.ts)
- Rename all state properties
- Rename all actions
- Update all internal references

### Phase 3: API Layer (src/api/index.ts)
- Rename `fetchPrompts` → `fetchGenerations`
- Rename `deletePrompt` → `deleteGeneration`
- Update endpoint paths

### Phase 4: Components
- Rename PromptsTab.tsx → GenerationsTab.tsx
- Update all component imports and usages

### Phase 5: Backend (backend/server.py)
- Rename API routes
- Update metadata keys (prompts → generations)
- Migration for existing data

### Phase 6: Tests
- Update all test files

## Migration Strategy
- Backend will accept both old and new keys during transition
- Existing metadata.json files will be migrated on first load
