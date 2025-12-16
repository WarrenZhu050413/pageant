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

type Tab = 'genetic' | 'color' | 'style' | 'composition' | 'raw'

export default function App() {
  const [state, setState] = useState<AppState>('upload')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string>('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('genetic')
  const [specimenId, setSpecimenId] = useState<string>('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const generateSpecimenId = () => {
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `SPEC-${timestamp}-${random}`
  }

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) return

    setImageFile(file)
    setImageUrl(URL.createObjectURL(file))
    setSpecimenId(generateSpecimenId())
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleAnalyze = async () => {
    if (!imageFile) return

    setState('analyzing')

    const formData = new FormData()
    formData.append('file', imageFile)

    try {
      const response = await fetch('http://localhost:8765/api/analysis/archaeology', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('Analysis failed')

      const data = await response.json()
      if (!data.success || !data.dna) {
        throw new Error(data.error || 'Analysis failed')
      }
      setResult(data.dna)

      // Simulate DNA sequencing delay for dramatic effect
      setTimeout(() => {
        setState('results')
      }, 2000)
    } catch (error) {
      console.error('Analysis error:', error)
      setState('upload')
      alert('Analysis failed. Please try again.')
    }
  }

  const handleReset = () => {
    setState('upload')
    setImageFile(null)
    setImageUrl('')
    setResult(null)
    setActiveTab('genetic')
    setSpecimenId('')
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="h-screen flex flex-col bg-canvas">
      {/* Header */}
      <header className="border-b border-border-strong bg-surface px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-semibold text-ink">Design DNA Lab</h1>
            <p className="text-sm text-ink-tertiary font-mono">Specimen Analysis System v2.4.1</p>
          </div>
          {state === 'results' && (
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-brass text-surface rounded-md hover:bg-brass-dark transition-colors font-medium"
            >
              New Analysis
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {state === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex items-center justify-center p-8"
            >
              <div className="max-w-2xl w-full">
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
                    transition-all duration-200
                    ${isDragging
                      ? 'border-brass bg-brass-muted scale-105'
                      : 'border-border-strong bg-surface hover:border-brass hover:bg-canvas-subtle'
                    }
                  `}
                >
                  <div className="mb-6">
                    <svg className="mx-auto h-16 w-16 text-brass" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>

                  {imageFile ? (
                    <div className="space-y-3">
                      <div className="aspect-video max-h-64 mx-auto rounded overflow-hidden bg-canvas-muted">
                        <img src={imageUrl} alt="Selected" className="w-full h-full object-contain" />
                      </div>
                      <p className="text-sm text-ink-secondary font-medium">{imageFile.name}</p>
                      <p className="text-xs text-ink-muted font-mono">ID: {specimenId}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAnalyze()
                        }}
                        className="mt-4 px-8 py-3 bg-brass text-surface rounded-md hover:bg-brass-dark transition-colors font-semibold shadow-md"
                      >
                        Submit Specimen for Analysis
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg text-ink-secondary font-medium mb-2">
                        Upload Design Specimen
                      </p>
                      <p className="text-sm text-ink-muted">
                        Drop an image file here or click to browse
                      </p>
                      <p className="text-xs text-ink-muted mt-2 font-mono">
                        Supported formats: JPG, PNG, WebP
                      </p>
                    </div>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
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
              className="h-full flex items-center justify-center"
            >
              <div className="text-center">
                <div className="mb-8">
                  <div className="dna-helix mx-auto mb-6"></div>
                  <style>{`
                    @keyframes dna-rotate {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                    @keyframes dna-pulse {
                      0%, 100% { opacity: 0.3; }
                      50% { opacity: 1; }
                    }
                    .dna-helix {
                      width: 80px;
                      height: 80px;
                      position: relative;
                      animation: dna-rotate 3s linear infinite;
                    }
                    .dna-helix::before,
                    .dna-helix::after {
                      content: '';
                      position: absolute;
                      width: 100%;
                      height: 100%;
                      border: 3px solid var(--color-brass);
                      border-radius: 50%;
                      animation: dna-pulse 1.5s ease-in-out infinite;
                    }
                    .dna-helix::after {
                      animation-delay: 0.75s;
                      border-color: var(--color-accent);
                    }
                  `}</style>
                </div>
                <p className="text-xl font-display font-semibold text-ink mb-2">
                  Sequencing Design Genome
                </p>
                <p className="text-sm text-ink-tertiary font-mono mb-1">
                  Analyzing chromatic structure...
                </p>
                <p className="text-sm text-ink-tertiary font-mono mb-1">
                  Mapping compositional DNA...
                </p>
                <p className="text-sm text-ink-tertiary font-mono">
                  Identifying style markers...
                </p>
                <p className="text-xs text-ink-muted font-mono mt-6">
                  SPECIMEN: {specimenId}
                </p>
              </div>
            </motion.div>
          )}

          {state === 'results' && result && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col"
            >
              {/* Image Section - Top 50% */}
              <div className="h-1/2 border-b border-border-strong bg-canvas-muted relative overflow-hidden">
                <div className="absolute inset-0 grid-pattern opacity-30"></div>
                <style>{`
                  .grid-pattern {
                    background-image:
                      linear-gradient(var(--color-border) 1px, transparent 1px),
                      linear-gradient(90deg, var(--color-border) 1px, transparent 1px);
                    background-size: 20px 20px;
                  }
                `}</style>

                {/* Measurement markers */}
                <div className="absolute top-2 left-2 text-xs font-mono text-ink-muted">0,0</div>
                <div className="absolute top-2 right-2 text-xs font-mono text-ink-muted">X-MAX</div>
                <div className="absolute bottom-2 left-2 text-xs font-mono text-ink-muted">Y-MAX</div>
                <div className="absolute bottom-2 right-2 text-xs font-mono text-ink-muted bg-surface px-2 py-1 rounded">
                  ID: {specimenId}
                </div>

                <div className="relative h-full flex items-center justify-center p-8">
                  <img
                    src={imageUrl}
                    alt="Analysis subject"
                    className="max-h-full max-w-full object-contain shadow-xl rounded"
                  />
                </div>
              </div>

              {/* Analysis Tabs - Bottom 50% */}
              <div className="h-1/2 flex flex-col bg-surface">
                {/* Tab Headers */}
                <div className="flex border-b border-border-strong bg-canvas-subtle px-6">
                  {[
                    { id: 'genetic' as Tab, label: 'GENETIC PROFILE' },
                    { id: 'color' as Tab, label: 'COLOR GENOME' },
                    { id: 'style' as Tab, label: 'STYLE MARKERS' },
                    { id: 'composition' as Tab, label: 'COMPOSITION MAP' },
                    { id: 'raw' as Tab, label: 'RAW DATA' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`
                        px-4 py-3 text-sm font-mono font-medium transition-colors relative
                        ${activeTab === tab.id
                          ? 'text-brass'
                          : 'text-ink-muted hover:text-ink-secondary'
                        }
                      `}
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

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  <AnimatePresence mode="wait">
                    {activeTab === 'genetic' && (
                      <motion.div
                        key="genetic"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                      >
                        <div>
                          <h3 className="text-sm font-mono font-semibold text-ink-tertiary mb-3">
                            PRIMARY SEQUENCE
                          </h3>
                          <p className="text-lg text-ink leading-relaxed">
                            {result.estimated_prompt}
                          </p>
                        </div>

                        <div>
                          <h3 className="text-sm font-mono font-semibold text-ink-tertiary mb-3">
                            MATCH CONFIDENCE
                          </h3>
                          <div className="flex items-center gap-4">
                            <div className="flex-1 bg-canvas-muted rounded-full h-3 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${result.confidence * 100}%` }}
                                transition={{ duration: 1, delay: 0.3 }}
                                className="h-full bg-brass"
                              />
                            </div>
                            <span className="text-2xl font-mono font-bold text-brass">
                              {(result.confidence * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {activeTab === 'color' && (
                      <motion.div
                        key="color"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        <h3 className="text-sm font-mono font-semibold text-ink-tertiary mb-4">
                          CHROMATIC STRIP ANALYSIS
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                          {result.color_palette.map((color, i) => (
                            <div key={i} className="space-y-2">
                              <div
                                className="aspect-square rounded-lg shadow-md border border-border"
                                style={{ backgroundColor: color }}
                              />
                              <p className="text-center text-sm font-mono font-medium text-ink-secondary">
                                {color.toUpperCase()}
                              </p>
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
                      >
                        <h3 className="text-sm font-mono font-semibold text-ink-tertiary mb-4">
                          IDENTIFIED GENE MARKERS
                        </h3>
                        <div className="flex flex-wrap gap-3">
                          {result.style_tags.map((tag, i) => (
                            <motion.span
                              key={i}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.05 }}
                              className="px-4 py-2 bg-brass-muted border border-brass rounded-md text-sm font-mono font-medium text-brass-dark"
                            >
                              {tag}
                            </motion.span>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {activeTab === 'composition' && (
                      <motion.div
                        key="composition"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                      >
                        <div>
                          <h3 className="text-sm font-mono font-semibold text-ink-tertiary mb-2">
                            COMPOSITION
                          </h3>
                          <p className="text-base text-ink">{result.composition}</p>
                        </div>

                        <div>
                          <h3 className="text-sm font-mono font-semibold text-ink-tertiary mb-2">
                            LIGHTING
                          </h3>
                          <p className="text-base text-ink">{result.lighting}</p>
                        </div>

                        <div>
                          <h3 className="text-sm font-mono font-semibold text-ink-tertiary mb-2">
                            MOOD
                          </h3>
                          <p className="text-base text-ink">{result.mood}</p>
                        </div>
                      </motion.div>
                    )}

                    {activeTab === 'raw' && (
                      <motion.div
                        key="raw"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-mono font-semibold text-ink-tertiary">
                            RAW ANALYSIS OUTPUT
                          </h3>
                          <button
                            onClick={() => copyToClipboard(JSON.stringify(result, null, 2))}
                            className="px-3 py-1.5 bg-canvas-muted hover:bg-canvas-subtle border border-border rounded text-xs font-mono font-medium text-ink-secondary transition-colors"
                          >
                            COPY JSON
                          </button>
                        </div>
                        <pre className="bg-canvas-muted border border-border rounded-lg p-4 text-sm font-mono text-ink overflow-x-auto">
{JSON.stringify(result, null, 2)}
                        </pre>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
