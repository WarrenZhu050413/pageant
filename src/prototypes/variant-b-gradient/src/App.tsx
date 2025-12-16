import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type View = 'input' | 'prompts' | 'images';

interface GradientStep {
  step: number;
  pole_a_weight: number;
  pole_b_weight: number;
  prompt: string;
  style_notes?: string;
}

interface GeneratedImage {
  step: number;
  prompt: string;
  image?: { data: string; mime_type: string };
  success: boolean;
  error?: string;
}

const PRESETS = [
  { a: 'minimalist', b: 'maximalist' },
  { a: 'warm', b: 'cold' },
  { a: 'organic', b: 'geometric' },
  { a: 'vintage', b: 'futuristic' },
  { a: 'playful', b: 'serious' },
  { a: 'abstract', b: 'photorealistic' },
];

const API_URL = 'http://localhost:8765';

export default function App() {
  const [view, setView] = useState<View>('input');
  const [poleA, setPoleA] = useState('');
  const [poleB, setPoleB] = useState('');
  const [subject, setSubject] = useState('');
  const [steps, setSteps] = useState(5);
  const [gradient, setGradient] = useState<GradientStep[]>([]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loadingGradient, setLoadingGradient] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectPreset = useCallback((a: string, b: string) => {
    setPoleA(a);
    setPoleB(b);
  }, []);

  const exploreSpectrum = useCallback(async () => {
    if (!poleA || !poleB || !subject) {
      setError('Please fill in all fields');
      return;
    }

    setLoadingGradient(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/analysis/gradient`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pole_a: poleA, pole_b: poleB, subject, steps }),
      });

      const data = await response.json();

      if (data.success && data.gradient) {
        setGradient(data.gradient);
        setView('prompts');
      } else {
        throw new Error(data.error || 'Failed to generate gradient');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate gradient');
    } finally {
      setLoadingGradient(false);
    }
  }, [poleA, poleB, subject, steps]);

  const generateImages = useCallback(async () => {
    setLoadingImages(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('pole_a', poleA);
      formData.append('pole_b', poleB);
      formData.append('subject', subject);
      formData.append('steps', steps.toString());

      const response = await fetch(`${API_URL}/api/analysis/gradient/generate`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success && data.results) {
        setImages(data.results);
        setView('images');
      } else {
        throw new Error(data.error || 'Failed to generate images');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate images');
    } finally {
      setLoadingImages(false);
    }
  }, [poleA, poleB, subject, steps]);

  const reset = useCallback(() => {
    setView('input');
    setGradient([]);
    setImages([]);
    setError(null);
  }, []);

  const GradientBar = () => (
    <div className="relative h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 mb-2">
      <div className="absolute -left-1 -top-6 text-sm font-medium text-blue-600">{poleA}</div>
      <div className="absolute -right-1 -top-6 text-sm font-medium text-purple-600">{poleB}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <AnimatePresence mode="wait">
        {/* INPUT VIEW */}
        {view === 'input' && (
          <motion.div
            key="input"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col items-center justify-center p-8"
          >
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Style Gradient Explorer
            </h1>
            <p className="text-gray-500 mb-8">Interpolate between two style poles</p>

            {/* Presets */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8 max-w-2xl">
              {PRESETS.map(({ a, b }) => (
                <button
                  key={`${a}-${b}`}
                  onClick={() => selectPreset(a, b)}
                  className={`
                    px-4 py-3 rounded-xl text-sm font-medium transition-all
                    bg-gradient-to-r from-blue-50 to-purple-50 border
                    hover:from-blue-100 hover:to-purple-100
                    ${poleA === a && poleB === b ? 'border-blue-500 shadow-md' : 'border-gray-200'}
                  `}
                >
                  <span className="text-blue-600">{a}</span>
                  <span className="text-gray-400 mx-2">↔</span>
                  <span className="text-purple-600">{b}</span>
                </button>
              ))}
            </div>

            {/* Input Fields */}
            <div className="w-full max-w-2xl space-y-4 mb-6">
              <div className="flex gap-4">
                <input
                  type="text"
                  value={poleA}
                  onChange={(e) => setPoleA(e.target.value)}
                  placeholder="Start style..."
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-l-blue-500 border-gray-200 focus:border-blue-400 outline-none transition-colors"
                />
                <input
                  type="text"
                  value={poleB}
                  onChange={(e) => setPoleB(e.target.value)}
                  placeholder="End style..."
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-r-purple-500 border-gray-200 focus:border-purple-400 outline-none transition-colors"
                />
              </div>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What to generate... (e.g., 'a mountain landscape')"
                className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 focus:border-gray-400 outline-none text-lg transition-colors"
              />
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-500">Steps:</label>
                <input
                  type="range"
                  min="3"
                  max="7"
                  value={steps}
                  onChange={(e) => setSteps(Number(e.target.value))}
                  className="flex-1 accent-purple-500"
                />
                <span className="text-sm font-medium w-8">{steps}</span>
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={exploreSpectrum}
              disabled={loadingGradient}
              className="px-8 py-4 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl"
            >
              {loadingGradient ? 'Generating...' : 'Explore Spectrum →'}
            </button>

            {error && (
              <p className="mt-4 text-red-500">{error}</p>
            )}
          </motion.div>
        )}

        {/* PROMPTS VIEW */}
        {view === 'prompts' && (
          <motion.div
            key="prompts"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen p-8"
          >
            <div className="max-w-4xl mx-auto">
              <div className="mb-8 pt-8">
                <GradientBar />
              </div>

              <h2 className="text-2xl font-bold mb-6">Generated Prompts</h2>

              <div className="space-y-4 mb-8">
                {gradient.map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
                  >
                    <div className="flex items-center gap-4 mb-3">
                      <span className="text-lg font-bold text-gray-400">#{step.step}</span>
                      <div className="flex-1 h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${step.pole_a_weight}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-500">
                        {step.pole_a_weight}% / {step.pole_b_weight}%
                      </span>
                    </div>
                    <p className="text-gray-700">{step.prompt}</p>
                    {step.style_notes && (
                      <p className="text-sm text-gray-400 italic mt-2">{step.style_notes}</p>
                    )}
                  </motion.div>
                ))}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setView('input')}
                  className="px-6 py-3 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={generateImages}
                  disabled={loadingImages}
                  className="flex-1 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 transition-all"
                >
                  {loadingImages ? 'Generating Images...' : 'Generate Images →'}
                </button>
              </div>

              {error && <p className="mt-4 text-red-500">{error}</p>}
            </div>
          </motion.div>
        )}

        {/* IMAGES VIEW */}
        {view === 'images' && (
          <motion.div
            key="images"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen p-8"
          >
            <div className="max-w-6xl mx-auto">
              <div className="mb-8 pt-8">
                <GradientBar />
              </div>

              <h2 className="text-2xl font-bold mb-6">Style Spectrum</h2>

              <div className="overflow-x-auto pb-4">
                <div className="flex gap-6 min-w-max">
                  {images.map((img, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.15 }}
                      className="w-64 bg-white rounded-xl overflow-hidden shadow-lg"
                    >
                      <div className="aspect-square bg-gray-100 flex items-center justify-center">
                        {img.image ? (
                          <img
                            src={`data:${img.image.mime_type};base64,${img.image.data}`}
                            alt={`Step ${img.step}`}
                            className="w-full h-full object-cover"
                          />
                        ) : img.success === false ? (
                          <span className="text-red-400 text-sm">Failed</span>
                        ) : (
                          <span className="text-gray-400">Loading...</span>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-gray-400">#{img.step}</span>
                          <span className="text-xs px-2 py-1 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 text-gray-600">
                            {gradient[i]?.pole_a_weight || 0}% / {gradient[i]?.pole_b_weight || 0}%
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 line-clamp-2">{img.prompt}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <button
                onClick={reset}
                className="mt-8 px-8 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all"
              >
                Start Over
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
