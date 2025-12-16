import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type AppState = 'upload' | 'analyzing' | 'results'

type AnalysisResult = {
  estimated_prompt: string
  color_palette: string[]
  style_tags: string[]
  mood: string
  composition: string
  lighting: string
  confidence: number
}

function App() {
  const [state, setState] = useState<AppState>('upload')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [results, setResults] = useState<AnalysisResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'prompt' | 'colors' | 'style' | 'technical'>('overview')

  const handleFileSelect = async (file: File) => {
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    setState('analyzing')

    // Call API
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('http://localhost:8765/api/analysis/archaeology', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) throw new Error('API request failed')

      const data = await response.json()
      if (!data.success || !data.dna) {
        throw new Error(data.error || 'Analysis failed')
      }
      setResults(data.dna)
      setState('results')
    } catch (error) {
      console.error('Analysis failed:', error)
      setState('upload')
      alert('Analysis failed. Please try again.')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(file)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleReset = () => {
    setState('upload')
    setImageUrl(null)
    setResults(null)
    setActiveTab('overview')
  }

  return (
    <div className="w-full h-full bg-canvas">
      <AnimatePresence mode="wait">
        {state === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full flex items-center justify-center p-12"
          >
            <div className="max-w-2xl w-full">
              <h1 className="font-display text-6xl text-ink mb-2 text-center">Gallery Curator</h1>
              <p className="text-ink-secondary text-center mb-12">Cataloging and analyzing visual specimens</p>

              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-brass transition-colors rounded-lg p-24 text-center cursor-pointer bg-surface"
              >
                <div className="text-brass mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-ink-secondary mb-2">Drop your image here or click to browse</p>
                <p className="text-ink-muted text-sm">Accepts JPG, PNG, WebP</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>
          </motion.div>
        )}

        {state === 'analyzing' && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full flex items-center justify-center"
          >
            <div className="text-center">
              <div className="w-64 h-2 bg-canvas-muted rounded-full mb-6 shimmer" />
              <p className="text-ink-secondary font-display text-xl">Cataloging specimen...</p>
            </div>
          </motion.div>
        )}

        {state === 'results' && results && imageUrl && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full flex"
          >
            {/* Left Panel - Image Display */}
            <div className="w-[60%] h-full p-8 flex items-center justify-center relative">
              <div className="relative max-w-full max-h-full">
                {/* Brass frame */}
                <div className="relative p-1 bg-brass rounded-lg shadow-xl">
                  <div className="relative bg-surface p-2">
                    <img
                      src={imageUrl}
                      alt="Analyzed specimen"
                      className="max-w-full max-h-[calc(100vh-16rem)] object-contain"
                    />
                  </div>
                </div>

                {/* Floating specimen label */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-surface-raised shadow-lg rounded-lg px-6 py-3 border border-border-strong min-w-64"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs text-ink-muted uppercase tracking-wide mb-1">Confidence</div>
                      <div className="text-2xl font-display text-brass">{Math.round(results.confidence * 100)}%</div>
                    </div>
                    <div className="h-8 w-px bg-border" />
                    <div>
                      <div className="text-xs text-ink-muted uppercase tracking-wide mb-1">Primary Style</div>
                      <div className="text-sm text-ink-secondary font-medium">{results.style_tags[0] || 'Unknown'}</div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Reset button */}
              <button
                onClick={handleReset}
                className="absolute top-8 left-8 px-4 py-2 bg-surface border border-border hover:border-brass rounded-lg text-ink-secondary hover:text-brass transition-colors text-sm font-medium"
              >
                ← New Analysis
              </button>
            </div>

            {/* Right Panel - Tabbed Analysis */}
            <div className="w-[40%] h-full bg-surface border-l border-border flex flex-col">
              {/* Tab Navigation */}
              <div className="border-b border-border px-6 pt-6">
                <div className="flex gap-1">
                  {[
                    { id: 'overview', label: 'Overview' },
                    { id: 'prompt', label: 'Prompt DNA' },
                    { id: 'colors', label: 'Colors' },
                    { id: 'style', label: 'Style' },
                    { id: 'technical', label: 'Technical' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                        activeTab === tab.id
                          ? 'text-brass'
                          : 'text-ink-muted hover:text-ink-secondary'
                      }`}
                    >
                      {tab.label}
                      {activeTab === tab.id && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-brass"
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <AnimatePresence mode="wait">
                  {activeTab === 'overview' && (
                    <motion.div
                      key="overview"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      <div>
                        <h3 className="text-sm font-semibold text-ink-muted uppercase tracking-wide mb-2">Estimated Prompt</h3>
                        <p className="text-ink leading-relaxed">{results.estimated_prompt}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-ink-muted uppercase tracking-wide mb-2">Analysis Confidence</h3>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-canvas-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brass transition-all"
                              style={{ width: `${results.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-ink-secondary font-mono text-sm">{Math.round(results.confidence * 100)}%</span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'prompt' && (
                    <motion.div
                      key="prompt"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <h3 className="text-sm font-semibold text-ink-muted uppercase tracking-wide mb-3">Extracted Prompt</h3>
                      <div className="bg-canvas-subtle border border-border rounded-lg p-4">
                        <p className="text-ink font-mono text-sm leading-relaxed whitespace-pre-wrap">{results.estimated_prompt}</p>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'colors' && (
                    <motion.div
                      key="colors"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <h3 className="text-sm font-semibold text-ink-muted uppercase tracking-wide mb-4">Color Palette</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {results.color_palette.map((color, idx) => (
                          <div key={idx} className="space-y-2">
                            <div
                              className="w-full h-20 rounded-lg border border-border-strong shadow-sm"
                              style={{ backgroundColor: color }}
                            />
                            <div className="font-mono text-xs text-ink-secondary text-center">{color}</div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'style' && (
                    <motion.div
                      key="style"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      <div>
                        <h3 className="text-sm font-semibold text-ink-muted uppercase tracking-wide mb-3">Style Tags</h3>
                        <div className="flex flex-wrap gap-2">
                          {results.style_tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1.5 bg-brass-muted text-brass-dark rounded-full text-sm font-medium"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-ink-muted uppercase tracking-wide mb-2">Mood</h3>
                        <p className="text-ink-secondary">{results.mood}</p>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'technical' && (
                    <motion.div
                      key="technical"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      <div>
                        <h3 className="text-sm font-semibold text-ink-muted uppercase tracking-wide mb-2">Composition</h3>
                        <p className="text-ink-secondary leading-relaxed">{results.composition}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-ink-muted uppercase tracking-wide mb-2">Lighting</h3>
                        <p className="text-ink-secondary leading-relaxed">{results.lighting}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
