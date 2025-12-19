// Data Models - matching backend structures

// Design Axis System - for tagging and preference tracking
//
// EXTENSIBLE DESIGN: The system accepts ANY tag string. SUGGESTED_TAGS provides
// common tags for autocomplete/UI hints, but AI can generate novel tags and
// users can like any tag regardless of whether it's in this list.
//
// Tags are stored with their axis context in the backend annotations,
// so unknown tags can still be categorized by AI during generation.

// Core design axes - the four pillars of the design system
export const KNOWN_AXES = ['colors', 'composition', 'layout', 'aesthetic'] as const;

// Suggested tags per axis - used for autocomplete and AI guidance
export const SUGGESTED_TAGS: Record<string, readonly string[]> = {
  colors: [
    // Core palette types
    'monochromatic', 'misty', 'subtle-gradients',
    // Temperature
    'warm-tones', 'cool-tones',
    // Intensity
    'high-contrast', 'muted', 'vibrant',
    // Nature-derived
    'earth-tones', 'pastels',
  ],
  composition: [
    // Depth & layering
    'layered', 'overlapping', 'fragmented',
    // Balance
    'centered', 'symmetrical', 'asymmetrical',
    // Structure
    'rule-of-thirds', 'diagonal', 'framed',
    // Space
    'negative-space',
  ],
  layout: [
    // Form
    'abstract', 'organic', 'grid',
    // Movement
    'flow', 'dynamic', 'balanced',
    // Density
    'minimal', 'dense', 'structured',
    // Character
    'chaotic',
  ],
  aesthetic: [
    // Surreal/experimental
    'surreal', 'double-exposure', 'experimental',
    // Mood-based
    'dreamy', 'ethereal', 'nostalgic',
    // Texture
    'gritty', 'raw', 'polished',
    // Era
    'futuristic',
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
  variation_title?: string;  // Short title for this specific variation (2-5 words)
  mood?: string;
  variation_type?: string;
  notes?: string;
  annotation?: string;  // User annotation for AI context (free text)
  // Design dimension system - Rich AI analysis per axis
  design_dimensions?: Record<string, DesignDimension>;  // axis -> dimension with tags, description, etc.
  liked_axes?: LikedAxes;  // User's liked tags per axis
  liked_dimension_axes?: string[];  // Which dimension axes the user has liked (can be multiple)
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


// Design Token - the ONLY library item type
// Flexible container for images + prompts representing a design dimension

export interface DesignTokenImage {
  id: string;                    // Reference to ImageData.id
  // Snapshot of metadata at extraction time
  annotation?: string;
  liked_axes?: LikedAxes;
  image_path?: string;           // For export portability
}

export interface DesignToken {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at?: string;
  use_count: number;
  last_used?: string;

  // Core content
  images: DesignTokenImage[];    // Source images with metadata snapshots
  prompts: string[];             // Text fragments / prompt snippets

  // Optional concept image (AI-generated to represent the dimension)
  concept_image_id?: string;     // Reference to a generated concept image
  concept_image_path?: string;   // Direct path for export

  // Creation metadata
  creation_method: 'ai-extraction' | 'manual';

  // AI extraction metadata (only present if creation_method === 'ai-extraction')
  extraction?: {
    dimension: DesignDimension;  // The AI-suggested dimension used
    generation_prompt: string;   // Prompt that generated the concept
  };

  // Categorization
  category?: string;             // e.g., "lighting", "mood", "composition"
  tags?: string[];               // Searchable tags
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  image_ids: string[];
  thumbnail_id?: string;
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
  title?: string;  // Short title for this variation (2-5 words)
  mood: string;
  type: string;
  design?: Record<string, string[]>;  // Design tags by axis (colors, composition, etc.)
  // Design dimensions - rich, substantial descriptions for design tokens
  design_dimensions?: DesignDimension[];  // 3-4 substantial dimensions from AI
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
    title?: string;  // Short title for this specific variation
    mood?: string;
    design?: Record<string, string[]>;
    design_dimensions?: DesignDimension[];  // Design dimensions from AI
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

// Design Token API types

// Suggest dimensions from multiple images (AI extraction step 1)
export interface SuggestDimensionsRequest {
  image_ids: string[];
  count?: number;  // Number of dimensions to suggest (default 5)
}

export interface SuggestDimensionsResponse {
  success: boolean;
  dimensions: DesignDimension[];
  error?: string;
}

// Create a Design Token (step 2 after suggestion, or manual creation)
export interface CreateTokenRequest {
  name: string;
  description?: string;
  image_ids: string[];
  prompts?: string[];
  creation_method: 'ai-extraction' | 'manual';

  // For AI extraction only
  dimension?: DesignDimension;    // The chosen dimension
  generate_concept?: boolean;     // Whether to generate a concept image

  // Categorization
  category?: string;
  tags?: string[];
}

export interface CreateTokenResponse {
  success: boolean;
  token?: DesignToken;
  error?: string;
}

// Generate concept image for existing token
export interface GenerateTokenConceptRequest {
  aspect_ratio?: string;
}

export interface GenerateTokenConceptResponse {
  success: boolean;
  concept_image_path?: string;
  concept_image_id?: string;
  error?: string;
}

export interface UploadResponse {
  success: boolean;
  prompt_id: string;
  images: ImageData[];
}

// UI State types
export type ViewMode = 'single' | 'grid' | 'token-gallery';
export type LeftTab = 'prompts' | 'collections' | 'all-images' | 'library';
export type RightTab = 'generate' | 'settings';
export type SelectionMode = 'none' | 'select';

