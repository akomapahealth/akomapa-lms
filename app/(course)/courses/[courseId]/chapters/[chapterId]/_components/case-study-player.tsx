"use client";

import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
  type CaseStudyScenario,
  type CaseStudyChoice,
  getEthicalLabel,
} from "@/lib/case-study-types";

interface CaseStudyPlayerProps {
  caseStudyId: string;
  title: string;
  scenario: CaseStudyScenario;
  courseId: string;
}

export const CaseStudyPlayer = ({
  caseStudyId,
  title,
  scenario,
  courseId,
}: CaseStudyPlayerProps) => {
  const [phase, setPhase] = useState<"intro" | "steps" | "conclusion">("intro");
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<CaseStudyChoice | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [choices, setChoices] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const currentStep = scenario.steps[currentStepIndex];
  const totalSteps = scenario.steps.length;

  const onSelectChoice = (choice: CaseStudyChoice) => {
    setSelectedChoice(choice);
    setShowFeedback(true);
    setChoices((prev) => [...prev, choice.id]);
  };

  const onContinue = () => {
    if (currentStepIndex < totalSteps - 1) {
      // Check for branching
      const nextStepId = selectedChoice?.nextStepId;
      if (nextStepId) {
        const branchIndex = scenario.steps.findIndex((s) => s.id === nextStepId);
        if (branchIndex >= 0) {
          setCurrentStepIndex(branchIndex);
        } else {
          setCurrentStepIndex((prev) => prev + 1);
        }
      } else {
        setCurrentStepIndex((prev) => prev + 1);
      }
      setSelectedChoice(null);
      setShowFeedback(false);
    } else {
      // Done with all steps
      saveAttempt();
      setPhase("conclusion");
    }
  };

  const saveAttempt = async () => {
    setIsSaving(true);
    try {
      await axios.post(
        `/api/courses/${courseId}/case-studies/${caseStudyId}/attempt`,
        { choices, completed: true }
      );
    } catch {
      toast.error("Failed to save your progress");
    } finally {
      setIsSaving(false);
    }
  };

  if (phase === "intro") {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        <div
          className="prose prose-slate max-w-none"
          dangerouslySetInnerHTML={{ __html: scenario.introduction }}
        />
        <Button onClick={() => setPhase("steps")} className="mt-4">
          Begin Case Study
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    );
  }

  if (phase === "conclusion") {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-8 h-8 text-success" />
          <h2 className="text-2xl font-bold text-foreground">
            Case Study Complete
          </h2>
        </div>
        <div
          className="prose prose-slate max-w-none"
          dangerouslySetInnerHTML={{ __html: scenario.conclusion }}
        />
        <p className="text-sm text-muted-foreground">
          {isSaving
            ? "Saving your responses..."
            : "Your responses have been saved."}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        <span className="text-sm text-muted-foreground">
          Step {currentStepIndex + 1} of {totalSteps}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-akomapa-teal h-2 rounded-full transition-all"
          style={{
            width: `${((currentStepIndex + (showFeedback ? 1 : 0)) / totalSteps) * 100}%`,
          }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`step-${currentStepIndex}-${showFeedback ? "feedback" : "question"}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* Narrative */}
          <div
            className="prose prose-slate max-w-none bg-muted/50 rounded-lg p-4 border"
            dangerouslySetInnerHTML={{ __html: currentStep.narrative }}
          />

          {/* Question */}
          <p className="font-semibold text-foreground">{currentStep.question}</p>

          {!showFeedback ? (
            /* Choices */
            <div className="space-y-3">
              {currentStep.choices.map((choice, index) => (
                <button
                  key={choice.id}
                  onClick={() => onSelectChoice(choice)}
                  className="w-full text-left p-4 rounded-lg border border-border hover:border-akomapa-teal hover:bg-akomapa-teal/5 transition"
                >
                  <span className="font-medium text-akomapa-teal mr-2">
                    {String.fromCharCode(65 + index)}.
                  </span>
                  {choice.text}
                </button>
              ))}
            </div>
          ) : (
            /* Feedback */
            <div className="space-y-4">
              <div className="p-4 rounded-lg border bg-card">
                <p className="text-sm text-muted-foreground mb-1">You chose:</p>
                <p className="font-medium text-foreground">
                  {selectedChoice?.text}
                </p>
              </div>

              <div className="p-4 rounded-lg border bg-muted/50">
                {selectedChoice && (
                  <>
                    <p
                      className={`font-semibold ${getEthicalLabel(selectedChoice.ethicalScore).color}`}
                    >
                      {getEthicalLabel(selectedChoice.ethicalScore).label}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {selectedChoice.consequence}
                    </p>
                    <p className="text-sm text-foreground mt-3 italic">
                      {selectedChoice.feedback}
                    </p>
                  </>
                )}
              </div>

              <Button onClick={onContinue}>
                {currentStepIndex < totalSteps - 1
                  ? `Continue to Step ${currentStepIndex + 2}`
                  : "Complete Case Study"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
