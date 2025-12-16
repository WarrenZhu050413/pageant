import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type AppState = 'upload' | 'analyzing' | 'results'

interface AnalysisResult {
  estimated_prompt: string
  color_palette: string[]
  style_tags: string[]
  mood: string
  composition: string
  lighting: string
  confidence: number
}

export default function App() {
  const [state, setState] = useState<AppState>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [activeTab, setActiveTab] = useState<'territory' | 'palette' | 'landmarks' | 'log'>('territory')
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    setError(null)
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    setState('analyzing')

    const formData = new FormData()
    formData.append('file', file)

    fetch('http://localhost:8765/api/analysis/archaeology', {
      method: 'POST',
      body: formData,
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success || !data.dna) {
          throw new Error(data.error || 'Analysis failed')
        }
        setResult(data.dna)
        setState('results')
      })
      .catch(err => {
        console.error('Analysis failed:', err)
        setError('Failed to analyze image. Please try again.')
        setState('upload')
        setImageUrl(null)
      })
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }, [handleFileSelect])

  const handleReset = useCallback(() => {
    setState('upload')
    setImageUrl(null)
    setResult(null)
    setError(null)
    setActiveTab('territory')
  }, [])

  return (
    <div className="h-screen flex flex-col bg-[var(--color-canvas)]">
      {/* Header */}
      <header className="h-16 border-b border-[var(--color-border-strong)] bg-[var(--color-surface)] flex items-center px-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-3">
          <CompassIcon className="w-8 h-8 text-[var(--color-brass)]" />
          <div>
            <h1 className="text-xl font-[var(--font-display)] font-semibold text-[var(--color-ink)]">
              Style Atlas
            </h1>
            <p className="text-xs text-[var(--color-ink-tertiary)] font-[var(--font-mono)]">
              Design Exploration System
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {state === 'upload' && (
            <UploadView
              key="upload"
              isDragging={isDragging}
              error={error}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onInputChange={handleInputChange}
            />
          )}

          {state === 'analyzing' && (
            <AnalyzingView key="analyzing" />
          )}

          {state === 'results' && result && imageUrl && (
            <ResultsView
              key="results"
              result={result}
              imageUrl={imageUrl}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onReset={handleReset}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

// Upload View Component
function UploadView({
  isDragging,
  error,
  onDrop,
  onDragOver,
  onDragLeave,
  onInputChange,
}: {
  isDragging: boolean
  error: string | null
  onDrop: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full flex items-center justify-center p-8"
    >
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-[var(--font-display)] font-semibold text-[var(--color-ink)] mb-3">
            Chart New Territory
          </h2>
          <p className="text-lg text-[var(--color-ink-secondary)]">
            Upload an image to map its design coordinates and discover hidden style landmarks
          </p>
        </div>

        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={`
            relative border-2 border-dashed rounded-[var(--radius-xl)] p-12
            transition-all duration-200 bg-[var(--color-surface)]
            ${isDragging
              ? 'border-[var(--color-brass)] bg-[var(--color-brass-muted)]'
              : 'border-[var(--color-border-strong)]'
            }
          `}
        >
          {/* Decorative Map Grid */}
          <div className="absolute inset-0 opacity-5 pointer-events-none">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          <div className="relative text-center">
            <CompassIcon className="w-20 h-20 text-[var(--color-brass)] mx-auto mb-6" />

            <h3 className="text-2xl font-[var(--font-display)] font-semibold text-[var(--color-ink)] mb-2">
              Begin Your Exploration
            </h3>
            <p className="text-[var(--color-ink-secondary)] mb-6">
              Drop an image here or click to select from your archives
            </p>

            <label className="inline-block">
              <input
                type="file"
                accept="image/*"
                onChange={onInputChange}
                className="hidden"
              />
              <span className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-brass)] text-white rounded-[var(--radius-md)] font-medium hover:bg-[var(--color-brass-dark)] transition-colors cursor-pointer shadow-[var(--shadow-md)]">
                <MapIcon className="w-5 h-5" />
                Select Image
              </span>
            </label>
          </div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 rounded-[var(--radius-md)] text-[var(--color-error)] text-center"
          >
            {error}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

// Analyzing View Component
function AnalyzingView() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full flex items-center justify-center"
    >
      <div className="text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="mb-6"
        >
          <CompassIcon className="w-24 h-24 text-[var(--color-brass)] mx-auto" />
        </motion.div>

        <h3 className="text-3xl font-[var(--font-display)] font-semibold text-[var(--color-ink)] mb-3">
          Mapping Style Coordinates
        </h3>

        <div className="space-y-2 text-[var(--color-ink-secondary)]">
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            Surveying visual terrain...
          </motion.p>
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, delay: 0.5, repeat: Infinity }}
          >
            Charting color regions...
          </motion.p>
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, delay: 1, repeat: Infinity }}
          >
            Documenting landmarks...
          </motion.p>
        </div>
      </div>
    </motion.div>
  )
}

