// Data Models - matching backend structures

// Design Axis System - for tagging and preference tracking
//
// EXTENSIBLE DESIGN: The system accepts ANY tag string. SUGGESTED_TAGS provides
// common tags for autocomplete/UI hints, but AI can generate novel tags and
// users can like any tag regardless of whether it's in this list.
//
// Tags are stored with their axis context in the backend annotations,
// so unknown tags can still be categorized by AI during generation.

// Known design axes - but the system allows arbitrary axes too
export const KNOWN_AXES = ['colors', 'composition', 'mood', 'layout', 'aesthetic', 'typeface_feel'] as const;

// Suggested tags per axis - used for autocomplete, not validation
export const SUGGESTED_TAGS: Record<string, readonly string[]> = {
  colors: [
    // Palette type
    'monochromatic', 'complementary', 'analogous', 'triadic', 'split-complementary', 'tetradic',
    // Temperature
    'warm', 'cool', 'neutral',
    // Saturation
    'vibrant', 'muted', 'pastel', 'saturated', 'desaturated', 'earthy',
    // Contrast
    'high-contrast', 'low-contrast', 'subtle-gradients',
    // Mood-based
    'moody-dark', 'light-airy', 'rich-jewel-tones', 'soft-naturals',
  ],
  composition: [
    // Framing
    'close-up', 'medium-shot', 'wide-angle', 'extreme-close-up', 'bird\'s-eye', 'worm\'s-eye',
    // Balance
    'rule-of-thirds', 'symmetrical', 'asymmetrical', 'centered', 'golden-ratio',
    // Lines
    'diagonal', 'horizontal', 'vertical', 'curved', 'leading-lines',
    // Depth
    'layered', 'shallow-depth', 'deep-focus', 'foreground-focus', 'atmospheric-perspective',
    // Space
    'negative-space', 'framed', 'contained', 'expansive', 'cropped-tight',
  ],
  mood: [
    'warm', 'cool', 'dramatic', 'serene', 'energetic', 'mysterious', 'playful', 'elegant',
    'contemplative', 'whimsical', 'bold', 'intimate', 'grand', 'nostalgic', 'futuristic',
  ],
  layout: [
    // Structure
    'centered', 'asymmetric', 'grid', 'modular', 'freeform',
    // Density
    'dense', 'spacious', 'balanced', 'clustered', 'scattered',
    // Flow
    'dynamic', 'static', 'radial', 'linear', 'organic',
    // Hierarchy
    'focal-point', 'distributed', 'progressive', 'nested',
  ],
  style: [
    // Realism
    'photorealistic', 'hyperrealistic', 'stylized-realism',
    // Illustration
    'illustrated', 'flat-design', 'line-art', 'hand-drawn', 'vector',
    // Digital
    '3D-rendered', 'CGI', 'digital-painting', 'pixel-art', 'low-poly',
    // Movement
    'art-nouveau', 'art-deco', 'bauhaus', 'swiss-style', 'brutalist',
    // Era
    'retro', 'vintage', 'mid-century', '80s-aesthetic', 'Y2K', 'modern', 'futuristic',
    // Approach
    'minimalist', 'maximalist', 'abstract', 'surreal', 'collage', 'mixed-media',
  ],
  typeface: [
    // Category
    'sans-serif', 'serif', 'slab-serif', 'monospace', 'display', 'script',
    // Weight
    'light', 'regular', 'medium', 'bold', 'black',
    // Style
    'geometric', 'humanist', 'grotesque', 'transitional', 'modern', 'old-style',
    // Character
    'elegant', 'playful', 'technical', 'editorial', 'friendly', 'authoritative',
  ],
};

// Legacy export for backwards compatibility - maps to SUGGESTED_TAGS
export const DESIGN_AXES = SUGGESTED_TAGS;

// DesignAxis can be any of the known axes OR any custom axis string
export type KnownAxis = typeof KNOWN_AXES[number];
export type DesignAxis = KnownAxis | string;

// LikedAxes stores specific tag values that were liked per axis
// EXTENSIBLE: Accepts any axis key, not just the predefined ones
// e.g., { typeface: ["sans-serif"], mood: ["elegant", "minimal"], "custom-axis": ["tag1"] }
export type LikedAxes = Record<string, string[]>;

