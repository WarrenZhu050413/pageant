import { useState, useEffect } from "react";
import { clsx } from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wand2,
  X,
  ChevronDown,
  Zap,
  Settings2,
  Pencil,
  Palette,
  Sparkles,
  Dices,
} from "lucide-react";
import { useStore } from "../../store";
import { getImageUrl } from "../../api";
import { Button, Input, Textarea } from "../ui";
import { PromptPreviewModal } from "../modals/PromptPreviewModal";
import { ContextAnnotationModal } from "../modals/ContextAnnotationModal";
import { PromptWorkspaceModal } from "../prompt-workspace";
import type { ImageSize, AspectRatio, SafetyLevel } from "../../types";
import { IMAGE_SIZE_OPTIONS, ASPECT_RATIO_OPTIONS } from "../../types";

// Price per image for display
const SIZE_PRICES: Record<string, string> = {
  "1K": "$0.039",
  "2K": "$0.134",
  "4K": "$0.24",
};

// LocalStorage key for persisting image count preference
const IMAGE_COUNT_KEY = "pageant:defaultImageCount";
// LocalStorage key for skip optimization preference
const SKIP_OPTIMIZATION_KEY = "pageant:skipOptimization";
// LocalStorage key for explore ratio preference
const EXPLORE_RATIO_KEY = "pageant:exploreRatio";

