// Data Models - matching backend structures

// Design Axis System - for tagging and preference tracking
export const DESIGN_AXES = {
  typeface: ['sans-serif', 'serif', 'monospace', 'display', 'handwritten'],
  colors: ['monochromatic', 'complementary', 'analogous', 'vibrant', 'muted', 'pastel', 'warm', 'cool'],
  layout: ['centered', 'asymmetric', 'grid', 'organic', 'dense', 'spacious'],
  mood: ['elegant', 'minimal', 'ornate', 'playful', 'serious', 'bold', 'subtle'],
  composition: ['close-up', 'wide', 'rule-of-thirds', 'symmetrical'],
  style: ['photorealistic', 'illustrated', '3D', 'line-art', 'collage', 'retro', 'modern', 'futuristic'],
} as const;

export type DesignAxis = keyof typeof DESIGN_AXES;

// LikedAxes stores specific tag values that were liked per axis
// e.g., { typeface: ["sans-serif"], mood: ["elegant", "minimal"] }
export interface LikedAxes {
  typeface?: string[];
  colors?: string[];
  layout?: string[];
  mood?: string[];
  composition?: string[];
  style?: string[];
}

export interface DesignPreferences {
  typeface: Record<string, number>;
  colors: Record<string, number>;
  layout: Record<string, number>;
  mood: Record<string, number>;
  composition: Record<string, number>;
  style: Record<string, number>;
}

export interface ImageData {
  id: string;
  image_path: string;
  mime_type: string;
  generated_at: string;
  varied_prompt?: string;
  mood?: string;
  variation_type?: string;
  notes?: string;
  caption?: string;
  // Design axis system
  design_tags?: string[];
  liked_axes?: LikedAxes;
}

export interface Prompt {
  id: string;
  prompt: string;
  title: string;
  category: string;
  created_at: string;
  images: ImageData[];
  // Reference images used for generation
  input_image_id?: string;
  context_image_ids?: string[];
  parent_prompt_id?: string;
  session_id?: string;
  _pending?: boolean;
  _count?: number;
}

export interface Template {
  id: string;
  name: string;
  prompt: string;
  category: string;
  tags: string[];
  use_count: number;
  last_used?: string;
  created_at: string;
}

// Design Library - unified system for saving design building blocks
export type LibraryItemType = 'fragment' | 'preset' | 'template';

export interface LibraryItem {
  id: string;
  type: LibraryItemType;
  name: string;
  description?: string;
  created_at: string;
  use_count: number;
  last_used?: string;

  // For fragments: short text snippets to insert
  text?: string;

  // For presets: style tag combinations
  style_tags?: string[];

  // For templates: full prompts
  prompt?: string;

  // Common: categorization
  category?: string;
  tags?: string[];
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  image_ids: string[];
  thumbnail_id?: string;
  created_at: string;
}

export interface Chapter {
  id: string;
  title: string;
  text: string;
  image_ids: string[];
  layout: 'single' | 'grid' | 'split';
}

export interface Story {
  id: string;
  title: string;
  description?: string;
  chapters: Chapter[];
  created_at: string;
}

export interface Settings {
  variation_prompt: string;
  iteration_prompt?: string;  // Prompt for "More Like This"
  text_model?: string;
  image_model?: string;
}

export interface Session {
  id: string;
  name: string;
  notes: string;
  created_at: string;
}

// API Response types
export interface GenerateRequest {
  prompt: string;
  title: string;
  category?: string;
  count?: number;
  input_image_id?: string;
  context_image_ids?: string[];
  collection_id?: string;
  session_id?: string;
}

export interface GenerateResponse {
  success: boolean;
  prompt_id: string;
  images: ImageData[];
  errors: string[];
}

export interface UploadResponse {
  success: boolean;
  prompt_id: string;
  images: ImageData[];
}

// UI State types
export type ViewMode = 'single' | 'grid' | 'compare';
export type LeftTab = 'prompts' | 'collections' | 'library' | 'favorites' | 'preferences';
export type RightTab = 'info' | 'generate' | 'settings';
export type SelectionMode = 'none' | 'select' | 'batch';

export interface SelectionState {
  mode: SelectionMode;
  selectedIds: Set<string>;
}

export interface CompareState {
  leftImageId: string | null;
  rightImageId: string | null;
}

// Store state
export interface AppState {
  // Data
  prompts: Prompt[];
  favorites: string[];
  templates: Template[];
  collections: Collection[];
  stories: Story[];
  settings: Settings | null;

  // Navigation
  currentPromptId: string | null;
  currentImageIndex: number;
  viewMode: ViewMode;
  leftTab: LeftTab;
  rightTab: RightTab;

  // Selection
  selection: SelectionState;
  compareState: CompareState;
  contextImageIds: string[];

  // UI State
  isGenerating: boolean;
  pendingPrompts: Map<string, { title: string; count: number }>;
  error: string | null;

  // Sessions
  sessions: Session[];
  currentSessionId: string | null;
  notes: string;
}

// Utility types
export type ImageWithPrompt = ImageData & { promptId: string; promptTitle: string };