// DesignPreferences stores weighted scores per tag per axis
// EXTENSIBLE: Accepts any axis key
export type DesignPreferences = Record<string, Record<string, number>>;

// DesignDimension - Rich AI-analyzed design dimension metadata
// Used for structured context in generation and concept image creation
export interface DesignDimension {
  axis: string;              // e.g., "lighting", "mood", "colors"
  name: string;              // Evocative name, e.g., "Eerie Green Cast"
  description: string;       // 2-3 sentence analysis of how this dimension manifests
  tags: string[];            // Design vocabulary tags, e.g., ["moody-dark", "atmospheric"]
  generation_prompt: string; // Prompt for generating pure concept image
  source: 'auto' | 'user';   // How it was created
  confirmed: boolean;        // User confirmed this suggestion
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
  annotation?: string;  // User annotation for AI context (free text)
  // Design dimension system - Rich AI analysis per axis
  design_dimensions?: Record<string, DesignDimension>;  // axis -> dimension with tags, description, etc.
  liked_axes?: LikedAxes;  // User's liked tags per axis
  // Legacy fields (deprecated, will be migrated to design_dimensions)
  design_tags?: string[];  // @deprecated - use design_dimensions[axis].tags
  annotations?: Record<string, string[]>;  // @deprecated - use design_dimensions
}

export interface Prompt {
  id: string;
  prompt: string;
  title: string;
  created_at: string;
  images: ImageData[];
  // Reference images used for generation
  input_image_id?: string;
  context_image_ids?: string[];
  parent_prompt_id?: string;
  session_id?: string;
  _pending?: boolean;
  _count?: number;
  // The original base prompt that generated variations for this prompt
  basePrompt?: string;
  // Concept image metadata
  is_concept?: boolean;      // True if this is a concept image (design token)
  concept_axis?: string;     // Which axis this concept represents (e.g., "lighting")
  source_image_id?: string;  // Image ID the concept was derived from
}

// Draft prompt - ungenerated variations ready for editing
export interface DraftPrompt {
  id: string;
  basePrompt: string;
  title: string;
  variations: PromptVariation[];
  createdAt: string;
  // Image params to use when generating
  imageParams?: ImageGenerationParams;
  contextImageIds?: string[];
  // Annotation suggestions from AI (global, not per-variation)
  annotationSuggestions?: AnnotationSuggestion[];
  // Per-draft generation state - allows concurrent generations
  isGenerating?: boolean;
}


// Design Library - unified system for saving design building blocks
export type LibraryItemType = 'fragment' | 'preset' | 'template' | 'design-token';

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

  // For design-token: source references
  source_image_id?: string;
  source_prompt_id?: string;
  extracted_from?: {
    annotation?: string;
    liked_tags?: string[];
  };
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

// Image generation parameter options
export const IMAGE_SIZE_OPTIONS = ['1K', '2K', '4K'] as const;
export const ASPECT_RATIO_OPTIONS = ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'] as const;
export const SAFETY_LEVEL_OPTIONS = ['BLOCK_NONE', 'BLOCK_ONLY_HIGH', 'BLOCK_MEDIUM_AND_ABOVE', 'BLOCK_LOW_AND_ABOVE'] as const;
export const THINKING_LEVEL_OPTIONS = ['low', 'high'] as const;

export type ImageSize = typeof IMAGE_SIZE_OPTIONS[number];
export type AspectRatio = typeof ASPECT_RATIO_OPTIONS[number];
export type SafetyLevel = typeof SAFETY_LEVEL_OPTIONS[number];
export type ThinkingLevel = typeof THINKING_LEVEL_OPTIONS[number];

// Image generation parameters (used in both Settings and GenerateRequest)
export interface ImageGenerationParams {
  image_size?: ImageSize;
  aspect_ratio?: AspectRatio;
  seed?: number;
  safety_level?: SafetyLevel;
  // Nano Banana specific
  thinking_level?: ThinkingLevel;
  temperature?: number;
  google_search_grounding?: boolean;
}

