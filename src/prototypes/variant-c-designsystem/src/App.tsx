import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type View = 'upload' | 'loading' | 'results';
type Tab = 'overview' | 'colors' | 'typography' | 'components' | 'export';

interface ColorDef {
  hex: string;
  name: string;
  usage: string;
}

interface DesignSystem {
  name: string;
  description: string;
  colors: {
    primary?: ColorDef;
    secondary?: ColorDef;
    accent?: ColorDef;
    background?: ColorDef;
    surface?: ColorDef;
    text?: { primary?: string; secondary?: string; muted?: string };
  };
  typography: {
    heading?: { family: string; weight: string; style?: string; characteristics?: string };
    body?: { family: string; weight: string; lineHeight?: string; characteristics?: string };
    accent?: { family: string; usage?: string };
  };
  spacing?: { scale?: string; rhythm?: string; recommendations?: string[] };
  borders?: { radius?: string; style?: string; color_approach?: string };
  shadows?: { style?: string; recommendations?: string };
  iconography?: { style?: string; weight?: string; recommendations?: string };
  imagery?: { style?: string; treatment?: string; recommendations?: string };
  mood_keywords: string[];
  component_suggestions: { name: string; description: string; css_snippet?: string }[];
  tailwind_config?: Record<string, unknown>;
}

const API_URL = 'http://localhost:8765';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'colors', label: 'Colors' },
  { id: 'typography', label: 'Typography' },
  { id: 'components', label: 'Components' },
  { id: 'export', label: 'Export' },
];

const LOADING_MESSAGES = [
  'Analyzing colors...',
  'Extracting typography...',
  'Identifying components...',
  'Building design system...',
];

