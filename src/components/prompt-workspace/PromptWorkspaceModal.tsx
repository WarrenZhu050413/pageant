/**
 * Prompt Engineering Workspace Modal
 *
 * A structured question-based interface for helping users craft better prompts.
 * Uses the Claude Code AskUserQuestion UI pattern with chips/tags and options.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import {
  X,
  Loader2,
  Sparkles,
  RefreshCw,
  Check,
  ChevronRight,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "../ui";
import { QuestionCard } from "./QuestionCard";
import {
  peGenerateQuestions,
  peOptimizePrompt,
  type PEQuestion,
  type PERound,
} from "../../api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt: string;
  contextImageIds: string[];
  onApply: (optimizedPrompt: string) => void;
}

type WorkspaceState =
  | "idle"
  | "loading_questions"
  | "questions"
  | "optimizing"
  | "optimized"
  | "error";

export function PromptWorkspaceModal({
  isOpen,
  onClose,
  initialPrompt,
  contextImageIds,
  onApply,
}: Props) {
  const [state, setState] = useState<WorkspaceState>("idle");
  const [questions, setQuestions] = useState<PEQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [optimizedPrompt, setOptimizedPrompt] = useState("");
  const [promptSummary, setPromptSummary] = useState<Record<string, string>>(
    {},
  );
  const [history, setHistory] = useState<PERound[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeHeader, setActiveHeader] = useState<string | null>(null);

  // Get unique headers from questions for the chip navigation
  const headers = questions.map((q) => q.header);
  const uniqueHeaders = [...new Set(headers)];

  // Get current question index for navigation
  const activeIndex = uniqueHeaders.indexOf(activeHeader || "");

  // Navigate to next/previous question
  const goToNextQuestion = useCallback(() => {
    if (uniqueHeaders.length === 0) return;
    const nextIndex = (activeIndex + 1) % uniqueHeaders.length;
    setActiveHeader(uniqueHeaders[nextIndex]);
  }, [activeIndex, uniqueHeaders]);

  const goToPrevQuestion = useCallback(() => {
    if (uniqueHeaders.length === 0) return;
    const prevIndex =
      activeIndex <= 0 ? uniqueHeaders.length - 1 : activeIndex - 1;
    setActiveHeader(uniqueHeaders[prevIndex]);
  }, [activeIndex, uniqueHeaders]);

  // Reset state and auto-generate questions when modal opens
  useEffect(() => {
    if (isOpen) {
      // Reset all state
      setQuestions([]);
      setAnswers({});
      setOptimizedPrompt("");
      setPromptSummary({});
      setHistory([]);
      setError(null);
      setActiveHeader(null);

      // Auto-trigger question generation
      setState("loading_questions");
      peGenerateQuestions({
        prompt: initialPrompt,
        context_image_ids: contextImageIds,
      })
        .then((response) => {
          if (response.success && response.questions.length > 0) {
            setQuestions(response.questions);
            setAnswers({});
            setActiveHeader(response.questions[0]?.header || null);
            setState("questions");
          } else {
            setError(response.error || "Failed to generate questions");
            setState("error");
          }
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Unknown error");
          setState("error");
        });
    }
  }, [isOpen, initialPrompt, contextImageIds]);

  // Check if all questions are answered (moved up for use in keyboard handler)
  const allAnswered = questions.every((q) => {
    const answer = answers[q.question];
    if (q.multiSelect) {
      return Array.isArray(answer) && answer.length > 0;
    }
    return typeof answer === "string" && answer.length > 0;
  });

  // Check if current question is answered
  const currentQuestionAnswered = (() => {
    const currentQuestion = questions.find((q) => q.header === activeHeader);
    if (!currentQuestion) return false;
    const answer = answers[currentQuestion.question];
    if (currentQuestion.multiSelect) {
      return Array.isArray(answer) && answer.length > 0;
    }
    return typeof answer === "string" && answer.length > 0;
  })();

  // Check if on last question
  const isLastQuestion = activeIndex === uniqueHeaders.length - 1;

  // Generate questions from the prompt
  const handleGenerateQuestions = async () => {
    setState("loading_questions");
    setError(null);

    try {
      const response = await peGenerateQuestions({
        prompt: optimizedPrompt || initialPrompt,
        context_image_ids: contextImageIds,
        history: history.length > 0 ? history : undefined,
      });

      if (response.success && response.questions.length > 0) {
        setQuestions(response.questions);
        setAnswers({});
        setActiveHeader(response.questions[0]?.header || null);
        setState("questions");
      } else {
        setError(response.error || "Failed to generate questions");
        setState("error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  };

  // Handle answer selection
  const handleAnswerChange = (question: string, value: string | string[]) => {
    setAnswers((prev) => ({
      ...prev,
      [question]: value,
    }));
  };

  // Optimize the prompt
  const handleOptimize = async () => {
    setState("optimizing");
    setError(null);

    try {
      const response = await peOptimizePrompt({
        prompt: initialPrompt,
        questions,
        answers,
        context_image_ids: contextImageIds,
        history: history.length > 0 ? history : undefined,
      });

      if (response.success) {
        setOptimizedPrompt(response.optimized_prompt);
        setPromptSummary(response.prompt_summary || {});

        // Add this round to history
        setHistory((prev) => [
          ...prev,
          {
            questions,
            answers,
            optimized_prompt: response.optimized_prompt,
          },
        ]);

        setState("optimized");
      } else {
        setError(response.error || "Failed to optimize prompt");
        setState("error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  };

  // Apply the optimized prompt
  const handleApply = () => {
    onApply(optimizedPrompt);
    onClose();
  };

  // Refine more (start another round)
  const handleRefineMore = () => {
    handleGenerateQuestions();
  };

  // Keyboard navigation for Tab/Enter through questions
  useEffect(() => {
    if (!isOpen || state !== "questions") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInInput = target.tagName === "INPUT";

      // Cmd/Ctrl + Enter to optimize when all answered
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (allAnswered) {
          handleOptimize();
        }
        return;
      }

      // Enter to go to next question (if current is answered and not in input)
      if (e.key === "Enter" && !isInInput) {
        e.preventDefault();
        if (currentQuestionAnswered && !isLastQuestion) {
          goToNextQuestion();
        } else if (currentQuestionAnswered && isLastQuestion && allAnswered) {
          handleOptimize();
        }
        return;
      }

      // Tab navigation
      if (e.key === "Tab") {
        if (isInInput && !e.shiftKey) {
          // Allow normal tab out of inputs, but Shift+Tab navigates back
          return;
        }

        e.preventDefault();
        if (e.shiftKey) {
          goToPrevQuestion();
        } else {
          goToNextQuestion();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    state,
    goToNextQuestion,
    goToPrevQuestion,
    allAnswered,
    currentQuestionAnswered,
    isLastQuestion,
  ]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-overlay z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={clsx(
          "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
          "bg-surface rounded-xl shadow-xl",
          "flex flex-col",
          "z-50",
        )}
        style={{ width: "min(90vw, 42rem)", maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brass" />
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
              Prompt Engineering Workspace
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-ink-tertiary hover:text-ink hover:bg-canvas-muted transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Original prompt summary */}
        <div className="px-5 py-3 border-b border-border bg-canvas-subtle shrink-0">
          <p className="text-xs text-ink-tertiary mb-1">Original prompt:</p>
          <p className="text-sm text-ink-secondary line-clamp-2">
            "{initialPrompt}"
          </p>
          {contextImageIds.length > 0 && (
            <div className="flex items-center gap-1 mt-2 text-xs text-ink-tertiary">
              <ImageIcon size={12} />
              <span>{contextImageIds.length} context image(s)</span>
            </div>
          )}
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* Loading questions */}
          {state === "loading_questions" && (
            <div className="flex flex-col items-center justify-center py-16 text-ink-tertiary">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <p className="text-sm">Analyzing your prompt...</p>
            </div>
          )}

          {/* Questions state */}
          {state === "questions" && (
            <div className="p-5">
              {/* Header chips navigation */}
              {uniqueHeaders.length > 0 && (
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border overflow-x-auto">
                  {uniqueHeaders.map((header, index) => {
                    const isActive = activeHeader === header;
                    const questionForHeader = questions.find(
                      (q) => q.header === header,
                    );
                    const isAnswered = questionForHeader
                      ? !!answers[questionForHeader.question]
                      : false;

                    return (
                      <button
                        key={header}
                        onClick={() => setActiveHeader(header)}
                        className={clsx(
                          "px-3 py-1.5 rounded-full text-xs font-medium",
                          "transition-colors whitespace-nowrap",
                          "flex items-center gap-1.5",
                          isActive
                            ? "bg-brass text-white"
                            : isAnswered
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-canvas-muted text-ink-secondary hover:bg-canvas-subtle",
                        )}
                      >
                        {isAnswered && !isActive && (
                          <Check size={12} className="shrink-0" />
                        )}
                        <span className="text-[0.6rem] opacity-60">
                          {index + 1}.
                        </span>
                        {header}
                      </button>
                    );
                  })}
                  {/* Keyboard hints */}
                  <span className="text-[0.6rem] text-ink-muted ml-auto whitespace-nowrap">
                    Tab / Enter to navigate • ⌘Enter to optimize
                  </span>
                </div>
              )}

              {/* Show only the active question */}
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
                    >
                      <QuestionCard
                        question={question}
                        value={answers[question.question]}
                        onChange={(value) =>
                          handleAnswerChange(question.question, value)
                        }
                        isHighlighted={true}
                        onEnter={() => {
                          if (!isLastQuestion) {
                            goToNextQuestion();
                          } else if (allAnswered) {
                            handleOptimize();
                          }
                        }}
                      />
                    </motion.div>
                  ))}
              </AnimatePresence>

              {/* Progress indicator */}
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-ink-tertiary">
                <span>
                  Question {activeIndex + 1} of {uniqueHeaders.length}
                </span>
                <span>
                  {Object.keys(answers).length} of {questions.length} answered
                </span>
              </div>
            </div>
          )}

          {/* Optimizing state */}
          {state === "optimizing" && (
            <div className="flex flex-col items-center justify-center py-16 text-ink-tertiary">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <p className="text-sm">Crafting your optimized prompt...</p>
            </div>
          )}

          {/* Optimized state - show preview */}
          {state === "optimized" && (
            <div className="p-5">
              <div className="mb-4">
                <p className="text-xs text-ink-tertiary mb-2 flex items-center gap-1">
                  <Check size={12} className="text-green-600" />
                  Optimized Prompt (Round {history.length}):
                </p>

                {/* Summary pills */}
                {Object.keys(promptSummary).length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {Object.entries(promptSummary).map(([category, value]) => (
                      <span
                        key={category}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-canvas-muted text-ink-secondary"
                      >
                        <span className="font-medium text-ink">
                          {category}:
                        </span>
                        <span>{value}</span>
                      </span>
                    ))}
                  </div>
                )}

                <div className="p-4 bg-canvas-subtle rounded-lg border border-border">
                  <p className="text-sm text-ink leading-relaxed">
                    {optimizedPrompt}
                  </p>
                </div>
              </div>

              {/* History accordion */}
              {history.length > 1 && (
                <details className="mb-4">
                  <summary className="text-xs text-ink-tertiary cursor-pointer hover:text-ink-secondary">
                    Show previous rounds ({history.length - 1})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {history.slice(0, -1).map((round, i) => (
                      <div
                        key={i}
                        className="p-3 bg-canvas-muted rounded-lg text-xs text-ink-secondary"
                      >
                        <p className="font-medium mb-1">Round {i + 1}:</p>
                        <p className="line-clamp-2">{round.optimized_prompt}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Error state */}
          {state === "error" && (
            <div className="flex flex-col items-center justify-center py-16 px-5">
              <div className="text-red-500 mb-4">
                <X size={32} />
              </div>
              <p className="text-sm text-ink-secondary text-center mb-4">
                {error}
              </p>
              <Button variant="secondary" onClick={handleGenerateQuestions}>
                <RefreshCw size={16} />
                Try Again
              </Button>
            </div>
          )}
        </div>

        {/* Footer with actions */}
        <div className="px-5 py-4 border-t border-border bg-canvas-subtle shrink-0">
          <div className="flex items-center justify-end gap-3">
            {state === "questions" && (
              <>
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                {!isLastQuestion && (
                  <Button
                    variant="secondary"
                    onClick={goToNextQuestion}
                    disabled={!currentQuestionAnswered}
                  >
                    Next
                    <ChevronRight size={16} />
                  </Button>
                )}
                <Button
                  variant="brass"
                  onClick={handleOptimize}
                  disabled={!allAnswered}
                >
                  <ChevronRight size={16} />
                  Optimize Prompt
                </Button>
              </>
            )}

            {state === "optimized" && (
              <>
                <Button variant="ghost" onClick={handleRefineMore}>
                  <RefreshCw size={16} />
                  Refine More
                </Button>
                <Button variant="brass" onClick={handleApply}>
                  <Check size={16} />
                  Apply to Prompt
                </Button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