export interface Settings extends ImageGenerationParams {
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
export interface GenerateRequest extends ImageGenerationParams {
  prompt: string;
  title?: string; // Optional - will be auto-generated if not provided
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

// Two-Phase Generation types
export interface PromptVariation {
  id: string;
  text: string;
  mood: string;
  type: string;
  design?: Record<string, string[]>;  // Design tags by axis (colors, composition, etc.)
  // Per-variation context image assignment
  recommended_context_ids?: string[];  // Image IDs to use for THIS variation
  context_reasoning?: string;  // Why these images were chosen
  // User iteration annotations
  userNotes?: string;  // User's guidance/comments for AI rewrite
  isEdited?: boolean;  // Track if user modified the text
  emphasizedTags?: string[];  // Tags user wants to emphasize (clicked ♥)
}

export interface AnnotationSuggestion {
  image_id: string;
  original_annotation?: string;
  suggested_annotation: string;
  reason: string;
}

export interface GeneratePromptsRequest extends ImageGenerationParams {
  prompt: string;
  title?: string; // Optional - will be auto-generated if not provided
  count: number;
  context_image_ids?: string[];
}

export interface GeneratePromptsResponse {
  success: boolean;
  variations: PromptVariation[];
  base_prompt: string;
  generated_title?: string; // Title from model (generated or refined from user's)
  annotation_suggestions?: AnnotationSuggestion[];  // Suggested annotation polish
  error?: string;
}

export interface GenerateFromPromptsRequest extends ImageGenerationParams {
  title: string;
  prompts: {
    text: string;
    mood?: string;
    design?: Record<string, string[]>;
    recommended_context_ids?: string[];  // Per-variation context
  }[];
  context_image_ids?: string[];
  session_id?: string;
  base_prompt?: string;  // Original prompt that generated variations
}

// Polish prompts API types
export interface VariationToPolish {
  id: string;
  text: string;
  user_notes?: string;
  mood?: string;
  design?: Record<string, string[]>;
  emphasized_tags?: string[];
}

export interface PolishPromptsRequest {
  base_prompt: string;
  variations: VariationToPolish[];
  context_image_ids?: string[];
}

export interface PolishedVariation {
  id: string;
  text: string;
  changes_made?: string;
}

export interface PolishPromptsResponse {
  success: boolean;
  polished_variations: PolishedVariation[];
  error?: string;
}

// Polish Annotations API types
export interface PolishAnnotationsRequest {
  image_ids: string[];
}

export interface PolishedAnnotation {
  image_id: string;
  original_annotation: string;
  polished_annotation: string;
}

export interface PolishAnnotationsResponse {
  success: boolean;
  polished: PolishedAnnotation[];
  skipped: string[];
  error?: string;
}

// Design Dimension Analysis API types
export interface AnalyzeDimensionsRequest {
  image_id: string;
  count?: number;  // Number of dimensions to suggest (default 5)
}

export interface AnalyzeDimensionsResponse {
  success: boolean;
  dimensions: DesignDimension[];
  error?: string;
}

export interface GenerateConceptRequest {
  image_id: string;
  dimension: DesignDimension;
  aspect_ratio?: string;
}

export interface GenerateConceptResponse {
  success: boolean;
  prompt_id: string;  // The new concept prompt
  images: ImageData[];
  error?: string;
}

export interface UpdateDimensionsRequest {
  dimensions: Record<string, DesignDimension>;
}

// Design Token Extraction API types
export interface ExtractDesignTokenRequest {
  image_id: string;
  annotation?: string;  // Override image's annotation
  liked_tags?: string[];  // Override image's liked_axes
}

export interface ExtractDesignTokenResponse {
  success: boolean;
  item?: LibraryItem;
  error?: string;
}

export interface UploadResponse {
  success: boolean;
  prompt_id: string;
  images: ImageData[];
}

// UI State types
export type ViewMode = 'single' | 'grid';
export type LeftTab = 'prompts' | 'collections' | 'library';
export type RightTab = 'info' | 'generate' | 'settings';
export type SelectionMode = 'none' | 'select';

export interface SelectionState {
  mode: SelectionMode;
  selectedIds: Set<string>;
}


// Store state
export interface AppState {
  // Data
  prompts: Prompt[];
  favorites: string[];
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