export default function App() {
  const [view, setView] = useState<View>('upload');
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [designSystem, setDesignSystem] = useState<DesignSystem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (view === 'loading') {
      const interval = setInterval(() => {
        setLoadingMessage((i) => (i + 1) % LOADING_MESSAGES.length);
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [view]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setView('loading');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/api/analysis/design-system`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success && data.design_system) {
        setDesignSystem(data.design_system);
        setView('results');
        setActiveTab('overview');
      } else {
        throw new Error(data.error || 'Analysis failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setView('upload');
    }
  }, []);

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const reset = useCallback(() => {
    setView('upload');
    setImagePreview(null);
    setDesignSystem(null);
    setError(null);
    setActiveTab('overview');
  }, []);

  const generateCSSVariables = useCallback(() => {
    if (!designSystem) return '';
    const vars: string[] = [':root {'];
    const colors = designSystem.colors || {};
    if (colors.primary?.hex) vars.push(`  --color-primary: ${colors.primary.hex};`);
    if (colors.secondary?.hex) vars.push(`  --color-secondary: ${colors.secondary.hex};`);
    if (colors.accent?.hex) vars.push(`  --color-accent: ${colors.accent.hex};`);
    if (colors.background?.hex) vars.push(`  --color-background: ${colors.background.hex};`);
    if (colors.surface?.hex) vars.push(`  --color-surface: ${colors.surface.hex};`);
    if (colors.text?.primary) vars.push(`  --color-text-primary: ${colors.text.primary};`);
    if (colors.text?.secondary) vars.push(`  --color-text-secondary: ${colors.text.secondary};`);
    if (colors.text?.muted) vars.push(`  --color-text-muted: ${colors.text.muted};`);
    vars.push('}');
    return vars.join('\n');
  }, [designSystem]);

  const ColorSwatch = ({ color, label }: { color?: ColorDef; label: string }) => {
    if (!color?.hex) return null;
    return (
      <div className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm">
        <div
          className="w-16 h-16 rounded-xl shadow-inner cursor-pointer hover:scale-105 transition-transform"
          style={{ backgroundColor: color.hex }}
          onClick={() => copyToClipboard(color.hex, color.hex)}
        />
        <div className="flex-1">
          <div className="font-semibold text-gray-800">{label}</div>
          <div className="text-sm text-gray-500">{color.name}</div>
          <button
            onClick={() => copyToClipboard(color.hex, color.hex)}
            className="text-sm font-mono text-blue-500 hover:text-blue-600"
          >
            {copied === color.hex ? '✓ Copied!' : color.hex}
          </button>
          {color.usage && <div className="text-xs text-gray-400 mt-1">{color.usage}</div>}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
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
            <h1 className="text-4xl font-bold mb-2 text-gray-800">
              Design System Generator
            </h1>
            <p className="text-gray-500 mb-8">
              Extract a complete design system from any image
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              className={`
                w-full max-w-xl min-h-[300px] border-2 border-dashed rounded-2xl
                flex flex-col items-center justify-center cursor-pointer transition-all
                ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-100'}
              `}
            >
              <div className="text-5xl mb-4">🎨</div>
              <p className="text-lg text-gray-600 mb-2">Drop your hero image here</p>
              <p className="text-gray-400">or click to select</p>
              <p className="text-xs text-gray-400 mt-4">
                Works best with UI screenshots, posters, or branded imagery
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="hidden"
            />

            {error && <p className="mt-4 text-red-500">{error}</p>}
          </motion.div>
        )}

        {/* LOADING VIEW */}
        {view === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col items-center justify-center p-8"
          >
            {imagePreview && (
              <img src={imagePreview} alt="Analyzing" className="max-w-xs rounded-xl shadow-lg mb-8" />
            )}
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"
              />
              <motion.p
                key={loadingMessage}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-lg text-gray-600"
              >
                {LOADING_MESSAGES[loadingMessage]}
              </motion.p>
            </div>
          </motion.div>
        )}

        {/* RESULTS VIEW */}
        {view === 'results' && designSystem && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen"
          >
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
              <h1 className="text-2xl font-bold text-gray-800">{designSystem.name || 'Design System'}</h1>
              <button
                onClick={reset}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Analyze Another
              </button>
            </header>

            {/* Tabs */}
            <nav className="bg-white border-b border-gray-200 px-8">
              <div className="flex gap-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      px-4 py-3 text-sm font-medium transition-colors relative
                      ${activeTab === tab.id ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}
                    `}
                  >
                    {tab.label}
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="tab-indicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                      />
                    )}
                  </button>
                ))}
              </div>
            </nav>

            {/* Tab Content */}
            <main className="p-8 max-w-5xl mx-auto">
              <AnimatePresence mode="wait">
                {activeTab === 'overview' && (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    <h2 className="text-3xl font-bold text-gray-800">{designSystem.name}</h2>
                    <p className="text-lg text-gray-600">{designSystem.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {designSystem.mood_keywords?.map((keyword, i) => (
                        <span key={i} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'colors' && (
                  <motion.div
                    key="colors"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    <h2 className="text-2xl font-bold text-gray-800">Colors</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <ColorSwatch color={designSystem.colors?.primary} label="Primary" />
                      <ColorSwatch color={designSystem.colors?.secondary} label="Secondary" />
                      <ColorSwatch color={designSystem.colors?.accent} label="Accent" />
                      <ColorSwatch color={designSystem.colors?.background} label="Background" />
                      <ColorSwatch color={designSystem.colors?.surface} label="Surface" />
                    </div>
                    {designSystem.colors?.text && (
                      <div className="mt-6">
                        <h3 className="text-lg font-semibold text-gray-700 mb-3">Text Colors</h3>
                        <div className="flex gap-4">
                          {designSystem.colors.text.primary && (
                            <div className="px-4 py-2 rounded-lg" style={{ backgroundColor: designSystem.colors.text.primary, color: '#fff' }}>
                              Primary Text
                            </div>
                          )}
                          {designSystem.colors.text.secondary && (
                            <div className="px-4 py-2 rounded-lg" style={{ backgroundColor: designSystem.colors.text.secondary, color: '#fff' }}>
                              Secondary Text
                            </div>
                          )}
                          {designSystem.colors.text.muted && (
                            <div className="px-4 py-2 rounded-lg border" style={{ color: designSystem.colors.text.muted }}>
                              Muted Text
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'typography' && (
                  <motion.div
                    key="typography"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                  >
                    <h2 className="text-2xl font-bold text-gray-800">Typography</h2>
                    {designSystem.typography?.heading && (
                      <div className="bg-white rounded-xl p-6 shadow-sm">
                        <h3 className="text-sm text-gray-500 mb-2">Heading</h3>
                        <p className="text-4xl font-bold mb-3" style={{ fontFamily: designSystem.typography.heading.family }}>
                          The quick brown fox
                        </p>
                        <div className="text-sm text-gray-500">
                          <span className="mr-4">Family: {designSystem.typography.heading.family}</span>
                          <span className="mr-4">Weight: {designSystem.typography.heading.weight}</span>
                          {designSystem.typography.heading.style && <span>Style: {designSystem.typography.heading.style}</span>}
                        </div>
                      </div>
                    )}
                    {designSystem.typography?.body && (
                      <div className="bg-white rounded-xl p-6 shadow-sm">
                        <h3 className="text-sm text-gray-500 mb-2">Body</h3>
                        <p className="text-base mb-3" style={{ fontFamily: designSystem.typography.body.family }}>
                          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                        </p>
                        <div className="text-sm text-gray-500">
                          <span className="mr-4">Family: {designSystem.typography.body.family}</span>
                          <span className="mr-4">Weight: {designSystem.typography.body.weight}</span>
                          {designSystem.typography.body.lineHeight && <span>Line Height: {designSystem.typography.body.lineHeight}</span>}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'components' && (
                  <motion.div
                    key="components"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    <h2 className="text-2xl font-bold text-gray-800">Components</h2>
                    <div className="space-y-4">
                      {designSystem.component_suggestions?.map((comp, i) => (
                        <div key={i} className="bg-white rounded-xl p-6 shadow-sm">
                          <h3 className="text-lg font-semibold text-gray-800 mb-2">{comp.name}</h3>
                          <p className="text-gray-600 mb-4">{comp.description}</p>
                          {comp.css_snippet && (
                            <div className="relative">
                              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto font-mono">
                                {comp.css_snippet}
                              </pre>
                              <button
                                onClick={() => copyToClipboard(comp.css_snippet || '', `css-${i}`)}
                                className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                              >
                                {copied === `css-${i}` ? '✓' : 'Copy'}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'export' && (
                  <motion.div
                    key="export"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    <h2 className="text-2xl font-bold text-gray-800">Export</h2>

                    <div className="bg-white rounded-xl p-6 shadow-sm">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-lg font-semibold text-gray-800">CSS Variables</h3>
                        <button
                          onClick={() => copyToClipboard(generateCSSVariables(), 'css-vars')}
                          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          {copied === 'css-vars' ? '✓ Copied!' : 'Copy'}
                        </button>
                      </div>
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto font-mono">
                        {generateCSSVariables()}
                      </pre>
                    </div>

                    {designSystem.tailwind_config && (
                      <div className="bg-white rounded-xl p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="text-lg font-semibold text-gray-800">Tailwind Config</h3>
                          <button
                            onClick={() => copyToClipboard(JSON.stringify(designSystem.tailwind_config, null, 2), 'tailwind')}
                            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            {copied === 'tailwind' ? '✓ Copied!' : 'Copy'}
                          </button>
                        </div>
                        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto font-mono">
                          {JSON.stringify(designSystem.tailwind_config, null, 2)}
                        </pre>
                      </div>
                    )}

                    <div className="bg-white rounded-xl p-6 shadow-sm">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-lg font-semibold text-gray-800">Full JSON</h3>
                        <button
                          onClick={() => copyToClipboard(JSON.stringify(designSystem, null, 2), 'full-json')}
                          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          {copied === 'full-json' ? '✓ Copied!' : 'Copy'}
                        </button>
                      </div>
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto font-mono max-h-96">
                        {JSON.stringify(designSystem, null, 2)}
                      </pre>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
