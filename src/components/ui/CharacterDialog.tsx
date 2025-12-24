import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  X,
  Loader2,
  Sparkles,
  Check,
  ChevronRight,
  RefreshCw,
  Pencil,
} from 'lucide-react';
import { Dialog } from './Dialog';
import { Button } from './Button';
import { useStore } from '../../store';
import { getImageUrl } from '../../api';
import {
  characterGenerateQuestions,
  characterGenerateDescription,
  type CharacterQuestion,
} from '../../api';

interface CharacterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  imageIds: string[];
  onSuccess?: () => void;
}

type DialogState =
  | 'name_input'
  | 'loading_questions'
  | 'questions'
  | 'generating_description'
  | 'review'
  | 'error';

export function CharacterDialog({
  isOpen,
  onClose,
  imageIds,
  onSuccess,
}: CharacterDialogProps) {
  const [state, setState] = useState<DialogState>('name_input');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [suggestedName, setSuggestedName] = useState<string | null>(null);
  const [questions, setQuestions] = useState<CharacterQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [activeHeader, setActiveHeader] = useState<string | null>(null);
  const [summary, setSummary] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCharacter = useStore((s) => s.createCharacter);
  const getAllGenerations = useStore((s) => s.getAllGenerations);

  // Get images for preview
  const getImageById = useCallback((id: string) => {
    const generations = getAllGenerations();
    for (const g of generations) {
      const img = g.images.find((i) => i.id === id);
      if (img) return img;
    }
    return null;
  }, [getAllGenerations]);

  const referenceImages = imageIds.map(getImageById).filter(Boolean);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setState('name_input');
      setName('');
      setDescription('');
      setSuggestedName(null);
      setQuestions([]);
      setAnswers({});
      setActiveHeader(null);
      setSummary({});
      setError(null);
    }
  }, [isOpen]);

  // Get unique headers for navigation
  const uniqueHeaders = [...new Set(questions.map((q) => q.header))];
  const activeIndex = uniqueHeaders.indexOf(activeHeader || '');
  const isLastQuestion = activeIndex === uniqueHeaders.length - 1;

  // Navigation
  const goToNextQuestion = useCallback(() => {
    if (uniqueHeaders.length === 0) return;
    const nextIndex = (activeIndex + 1) % uniqueHeaders.length;
    setActiveHeader(uniqueHeaders[nextIndex]);
  }, [activeIndex, uniqueHeaders]);

  // Check if all questions are answered
  const allAnswered = questions.every((q) => {
    const answer = answers[q.question];
    if (q.multiSelect) {
      return Array.isArray(answer) && answer.length > 0;
    }
    return typeof answer === 'string' && answer.length > 0;
  });

  // Current question answered
  const currentQuestionAnswered = (() => {
    const currentQuestion = questions.find((q) => q.header === activeHeader);
    if (!currentQuestion) return false;
    const answer = answers[currentQuestion.question];
    if (currentQuestion.multiSelect) {
      return Array.isArray(answer) && answer.length > 0;
    }
    return typeof answer === 'string' && answer.length > 0;
  })();

  // Generate questions from AI
  const handleGenerateQuestions = async () => {
    setState('loading_questions');
    setError(null);

    try {
      const response = await characterGenerateQuestions({
        image_ids: imageIds,
        name: name.trim() || undefined,
        description: description.trim() || undefined,
      });

      if (response.success && response.questions.length > 0) {
        setQuestions(response.questions);
        setAnswers({});
        setActiveHeader(response.questions[0]?.header || null);
        if (response.suggested_name && !name.trim()) {
          setSuggestedName(response.suggested_name);
        }
        setState('questions');
      } else {
        setError(response.error || 'Failed to generate questions');
        setState('error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setState('error');
    }
  };

  // Generate description from answers
  const handleGenerateDescription = async () => {
    setState('generating_description');
    setError(null);

    const finalName = name.trim() || suggestedName || 'Unnamed Character';

    try {
      const response = await characterGenerateDescription({
        image_ids: imageIds,
        name: finalName,
        questions,
        answers,
        initial_description: description.trim() || undefined,
      });

      if (response.success) {
        setDescription(response.description);
        setSummary(response.summary);
        if (!name.trim() && suggestedName) {
          setName(suggestedName);
        }
        setState('review');
      } else {
        setError(response.error || 'Failed to generate description');
        setState('error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setState('error');
    }
  };

  // Handle answer change
  const handleAnswerChange = (question: string, value: string | string[]) => {
    setAnswers((prev) => ({
      ...prev,
      [question]: value,
    }));
  };

  // Handle option click
  const handleOptionClick = (question: CharacterQuestion, optionLabel: string) => {
    const currentAnswer = answers[question.question];

    if (question.multiSelect) {
      const currentSelected = Array.isArray(currentAnswer) ? currentAnswer : [];
      const isSelected = currentSelected.includes(optionLabel);
      const newSelected = isSelected
        ? currentSelected.filter((v) => v !== optionLabel)
        : [...currentSelected, optionLabel];
      handleAnswerChange(question.question, newSelected);
    } else {
      handleAnswerChange(question.question, optionLabel);
    }
  };

  // Create the character
  const handleCreate = async () => {
    const finalName = name.trim() || suggestedName || 'Unnamed';
    if (!finalName) return;

    setIsCreating(true);
    try {
      const referenceImagesData = imageIds.map((id) => ({
        image_id: id,
        annotation: undefined,
      }));

      await createCharacter(
        finalName,
        description.trim() || undefined,
        referenceImagesData
      );

      onClose();
      onSuccess?.();
    } catch (err) {
      console.error('Failed to create character:', err);
      setError(err instanceof Error ? err.message : 'Failed to create character');
    } finally {
      setIsCreating(false);
    }
  };

  // Skip AI and go to manual mode
  const handleSkipAI = () => {
    setState('review');
  };

  // Close handler
  const handleClose = () => {
    setName('');
    setDescription('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title="Create Character" className="max-w-lg">
      <div className="space-y-4">
        {/* Reference Images Preview */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {referenceImages.slice(0, 6).map((img) => (
            <img
              key={img!.id}
              src={getImageUrl(img!.image_path)}
              alt="Reference"
              className="w-16 h-16 rounded-lg object-cover border border-border shrink-0"
            />
          ))}
          {imageIds.length > 6 && (
            <div className="w-16 h-16 rounded-lg bg-canvas-muted flex items-center justify-center text-xs text-ink-muted shrink-0">
              +{imageIds.length - 6}
            </div>
          )}
        </div>

        {/* Name Input State */}
        {state === 'name_input' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-1">
                Name (optional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter character name or let AI suggest one..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brass/50"
                autoFocus
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="brass"
                onClick={handleGenerateQuestions}
                className="flex-1"
              >
                <Sparkles size={16} />
                AI-Assisted
              </Button>
              <Button
                variant="secondary"
                onClick={handleSkipAI}
                className="flex-1"
              >
                <Pencil size={16} />
                Manual
              </Button>
            </div>

            <p className="text-xs text-ink-muted text-center">
              AI will analyze the images and ask questions to help define the character
            </p>
          </div>
        )}

        {/* Loading Questions */}
        {state === 'loading_questions' && (
          <div className="flex flex-col items-center justify-center py-8 text-ink-tertiary">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p className="text-sm">Analyzing reference images...</p>
          </div>
        )}

        {/* Questions State */}
        {state === 'questions' && (
          <div className="space-y-4">
            {/* Suggested name */}
            {suggestedName && !name.trim() && (
              <div className="flex items-center gap-2 px-3 py-2 bg-brass-muted/30 rounded-lg text-sm">
                <Sparkles size={14} className="text-brass" />
                <span className="text-ink-secondary">Suggested name:</span>
                <button
                  onClick={() => setName(suggestedName)}
                  className="font-medium text-brass hover:underline"
                >
                  {suggestedName}
                </button>
              </div>
            )}

            {/* Header chips */}
            {uniqueHeaders.length > 0 && (
              <div className="flex items-center gap-2 pb-2 border-b border-border overflow-x-auto">
                {uniqueHeaders.map((header, index) => {
                  const isActive = activeHeader === header;
                  const questionForHeader = questions.find((q) => q.header === header);
                  const isAnswered = questionForHeader
                    ? !!answers[questionForHeader.question]
                    : false;

                  return (
                    <button
                      key={header}
                      onClick={() => setActiveHeader(header)}
                      className={clsx(
                        'px-3 py-1.5 rounded-full text-xs font-medium',
                        'transition-colors whitespace-nowrap',
                        'flex items-center gap-1.5',
                        isActive
                          ? 'bg-brass text-white'
                          : isAnswered
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-canvas-muted text-ink-secondary hover:bg-canvas-subtle'
                      )}
                    >
                      {isAnswered && !isActive && <Check size={12} className="shrink-0" />}
                      <span className="text-[0.6rem] opacity-60">{index + 1}.</span>
                      {header}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Current question */}
            <AnimatePresence mode="wait">
              {questions
                .filter((q) => q.header === activeHeader)
                .map((question) => (
                  <motion.div
                    key={question.header}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-3"
                  >
                    <p className="text-sm font-medium text-ink">{question.question}</p>
                    {question.multiSelect && (
                      <p className="text-xs text-ink-tertiary">(select multiple)</p>
                    )}

                    <div className="space-y-2">
                      {question.options.map((option) => {
                        const currentAnswer = answers[question.question];
                        const isSelected = question.multiSelect
                          ? Array.isArray(currentAnswer) && currentAnswer.includes(option.label)
                          : currentAnswer === option.label;
                        const isRecommended = option.label.includes('(Recommended)');

                        return (
                          <button
                            key={option.label}
                            onClick={() => handleOptionClick(question, option.label)}
                            className={clsx(
                              'w-full text-left p-3 rounded-lg border transition-all',
                              'flex items-start gap-3',
                              isSelected
                                ? 'border-brass bg-brass-muted/50 ring-1 ring-brass'
                                : 'border-border hover:border-brass-muted hover:bg-canvas-muted'
                            )}
                          >
                            <div className="mt-0.5 shrink-0">
                              {question.multiSelect ? (
                                <div
                                  className={clsx(
                                    'w-4 h-4 rounded border-2 flex items-center justify-center',
                                    isSelected
                                      ? 'bg-brass border-brass'
                                      : 'border-border-strong'
                                  )}
                                >
                                  {isSelected && <Check size={12} className="text-white" />}
                                </div>
                              ) : (
                                <div
                                  className={clsx(
                                    'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                                    isSelected ? 'border-brass' : 'border-border-strong'
                                  )}
                                >
                                  {isSelected && <div className="w-2 h-2 rounded-full bg-brass" />}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={clsx('text-sm font-medium', isSelected ? 'text-ink' : 'text-ink-secondary')}>
                                  {option.label.replace(' (Recommended)', '')}
                                </span>
                                {isRecommended && (
                                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                                    Recommended
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-ink-tertiary mt-0.5">{option.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                ))}
            </AnimatePresence>

            {/* Progress and navigation */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="text-xs text-ink-tertiary">
                {Object.keys(answers).length} of {questions.length} answered
              </span>
              <div className="flex gap-2">
                {!isLastQuestion && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={goToNextQuestion}
                    disabled={!currentQuestionAnswered}
                  >
                    Next
                    <ChevronRight size={14} />
                  </Button>
                )}
                <Button
                  variant="brass"
                  size="sm"
                  onClick={handleGenerateDescription}
                  disabled={!allAnswered}
                >
                  Generate Description
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Generating Description */}
        {state === 'generating_description' && (
          <div className="flex flex-col items-center justify-center py-8 text-ink-tertiary">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p className="text-sm">Creating character description...</p>
          </div>
        )}

        {/* Review/Edit State */}
        {state === 'review' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-1">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter character name..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brass/50"
              />
            </div>

            {/* Summary pills */}
            {Object.keys(summary).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(summary).map(([category, value]) => (
                  <span
                    key={category}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-canvas-muted text-ink-secondary"
                  >
                    <span className="font-medium text-ink">{category}:</span>
                    <span>{value}</span>
                  </span>
                ))}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the character..."
                rows={4}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brass/50 resize-none"
              />
            </div>

            <p className="text-xs text-ink-muted">
              {imageIds.length} image{imageIds.length !== 1 ? 's' : ''} will be added as reference images
            </p>
          </div>
        )}

        {/* Error State */}
        {state === 'error' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="text-red-500 mb-4">
              <X size={32} />
            </div>
            <p className="text-sm text-ink-secondary text-center mb-4">{error}</p>
            <Button variant="secondary" onClick={handleGenerateQuestions}>
              <RefreshCw size={16} />
              Try Again
            </Button>
          </div>
        )}
      </div>

      {/* Footer */}
      {(state === 'review' || state === 'name_input') && (
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          {state === 'review' && (
            <Button
              variant="brass"
              onClick={handleCreate}
              disabled={!name.trim() || isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Character'}
            </Button>
          )}
        </div>
      )}
    </Dialog>
  );
}