export function GenerateTab() {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [skipOptimization, setSkipOptimization] = useState(() => {
    const saved = localStorage.getItem(SKIP_OPTIMIZATION_KEY);
    return saved === "true";
  });
  const [outputType, setOutputType] = useState<"normal" | "reference">(
    "normal",
  );
  const [count, setCount] = useState(() => {
    // Load saved count from localStorage, default to 4
    const saved = localStorage.getItem(IMAGE_COUNT_KEY);
    return saved ? parseInt(saved, 10) : 4;
  });
  const [countInput, setCountInput] = useState<string | null>(null); // Temporary input while editing
  const [exploreRatio, setExploreRatio] = useState(() => {
    // Load saved explore ratio from localStorage, default to 50
    const saved = localStorage.getItem(EXPLORE_RATIO_KEY);
    return saved ? parseInt(saved, 10) : 50;
  });
  const [showPromptWorkspace, setShowPromptWorkspace] = useState(false);
  const [editingContextImageId, setEditingContextImageId] = useState<
    string | null
  >(null);
  const [showLuckyMenu, setShowLuckyMenu] = useState(false);

  // Advanced options state (per-request overrides)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [imageSize, setImageSize] = useState<string>("");
  const [aspectRatio, setAspectRatio] = useState<string>("");
  const [seed, setSeed] = useState<string>("");
  const [safetyLevel, setSafetyLevel] = useState<string>("");

  const contextImageIds = useStore((s) => s.contextImageIds);
  const contextAnnotationOverrides = useStore(
    (s) => s.contextAnnotationOverrides,
  );
  const removeContextImage = useStore((s) => s.removeContextImage);
  const clearContextImages = useStore((s) => s.clearContextImages);
  const generateVariations = useStore((s) => s.generateVariations);
  const generate = useStore((s) => s.generate);
  // Use all generations (including archived) for context image lookup
  // This allows adding images from any session or archived images to context
  const getAllGenerations = useStore((s) => s.getAllGenerations);
  const prompts = getAllGenerations();
  const settings = useStore((s) => s.settings);
  const generationMode = useStore((s) => s.generationMode);
  const setGenerationMode = useStore((s) => s.setGenerationMode);
  const setContextImages = useStore((s) => s.setContextImages);
  const reeditPrompt = useStore((s) => s.reeditPrompt);
  const reeditContextIds = useStore((s) => s.reeditContextIds);
  const clearReeditData = useStore((s) => s.clearReeditData);
  const feelingLucky = useStore((s) => s.feelingLucky);

  // Initialize Advanced Options from saved settings (intentional sync from external state)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (settings?.image_size) setImageSize(settings.image_size);
  }, [settings?.image_size]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (settings?.aspect_ratio) setAspectRatio(settings.aspect_ratio);
  }, [settings?.aspect_ratio]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (settings?.seed != null) setSeed(settings.seed.toString());
  }, [settings?.seed]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (settings?.safety_level) setSafetyLevel(settings.safety_level);
  }, [settings?.safety_level]);

  // Handle reedit data from generation list (loads prompt + context into Generate tab)
  useEffect(() => {
    if (reeditPrompt !== null && reeditContextIds !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPrompt(reeditPrompt);
      setContextImages(reeditContextIds);
      clearReeditData();
    }
  }, [reeditPrompt, reeditContextIds, setContextImages, clearReeditData]);

  // Helper to update count and persist to localStorage
  const updateCount = (newCount: number) => {
    setCount(newCount);
    localStorage.setItem(IMAGE_COUNT_KEY, newCount.toString());
  };

  // Helper to update explore ratio and persist to localStorage
  const updateExploreRatio = (newRatio: number) => {
    setExploreRatio(newRatio);
    localStorage.setItem(EXPLORE_RATIO_KEY, newRatio.toString());
  };

  // Global +/- keyboard shortcuts for image count
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        updateCount(Math.min(99, count + 1));
      } else if (e.key === "-") {
        e.preventDefault();
        updateCount(Math.max(1, count - 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [count]);

  // Listen for library insert events
  useEffect(() => {
    const handleLibraryInsert = (
      e: CustomEvent<{ content: string; type: string }>,
    ) => {
      const { content, type } = e.detail;
      if (type === "template") {
        // Replace prompt entirely for templates
        setPrompt(content);
      } else {
        // Append for fragments and presets
        setPrompt((prev) => {
          if (!prev.trim()) return content;
          // Add separator if needed
          const separator =
            prev.endsWith(",") || prev.endsWith(".") ? " " : ", ";
          return prev + separator + content;
        });
      }
    };

    window.addEventListener(
      "library-insert",
      handleLibraryInsert as EventListener,
    );
    return () =>
      window.removeEventListener(
        "library-insert",
        handleLibraryInsert as EventListener,
      );
  }, []);

  // Get context images with their data
  const contextImages = contextImageIds
    .map((id) => {
      for (const p of prompts) {
        const img = p.images.find((i) => i.id === id);
        if (img) return img;
      }
      return null;
    })
    .filter(Boolean);

  // Build final prompt
  const buildFinalPrompt = () => prompt.trim();

  // Build image generation params from advanced options
  const buildImageParams = () => ({
    image_size: (imageSize || undefined) as ImageSize | undefined,
    aspect_ratio: (aspectRatio || undefined) as AspectRatio | undefined,
    seed: seed ? parseInt(seed, 10) : undefined,
    safety_level: (safetyLevel || undefined) as SafetyLevel | undefined,
  });

  // Unified generate handler based on mode and output type
  const handleGenerate = () => {
    if (!prompt.trim()) return;

    if (generationMode === "plan") {
      // Plan mode: generate variations first
      generateVariations({
        prompt: buildFinalPrompt(),
        title: title.trim() || undefined,
        count,
        exploreRatio,
        ...buildImageParams(),
        template: outputType === "reference" ? "reference" : "variation",
      });
    } else if (skipOptimization) {
      // Auto mode with skip optimization: use the exact prompt without variations
      generate({
        prompt: buildFinalPrompt(),
        title: title.trim() || undefined,
        count,
        ...buildImageParams(),
        skipOptimization: true,
      });
    } else {
      // Auto mode: use two-stage flow with autoGenerate flag
      // This shows prompts first, then auto-triggers image generation
      generateVariations({
        prompt: buildFinalPrompt(),
        title: title.trim() || undefined,
        count,
        exploreRatio,
        ...buildImageParams(),
        template: outputType === "reference" ? "reference" : "variation",
        autoGenerate: true, // Auto-trigger image generation after prompts
      });
    }

    // Clear form after submitting
    setTitle("");
    setPrompt("");
    setImageSize(settings?.image_size || "");
    setAspectRatio(settings?.aspect_ratio || "");
    setSeed(settings?.seed != null ? settings.seed.toString() : "");
    setSafetyLevel(settings?.safety_level || "");
    setShowAdvanced(false);
  };

  // Get button label based on mode and output type
  const getButtonLabel = () => {
    if (generationMode === "plan") {
      return "Generate Prompts";
    }
    return outputType === "reference"
      ? "Generate Reference Images"
      : "Generate Images";
  };

  // Only prompt is required - title is auto-generated if not provided
  // Allow concurrent prompt generations - only check if prompt is empty
  const isDisabled = !prompt.trim();


  return (
    <div className="p-4 space-y-5">
      {/* Title (optional) */}
      <Input
        label="Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Auto-generate from prompt"
      />

      {/* Count - Inline Editable Number */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-ink-secondary uppercase tracking-wide">
          Images
        </label>
        <div className="relative group flex items-center border border-border/50 rounded-lg">
          {/* Tooltip */}
          <div
            className={clsx(
              "absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1.5",
              "text-xs bg-[var(--color-tooltip-bg)] text-[var(--color-tooltip-text)] rounded-lg shadow-lg",
              "opacity-0 group-hover:opacity-100 pointer-events-none",
              "transition-opacity duration-150 whitespace-nowrap z-[100]",
            )}
          >
            <div className="font-medium">Image count</div>
            <div className="text-[0.65rem] text-[var(--color-tooltip-hint)] mt-0.5">
              Press{" "}
              <kbd className="px-1 py-0.5 rounded bg-white/10 border border-white/20 font-mono">
                +
              </kbd>{" "}
              /{" "}
              <kbd className="px-1 py-0.5 rounded bg-white/10 border border-white/20 font-mono">
                −
              </kbd>{" "}
              anywhere
            </div>
          </div>
          <button
            type="button"
            onClick={() => updateCount(Math.max(1, count - 1))}
            disabled={count <= 1}
            className={clsx(
              "w-9 h-8 rounded-l-lg flex items-center justify-center",
              "bg-canvas-muted text-ink-secondary",
              "hover:bg-canvas-subtle hover:text-ink transition-colors",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            <ChevronDown size={16} className="rotate-90" />
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={countInput ?? count}
            onChange={(e) => {
              const raw = e.target.value;
              setCountInput(raw);
              const val = parseInt(raw, 10);
              if (!isNaN(val) && val >= 1 && val <= 99) updateCount(val);
            }}
            onFocus={() => setCountInput(count.toString())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            onBlur={() => {
              const val = parseInt(countInput ?? "", 10);
              if (isNaN(val) || val < 1) updateCount(1);
              else if (val > 99) updateCount(99);
              setCountInput(null);
            }}
            className={clsx(
              "w-14 h-8 text-center text-sm font-medium tabular-nums cursor-text",
              "bg-surface text-ink border-x border-border/50",
              "hover:bg-surface-raised transition-colors",
              "focus:outline-none focus:bg-surface-raised",
            )}
          />
          <button
            type="button"
            onClick={() => updateCount(Math.min(99, count + 1))}
            disabled={count >= 99}
            className={clsx(
              "w-9 h-8 rounded-r-lg flex items-center justify-center",
              "bg-canvas-muted text-ink-secondary",
              "hover:bg-canvas-subtle hover:text-ink transition-colors",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            <ChevronDown size={16} className="-rotate-90" />
          </button>
        </div>
      </div>

      {/* Explore Ratio Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-ink-secondary uppercase tracking-wide">
            Variation Style
          </label>
          <span className="text-xs text-ink-muted tabular-nums">
            {exploreRatio === 0
              ? "All faithful"
              : exploreRatio === 100
                ? "All explore"
                : `${Math.ceil((count * exploreRatio) / 100)} explore / ${count - Math.ceil((count * exploreRatio) / 100)} faithful`}
          </span>
        </div>
        <div className="relative group">
          {/* Tooltip */}
          <div
            className={clsx(
              "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 max-w-[200px]",
              "text-xs bg-[var(--color-tooltip-bg)] text-[var(--color-tooltip-text)] rounded-lg shadow-lg",
              "opacity-0 group-hover:opacity-100 pointer-events-none",
              "transition-opacity duration-150 z-[100] text-center",
            )}
          >
            <div className="font-medium">Faithful vs Explore</div>
            <div className="text-[0.65rem] text-[var(--color-tooltip-hint)] mt-0.5">
              Faithful: stays close to your prompt
              <br />
              Explore: takes creative liberties
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[0.625rem] text-ink-muted w-12">Faithful</span>
            <input
              type="range"
              min="0"
              max="100"
              step="10"
              value={exploreRatio}
              onChange={(e) => updateExploreRatio(parseInt(e.target.value, 10))}
              className={clsx(
                "flex-1 h-1.5 rounded-full appearance-none cursor-pointer",
                "bg-gradient-to-r from-ink/20 to-brass/40",
                "[&::-webkit-slider-thumb]:appearance-none",
                "[&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3",
                "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brass",
                "[&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer",
                "[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125",
                "[&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3",
                "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-brass",
                "[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer",
              )}
            />
            <span className="text-[0.625rem] text-ink-muted w-12 text-right">Explore</span>
          </div>
        </div>
      </div>

      {/* Context Images */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-ink-secondary uppercase tracking-wide">
            Context Images
          </label>
          {contextImages.length > 0 && (
            <button
              onClick={clearContextImages}
              className="text-xs text-ink-muted hover:text-error transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Context image grid */}
        {contextImages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {contextImages.map((img) => {
                const hasOverride = img!.id in contextAnnotationOverrides;
                return (
                  <motion.div
                    key={img!.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    onClick={() => setEditingContextImageId(img!.id)}
                    className="relative cursor-pointer group"
                    title="Click to edit annotation for this context image"
                  >
                    <img
                      src={getImageUrl(img!.image_path)}
                      alt=""
                      className={clsx(
                        "w-14 h-14 rounded-lg object-cover transition-all",
                        "group-hover:ring-2 group-hover:ring-brass/50",
                        "group-hover:brightness-90",
                      )}
                    />
                    {/* Hover overlay with edit icon */}
                    <div
                      className={clsx(
                        "absolute inset-0 rounded-lg flex items-center justify-center",
                        "bg-ink/40 opacity-0 group-hover:opacity-100 transition-opacity",
                        "pointer-events-none",
                      )}
                    >
                      <Pencil size={16} className="text-surface" />
                    </div>
                    {/* Override indicator (always visible when active) */}
                    {hasOverride && (
                      <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-brass flex items-center justify-center z-10">
                        <Pencil size={8} className="text-surface" />
                      </div>
                    )}
                    {/* Remove button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeContextImage(img!.id);
                      }}
                      className={clsx(
                        "absolute -top-1 -right-1 w-5 h-5 rounded-full z-10",
                        "bg-ink text-surface",
                        "flex items-center justify-center",
                        "hover:bg-error transition-colors",
                      )}
                    >
                      <X size={10} />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Prompt */}
      <Textarea
        label="Prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          // Cmd/Ctrl+Enter to generate
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleGenerate();
          }
          // Shift+Enter inserts newline (default behavior, no action needed)
        }}
        placeholder="Describe the image you want to generate..."
        className="min-h-[150px]"
        data-prompt-input
      />

      {/* Prompt Engineering Workspace Button */}
      {prompt.trim() && (
        <button
          type="button"
          onClick={() => setShowPromptWorkspace(true)}
          className={clsx(
            "w-full px-3 py-2 rounded-lg",
            "flex items-center justify-center gap-2",
            "text-xs font-medium text-brass",
            "bg-brass-muted/30 hover:bg-brass-muted/50",
            "border border-brass/30",
            "transition-colors",
          )}
        >
          <Sparkles size={14} />
          Enter Prompt Engineering Workspace
        </button>
      )}

      {/* Advanced Options */}
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={clsx(
            "w-full px-3 py-2 flex items-center justify-between",
            "text-xs font-medium text-ink-secondary",
            "hover:bg-canvas-muted transition-colors",
          )}
        >
          <span className="flex items-center gap-2">
            <Settings2 size={14} />
            Advanced Options
            {/* Show "Modified" only if values differ from settings defaults */}
            {((imageSize && imageSize !== (settings?.image_size || "")) ||
              (aspectRatio && aspectRatio !== (settings?.aspect_ratio || "")) ||
              (seed &&
                seed !==
                  (settings?.seed != null ? settings.seed.toString() : "")) ||
              (safetyLevel &&
                safetyLevel !== (settings?.safety_level || ""))) && (
              <span className="px-1.5 py-0.5 bg-brass-muted text-brass-dark rounded text-[0.625rem]">
                Modified
              </span>
            )}
          </span>
          <ChevronDown
            size={14}
            className={clsx(
              "transition-transform",
              showAdvanced && "rotate-180",
            )}
          />
        </button>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-3 border-t border-border space-y-3 bg-canvas-subtle">
                {/* Image Size */}
                <div>
                  <label className="block text-[0.625rem] font-medium text-ink-tertiary uppercase tracking-wide mb-1.5">
                    Image Size
                  </label>
                  <div className="flex gap-1.5">
                    {IMAGE_SIZE_OPTIONS.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() =>
                          setImageSize(imageSize === size ? "" : size)
                        }
                        className={clsx(
                          "flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors",
                          "border",
                          imageSize === size
                            ? "bg-brass-muted border-brass text-brass-dark"
                            : "bg-surface border-border text-ink-secondary hover:bg-canvas-muted",
                        )}
                      >
                        {size}
                        <span className="block text-[0.5rem] text-ink-muted mt-0.5">
                          {SIZE_PRICES[size]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Aspect Ratio */}
                <div>
                  <label className="block text-[0.625rem] font-medium text-ink-tertiary uppercase tracking-wide mb-1.5">
                    Aspect Ratio
                  </label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className={clsx(
                      "w-full px-2 py-1.5 rounded text-xs",
                      "bg-surface border border-border",
                      "text-ink-primary focus:outline-none focus:ring-1 focus:ring-brass/30",
                    )}
                  >
                    <option value="">Default (1:1)</option>
                    {ASPECT_RATIO_OPTIONS.map((ratio) => (
                      <option key={ratio} value={ratio}>
                        {ratio}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Seed */}
                <div>
                  <label className="block text-[0.625rem] font-medium text-ink-tertiary uppercase tracking-wide mb-1.5">
                    Seed (for reproducibility)
                  </label>
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    placeholder="Random"
                    className={clsx(
                      "w-full px-2 py-1.5 rounded text-xs",
                      "bg-surface border border-border",
                      "text-ink-primary placeholder:text-ink-muted",
                      "focus:outline-none focus:ring-1 focus:ring-brass/30",
                    )}
                  />
                </div>

                {/* Safety Level */}
                <div>
                  <label className="block text-[0.625rem] font-medium text-ink-tertiary uppercase tracking-wide mb-1.5">
                    Safety Filter
                  </label>
                  <select
                    value={safetyLevel}
                    onChange={(e) => setSafetyLevel(e.target.value)}
                    className={clsx(
                      "w-full px-2 py-1.5 rounded text-xs",
                      "bg-surface border border-border",
                      "text-ink-primary focus:outline-none focus:ring-1 focus:ring-brass/30",
                    )}
                  >
                    <option value="">Default</option>
                    <option value="BLOCK_NONE">Block None</option>
                    <option value="BLOCK_ONLY_HIGH">Block Only High</option>
                    <option value="BLOCK_MEDIUM_AND_ABOVE">
                      Block Medium & Above
                    </option>
                    <option value="BLOCK_LOW_AND_ABOVE">
                      Block Low & Above
                    </option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Generation Options */}
      <div className="space-y-3">
        {/* Mode and Output Type Toggles */}
        <div className="flex items-center gap-3">
          {/* Mode Toggle: Plan / Auto */}
          <div className="flex rounded-lg border border-border text-xs">
            {/* Plan button with tooltip */}
            <div className="relative group">
              <button
                type="button"
                onClick={() => setGenerationMode("plan")}
                className={clsx(
                  "px-3 py-1.5 font-medium transition-colors rounded-l-lg",
                  generationMode === "plan"
                    ? "bg-brass/15 text-brass-dark"
                    : "bg-surface text-ink-muted hover:bg-canvas-muted",
                )}
              >
                Plan
              </button>
              <div
                className={clsx(
                  "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 min-w-[140px]",
                  "text-xs bg-[var(--color-tooltip-bg)] text-[var(--color-tooltip-text)] rounded-lg shadow-lg",
                  "opacity-0 group-hover:opacity-100 pointer-events-none",
                  "transition-opacity duration-150 z-[100]",
                )}
              >
                <div className="text-[0.65rem] text-[var(--color-tooltip-hint)]">
                  Preview & edit prompts first
                </div>
                <div className="mt-1 flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-white/10 border border-white/20 text-[0.6rem] font-mono">
                    Shift+Tab
                  </kbd>
                </div>
              </div>
            </div>
            {/* Auto button with tooltip */}
            <div className="relative group">
              <button
                type="button"
                onClick={() => setGenerationMode("auto")}
                className={clsx(
                  "px-3 py-1.5 font-medium transition-colors rounded-r-lg border-l border-border",
                  generationMode === "auto"
                    ? "bg-brass/15 text-brass-dark"
                    : "bg-surface text-ink-muted hover:bg-canvas-muted",
                )}
              >
                Auto
              </button>
              <div
                className={clsx(
                  "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 min-w-[160px]",
                  "text-xs bg-[var(--color-tooltip-bg)] text-[var(--color-tooltip-text)] rounded-lg shadow-lg",
                  "opacity-0 group-hover:opacity-100 pointer-events-none",
                  "transition-opacity duration-150 z-[100]",
                )}
              >
                <div className="text-[0.65rem] text-[var(--color-tooltip-hint)]">
                  Generate images directly
                </div>
                <div className="mt-1 flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-white/10 border border-white/20 text-[0.6rem] font-mono">
                    Shift+Tab
                  </kbd>
                </div>
              </div>
            </div>
          </div>

          {/* Output Type Toggle: Normal / Reference */}
          <div className="flex rounded-lg border border-border text-xs">
            {/* Images button with tooltip */}
            <div className="relative group">
              <button
                type="button"
                onClick={() => setOutputType("normal")}
                className={clsx(
                  "px-3 py-1.5 font-medium transition-colors rounded-l-lg",
                  outputType === "normal"
                    ? "bg-brass/15 text-brass-dark"
                    : "bg-surface text-ink-muted hover:bg-canvas-muted",
                )}
              >
                Images
              </button>
              <div
                className={clsx(
                  "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 min-w-[120px]",
                  "text-xs bg-[var(--color-tooltip-bg)] text-[var(--color-tooltip-text)] rounded-lg shadow-lg",
                  "opacity-0 group-hover:opacity-100 pointer-events-none",
                  "transition-opacity duration-150 z-[100]",
                )}
              >
                <div className="text-[0.65rem] text-[var(--color-tooltip-hint)]">
                  Generate final images
                </div>
              </div>
            </div>
            {/* Reference button with tooltip */}
            <div className="relative group">
              <button
                type="button"
                onClick={() => setOutputType("reference")}
                className={clsx(
                  "px-3 py-1.5 font-medium transition-colors rounded-r-lg border-l border-border",
                  outputType === "reference"
                    ? "bg-brass/15 text-brass-dark"
                    : "bg-surface text-ink-muted hover:bg-canvas-muted",
                )}
              >
                Reference
              </button>
              <div
                className={clsx(
                  "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 min-w-[140px]",
                  "text-xs bg-[var(--color-tooltip-bg)] text-[var(--color-tooltip-text)] rounded-lg shadow-lg",
                  "opacity-0 group-hover:opacity-100 pointer-events-none",
                  "transition-opacity duration-150 z-[100]",
                )}
              >
                <div className="text-[0.65rem] text-[var(--color-tooltip-hint)]">
                  Generate mood/concept images
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Skip Optimization Checkbox - always visible, disabled in Plan mode */}
        <label
          className={clsx(
            "flex items-start gap-2",
            generationMode === "plan"
              ? "opacity-40 cursor-not-allowed"
              : "cursor-pointer",
          )}
        >
          <input
            type="checkbox"
            checked={skipOptimization}
            disabled={generationMode === "plan"}
            onChange={(e) => {
              setSkipOptimization(e.target.checked);
              localStorage.setItem(
                SKIP_OPTIMIZATION_KEY,
                e.target.checked.toString(),
              );
            }}
            className="mt-0.5 w-3.5 h-3.5 rounded border-border text-brass focus:ring-brass/20 disabled:opacity-50"
          />
          <div>
            <span className="text-xs font-medium text-ink-secondary">
              Skip prompt optimization
            </span>
            <p className="text-[0.625rem] text-ink-muted mt-0.5">
              {generationMode === "plan"
                ? "Only applies to Auto mode"
                : "Use your exact prompt without Gemini variation"}
            </p>
          </div>
        </label>

        {/* Generate Buttons */}
        <div className="flex gap-2">
          <Button
            variant="brass"
            size="lg"
            leftIcon={
              generationMode === "plan" ? (
                <Wand2 size={18} />
              ) : outputType === "reference" ? (
                <Palette size={18} />
              ) : (
                <Zap size={18} />
              )
            }
            onClick={handleGenerate}
            disabled={isDisabled}
            className="flex-1"
          >
            {getButtonLabel()}
          </Button>
          <div className="relative">
            {/* Split button: Dice + Dropdown */}
            <div className="flex">
              <button
                type="button"
                onClick={(e) => {
                  setShowLuckyMenu(false);
                  feelingLucky(e.shiftKey ? 'all' : 'session');
                }}
                className={clsx(
                  "px-3 h-10 rounded-l-lg flex items-center justify-center",
                  "bg-surface border border-border border-r-0",
                  "text-ink-secondary hover:bg-canvas-muted hover:text-ink",
                  "transition-colors",
                )}
                title="Feeling Lucky (Shift+click for all images)"
              >
                <Dices size={18} />
              </button>
              <button
                type="button"
                onClick={() => setShowLuckyMenu(!showLuckyMenu)}
                className={clsx(
                  "px-1.5 h-10 rounded-r-lg flex items-center justify-center",
                  "bg-surface border border-border",
                  "text-ink-secondary hover:bg-canvas-muted hover:text-ink",
                  "transition-colors",
                )}
              >
                <ChevronDown size={14} className={clsx(showLuckyMenu && "rotate-180", "transition-transform")} />
              </button>
            </div>

            {/* Tooltip (show when menu is closed) */}
            {!showLuckyMenu && (
              <div
                className={clsx(
                  "absolute bottom-full right-0 mb-2 px-2.5 py-1.5 min-w-[180px]",
                  "text-xs bg-[var(--color-tooltip-bg)] text-[var(--color-tooltip-text)] rounded-lg shadow-lg",
                  "opacity-0 hover:opacity-0 group-hover:opacity-100 pointer-events-none",
                  "transition-opacity duration-150 z-[100]",
                )}
              >
                <div className="font-medium">Feeling Lucky</div>
                <div className="text-[0.65rem] text-[var(--color-tooltip-hint)] mt-0.5">
                  Random images + keywords from session & library
                </div>
                <div className="text-[0.6rem] text-[var(--color-tooltip-hint)] mt-1 flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-white/10 border border-white/20 font-mono">
                    Shift
                  </kbd>
                  <span>+click for all images</span>
                </div>
              </div>
            )}

            {/* Dropdown Menu */}
            <AnimatePresence>
              {showLuckyMenu && (
                <>
                  {/* Backdrop to close menu */}
                  <div
                    className="fixed inset-0 z-[99]"
                    onClick={() => setShowLuckyMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className={clsx(
                      "absolute top-full right-0 mt-1 py-1 min-w-[140px]",
                      "bg-surface border border-border rounded-lg shadow-lg z-[100]",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setShowLuckyMenu(false);
                        feelingLucky('session');
                      }}
                      className={clsx(
                        "w-full px-3 py-1.5 text-left text-sm",
                        "text-ink-secondary hover:bg-canvas-muted hover:text-ink",
                        "transition-colors",
                      )}
                    >
                      This Session
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowLuckyMenu(false);
                        feelingLucky('all');
                      }}
                      className={clsx(
                        "w-full px-3 py-1.5 text-left text-sm",
                        "text-ink-secondary hover:bg-canvas-muted hover:text-ink",
                        "transition-colors",
                      )}
                    >
                      All Images
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Prompt Preview Modal */}
      <PromptPreviewModal />

      {/* Context Annotation Modal */}
      <ContextAnnotationModal
        isOpen={editingContextImageId !== null}
        imageId={editingContextImageId}
        onClose={() => setEditingContextImageId(null)}
      />

      {/* Prompt Engineering Workspace Modal */}
      <PromptWorkspaceModal
        isOpen={showPromptWorkspace}
        onClose={() => setShowPromptWorkspace(false)}
        initialPrompt={prompt}
        contextImageIds={contextImageIds}
        onApply={(optimizedPrompt) => setPrompt(optimizedPrompt)}
      />
    </div>
  );
}
