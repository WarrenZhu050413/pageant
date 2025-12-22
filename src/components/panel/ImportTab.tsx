import { useState, useRef } from "react";
import { Upload, FolderUp, ScanSearch, Paintbrush } from "lucide-react";
import { useStore } from "../../store";
import { Button } from "../ui";

// LocalStorage keys
const AUTO_ANALYZE_KEY = "pageant:autoAnalyzeOnUpload";
const AUTO_ENHANCE_KEY = "pageant:autoEnhanceOnUpload";

export function ImportTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Upload options state
  const [autoAnalyze, setAutoAnalyze] = useState(() => {
    const saved = localStorage.getItem(AUTO_ANALYZE_KEY);
    return saved === "true";
  });
  const [autoEnhance, setAutoEnhance] = useState(() => {
    const saved = localStorage.getItem(AUTO_ENHANCE_KEY);
    return saved === "true";
  });

  // Store
  const isGenerating = useStore((s) => s.isGenerating);
  const isAnalyzing = useStore((s) => s.isAnalyzing);
  const analysisProgress = useStore((s) => s.analysisProgress);
  const uploadImages = useStore((s) => s.uploadImages);
  const analyzeUploadedImages = useStore((s) => s.analyzeUploadedImages);
  const enhanceImage = useStore((s) => s.enhanceImage);
  const selectedIds = useStore((s) => s.selectedIds);
  const getCurrentImage = useStore((s) => s.getCurrentImage);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await uploadImages(Array.from(files), {
        analyze: autoAnalyze,
        enhance: autoEnhance,
      });
    }
    e.target.value = "";
  };

  const handleAutoAnalyzeChange = (checked: boolean) => {
    setAutoAnalyze(checked);
    localStorage.setItem(AUTO_ANALYZE_KEY, checked.toString());
  };

  const handleAutoEnhanceChange = (checked: boolean) => {
    setAutoEnhance(checked);
    localStorage.setItem(AUTO_ENHANCE_KEY, checked.toString());
  };

  return (
    <div className="p-4 space-y-6">
      {/* Upload buttons */}
      <div className="space-y-3">
        <label className="block text-xs font-medium text-ink-secondary uppercase tracking-wide">
          Upload Images
        </label>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Upload size={14} />}
            onClick={() => fileInputRef.current?.click()}
            className="flex-1"
            disabled={isGenerating || isAnalyzing}
          >
            Files
          </Button>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<FolderUp size={14} />}
            onClick={() => folderInputRef.current?.click()}
            className="flex-1"
            disabled={isGenerating || isAnalyzing}
          >
            Folder
          </Button>
        </div>
      </div>

      {/* Upload options */}
      <div className="space-y-3">
        <label className="block text-xs font-medium text-ink-secondary uppercase tracking-wide">
          On Upload
        </label>

        {/* Auto-analyze checkbox */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={autoAnalyze}
            onChange={(e) => handleAutoAnalyzeChange(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-border bg-canvas-muted text-brass focus:ring-brass/30"
          />
          <div>
            <div className="text-sm text-ink group-hover:text-ink-bold transition-colors">
              Auto-analyze dimensions
            </div>
            <div className="text-xs text-ink-secondary mt-0.5">
              Extract design dimensions and tags from uploaded images
            </div>
          </div>
        </label>

        {/* Auto-enhance checkbox */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={autoEnhance}
            onChange={(e) => handleAutoEnhanceChange(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-border bg-canvas-muted text-brass focus:ring-brass/30"
          />
          <div>
            <div className="text-sm text-ink group-hover:text-ink-bold transition-colors">
              Auto-enhance images
            </div>
            <div className="text-xs text-ink-secondary mt-0.5">
              Apply professional retouching to all uploaded images
            </div>
          </div>
        </label>
      </div>

      {/* Processing status */}
      {(isGenerating || isAnalyzing) && (
        <div className="flex items-center gap-2 text-sm text-ink-secondary">
          <div className="w-4 h-4 border-2 border-brass/30 border-t-brass rounded-full animate-spin" />
          {isAnalyzing && analysisProgress
            ? `Analyzing ${analysisProgress.current}/${analysisProgress.total} images...`
            : isAnalyzing
              ? "Analyzing images..."
              : "Uploading..."}
        </div>
      )}

      {/* Manual actions for existing images */}
      <div className="pt-4 border-t border-border space-y-3">
        <label className="block text-xs font-medium text-ink-secondary uppercase tracking-wide">
          Existing Images
        </label>
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<ScanSearch size={14} />}
          onClick={() => {
            const imageIds =
              selectedIds.size > 0
                ? Array.from(selectedIds)
                : getCurrentImage()
                  ? [getCurrentImage()!.id]
                  : [];
            if (imageIds.length > 0) {
              analyzeUploadedImages(imageIds);
            }
          }}
          className="w-full justify-start text-ink-secondary hover:text-ink"
          disabled={isGenerating || isAnalyzing || (selectedIds.size === 0 && !getCurrentImage())}
        >
          {isAnalyzing
            ? "Analyzing..."
            : `Analyze selected${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<Paintbrush size={14} />}
          onClick={() => {
            const currentImage = getCurrentImage();
            if (currentImage) {
              enhanceImage(currentImage.id);
            }
          }}
          className="w-full justify-start text-ink-secondary hover:text-ink"
          disabled={isGenerating || !getCurrentImage()}
        >
          Enhance current image
        </Button>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif,.HEIC,.HEIF"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        accept="image/*,.heic,.heif,.HEIC,.HEIF"
        multiple
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {...({ webkitdirectory: "true" } as any)}
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
}
