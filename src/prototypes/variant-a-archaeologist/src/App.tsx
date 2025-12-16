import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type View = 'upload' | 'analyzing' | 'results';

interface ColorInfo {
  name: string;
  hex: string;
  percentage?: number;
}

interface TechnicalQualities {
  detail_level?: string;
  contrast?: string;
  saturation?: string;
}

interface DNAResult {
  estimated_prompt: string;
  style_tags: string[];
  color_palette: ColorInfo[];
  composition: string;
  mood: string;
  lighting: string;
  subject_matter: string[] | string;
  artistic_style: string;
  technical_qualities: TechnicalQualities | string;
  confidence: number;
}

const API_URL = 'http://localhost:8765';

export default function App() {
  const [view, setView] = useState<View>('upload');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dnaResult, setDnaResult] = useState<DNAResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setView('analyzing');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/api/analysis/archaeology`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success && data.dna) {
        setDnaResult(data.dna);
        setView('results');
      } else {
        throw new Error(data.error || 'Analysis failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setView('upload');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const copyPrompt = useCallback(async () => {
    if (dnaResult?.estimated_prompt) {
      await navigator.clipboard.writeText(dnaResult.estimated_prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [dnaResult]);

  const reset = useCallback(() => {
    setView('upload');
    setImagePreview(null);
    setDnaResult(null);
    setError(null);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <AnimatePresence mode="wait">
        {/* UPLOAD VIEW */}
        {view === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col items-center justify-center p-8"
          >
            <h1 className="text-4xl font-bold mb-2 text-cyan-400">
              Prompt Archaeologist
            </h1>
            <p className="text-slate-400 mb-8">
              Reverse-engineer any image into its visual DNA
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`
                w-full max-w-2xl min-h-[400px] border-2 border-dashed rounded-xl
                flex flex-col items-center justify-center cursor-pointer
                transition-all duration-200
                ${isDragging
                  ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_40px_rgba(6,182,212,0.3)]'
                  : 'border-cyan-500/50 hover:border-cyan-400 hover:bg-slate-800/50'}
              `}
            >
              <div className="text-6xl mb-4">🔬</div>
              <p className="text-xl text-slate-300 mb-2">
                Drop an image to analyze its DNA
              </p>
              <p className="text-slate-500">or click to select a file</p>
              <p className="text-slate-600 text-sm mt-4">
                Supports JPG, PNG, WebP
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="hidden"
            />

            {error && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 text-red-400"
              >
                {error}
              </motion.p>
            )}
          </motion.div>
        )}

        {/* ANALYZING VIEW */}
        {view === 'analyzing' && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col items-center justify-center p-8"
          >
            <div className="relative max-w-2xl">
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="Analyzing"
                  className="rounded-xl shadow-2xl max-h-[60vh] object-contain"
                />
              )}
              {/* Scanning line */}
              <div className="absolute inset-0 overflow-hidden rounded-xl">
                <motion.div
                  className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_20px_rgba(6,182,212,0.8)]"
                  animate={{ top: ['0%', '100%', '0%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
              </div>
            </div>
            <motion.p
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="mt-8 text-xl text-cyan-400 font-mono"
            >
              Analyzing DNA...
            </motion.p>
          </motion.div>
        )}

        {/* RESULTS VIEW */}
        {view === 'results' && dnaResult && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen p-8"
          >
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[40%_60%] gap-8">
              {/* Left: Image */}
              <div className="space-y-4">
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Analyzed"
                    className="w-full rounded-xl shadow-2xl"
                  />
                )}
                <button
                  onClick={reset}
                  className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-semibold rounded-lg transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)]"
                >
                  Analyze Another
                </button>
              </div>

              {/* Right: DNA Panels */}
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="space-y-4 overflow-y-auto max-h-[calc(100vh-4rem)]"
              >
                {/* Estimated Prompt */}
                <motion.div variants={itemVariants} className="bg-zinc-800 rounded-xl p-6 relative">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-cyan-400 font-semibold">Estimated Prompt</h3>
                    <button
                      onClick={copyPrompt}
                      className="px-3 py-1 text-sm bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded transition-colors"
                    >
                      {copied ? '✓ Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="font-mono text-sm text-slate-300 leading-relaxed">
                    {dnaResult.estimated_prompt}
                  </p>
                </motion.div>

                {/* Color Palette */}
                <motion.div variants={itemVariants} className="bg-zinc-800 rounded-xl p-6">
                  <h3 className="text-cyan-400 font-semibold mb-4">Color Palette</h3>
                  <div className="flex flex-wrap gap-4">
                    {Array.isArray(dnaResult.color_palette) && dnaResult.color_palette.map((color, i) => (
                      <div key={i} className="flex flex-col items-center">
                        <div
                          className="w-12 h-12 rounded-full border-2 border-zinc-600 shadow-lg hover:scale-110 transition-transform cursor-pointer"
                          style={{ backgroundColor: typeof color === 'string' ? color : color.hex }}
                          title={typeof color === 'string' ? color : `${color.name}: ${color.hex}`}
                        />
                        <span className="text-xs text-slate-400 mt-1 font-mono">
                          {typeof color === 'string' ? color : color.hex}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Style Tags */}
                <motion.div variants={itemVariants} className="bg-zinc-800 rounded-xl p-6">
                  <h3 className="text-cyan-400 font-semibold mb-4">Style Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {dnaResult.style_tags?.map((tag, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-full text-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </motion.div>

                {/* Details Grid */}
                <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-800/50 rounded-xl p-4">
                    <h4 className="text-cyan-400/70 text-sm mb-1">Composition</h4>
                    <p className="text-slate-300">{dnaResult.composition}</p>
                  </div>
                  <div className="bg-zinc-800/50 rounded-xl p-4">
                    <h4 className="text-cyan-400/70 text-sm mb-1">Mood</h4>
                    <p className="text-slate-300">{dnaResult.mood}</p>
                  </div>
                  <div className="bg-zinc-800/50 rounded-xl p-4">
                    <h4 className="text-cyan-400/70 text-sm mb-1">Lighting</h4>
                    <p className="text-slate-300">{dnaResult.lighting}</p>
                  </div>
                  <div className="bg-zinc-800/50 rounded-xl p-4">
                    <h4 className="text-cyan-400/70 text-sm mb-1">Artistic Style</h4>
                    <p className="text-slate-300">{dnaResult.artistic_style}</p>
                  </div>
                </motion.div>

                {/* Subject Matter */}
                <motion.div variants={itemVariants} className="bg-zinc-800/50 rounded-xl p-4">
                  <h4 className="text-cyan-400/70 text-sm mb-2">Subject Matter</h4>
                  <p className="text-slate-300">
                    {Array.isArray(dnaResult.subject_matter)
                      ? dnaResult.subject_matter.join(', ')
                      : dnaResult.subject_matter}
                  </p>
                </motion.div>

                {/* Confidence */}
                <motion.div variants={itemVariants} className="bg-zinc-800 rounded-xl p-6">
                  <h3 className="text-cyan-400 font-semibold mb-3">Analysis Confidence</h3>
                  <div className="relative h-4 bg-zinc-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(dnaResult.confidence || 0) * 100}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full"
                    />
                  </div>
                  <p className="text-right text-sm text-slate-400 mt-1">
                    {((dnaResult.confidence || 0) * 100).toFixed(0)}%
                  </p>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