// Results View Component
function ResultsView({
  result,
  imageUrl,
  activeTab,
  onTabChange,
  onReset,
}: {
  result: AnalysisResult
  imageUrl: string
  activeTab: string
  onTabChange: (tab: 'territory' | 'palette' | 'landmarks' | 'log') => void
  onReset: () => void
}) {
  // Generate mock coordinates based on style
  const coordinates = `${Math.floor(result.confidence * 90)}°N, ${Math.floor(Math.random() * 180)}°W`

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full flex"
    >
      {/* Left Sidebar - Navigator */}
      <aside className="w-[200px] bg-[var(--color-surface)] border-r border-[var(--color-border)] p-4 overflow-y-auto">
        <div className="mb-6">
          <h3 className="text-sm font-[var(--font-mono)] font-semibold text-[var(--color-brass)] uppercase tracking-wider mb-4">
            Navigator
          </h3>

          {/* Altitude (Confidence) */}
          <div className="mb-6">
            <div className="text-xs text-[var(--color-ink-tertiary)] mb-2 font-[var(--font-mono)]">
              ALTITUDE
            </div>
            <div className="relative h-32 w-12 bg-[var(--color-canvas-muted)] rounded-[var(--radius-sm)] overflow-hidden">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${result.confidence * 100}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="absolute bottom-0 w-full bg-gradient-to-t from-[var(--color-accent)] to-[var(--color-accent-light)]"
              />
            </div>
            <div className="text-2xl font-[var(--font-display)] font-semibold text-[var(--color-ink)] mt-2">
              {Math.round(result.confidence * 100)}%
            </div>
          </div>

          {/* Terrain (Primary Style) */}
          <div className="mb-6">
            <div className="text-xs text-[var(--color-ink-tertiary)] mb-2 font-[var(--font-mono)]">
              TERRAIN
            </div>
            <div className="text-sm font-medium text-[var(--color-ink)] bg-[var(--color-brass-muted)] px-3 py-2 rounded-[var(--radius-sm)]">
              {result.style_tags[0] || 'Unknown'}
            </div>
          </div>

          {/* Climate (Mood) */}
          <div className="mb-6">
            <div className="text-xs text-[var(--color-ink-tertiary)] mb-2 font-[var(--font-mono)]">
              CLIMATE
            </div>
            <div className="text-sm font-medium text-[var(--color-ink)]">
              {result.mood}
            </div>
          </div>
        </div>

        <button
          onClick={onReset}
          className="w-full px-4 py-2 bg-[var(--color-brass)] text-white rounded-[var(--radius-md)] font-medium hover:bg-[var(--color-brass-dark)] transition-colors text-sm"
        >
          New Expedition
        </button>
      </aside>

      {/* Center - Image Display */}
      <div className="flex-1 p-8 overflow-y-auto flex items-center justify-center">
        <div className="relative max-w-4xl w-full">
          {/* Coordinates Badge */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 bg-[var(--color-brass)] text-white px-4 py-1 rounded-full text-sm font-[var(--font-mono)] shadow-[var(--shadow-md)]">
            {coordinates}
          </div>

          {/* Image with Topographic Border */}
          <div className="relative border-4 border-[var(--color-brass)]/30 rounded-[var(--radius-lg)] overflow-hidden shadow-[var(--shadow-xl)] bg-[var(--color-surface)]">
            {/* Decorative corner markers */}
            <div className="absolute top-2 left-2 w-8 h-8 border-t-2 border-l-2 border-[var(--color-brass)]" />
            <div className="absolute top-2 right-2 w-8 h-8 border-t-2 border-r-2 border-[var(--color-brass)]" />
            <div className="absolute bottom-2 left-2 w-8 h-8 border-b-2 border-l-2 border-[var(--color-brass)]" />
            <div className="absolute bottom-2 right-2 w-8 h-8 border-b-2 border-r-2 border-[var(--color-brass)]" />

            {/* Compass Rose Watermark */}
            <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
              <CompassIcon className="w-64 h-64 text-[var(--color-ink)]" />
            </div>

            <img
              src={imageUrl}
              alt="Analyzed design"
              className="w-full h-auto relative z-[1]"
            />
          </div>
        </div>
      </div>

      {/* Right Panel - Tabbed Analysis */}
      <aside className="w-[320px] bg-[var(--color-surface)] border-l border-[var(--color-border)] flex flex-col">
        {/* Tab Headers */}
        <div className="border-b border-[var(--color-border)] flex">
          {[
            { id: 'territory', label: 'Territory' },
            { id: 'palette', label: 'Palette' },
            { id: 'landmarks', label: 'Landmarks' },
            { id: 'log', label: 'Log' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as any)}
              className={`
                flex-1 px-3 py-3 text-sm font-medium transition-colors relative
                ${activeTab === tab.id
                  ? 'text-[var(--color-brass)] bg-[var(--color-brass-muted)]'
                  : 'text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink)]'
                }
              `}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-brass)]"
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <AnimatePresence mode="wait">
            {activeTab === 'territory' && (
              <motion.div
                key="territory"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div>
                  <h4 className="text-xs font-[var(--font-mono)] font-semibold text-[var(--color-brass)] uppercase tracking-wider mb-2">
                    Expedition Report
                  </h4>
                  <p className="text-sm text-[var(--color-ink-secondary)] leading-relaxed">
                    {result.estimated_prompt}
                  </p>
                </div>
              </motion.div>
            )}

            {activeTab === 'palette' && (
              <motion.div
                key="palette"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div>
                  <h4 className="text-xs font-[var(--font-mono)] font-semibold text-[var(--color-brass)] uppercase tracking-wider mb-3">
                    Regional Colors
                  </h4>
                  <div className="space-y-2">
                    {result.color_palette.map((color, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-[var(--radius-sm)] border border-[var(--color-border)] shadow-[var(--shadow-sm)]"
                          style={{ backgroundColor: color }}
                        />
                        <div>
                          <div className="text-xs font-[var(--font-mono)] text-[var(--color-ink-tertiary)]">
                            Color {i + 1}
                          </div>
                          <div className="text-sm font-[var(--font-mono)] font-medium text-[var(--color-ink)]">
                            {color}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'landmarks' && (
              <motion.div
                key="landmarks"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div>
                  <h4 className="text-xs font-[var(--font-mono)] font-semibold text-[var(--color-brass)] uppercase tracking-wider mb-3">
                    Notable Features
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {result.style_tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-[var(--color-canvas-subtle)] text-[var(--color-ink)] text-sm rounded-full border border-[var(--color-border)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'log' && (
              <motion.div
                key="log"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div>
                  <h4 className="text-xs font-[var(--font-mono)] font-semibold text-[var(--color-brass)] uppercase tracking-wider mb-2">
                    Field Notes
                  </h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-[var(--color-canvas-subtle)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
                      <div className="text-xs text-[var(--color-ink-tertiary)] mb-1 font-[var(--font-mono)]">
                        COMPOSITION
                      </div>
                      <p className="text-sm text-[var(--color-ink-secondary)]">
                        {result.composition}
                      </p>
                    </div>
                    <div className="p-3 bg-[var(--color-canvas-subtle)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
                      <div className="text-xs text-[var(--color-ink-tertiary)] mb-1 font-[var(--font-mono)]">
                        LIGHTING
                      </div>
                      <p className="text-sm text-[var(--color-ink-secondary)]">
                        {result.lighting}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </aside>
    </motion.div>
  )
}

// Icon Components
function CompassIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" opacity="0.4" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="22" y1="12" x2="18" y2="12" />
      <line x1="6" y1="12" x2="2" y2="12" />
    </svg>
  )
}

function MapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  )
}
