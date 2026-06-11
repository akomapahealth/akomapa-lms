import { z } from "zod";

export interface CaseStudyChoice {
  id: string;
  text: string;
  consequence: string;
  ethicalScore: number;
  nextStepId?: string;
  feedback: string;
}

export interface CaseStudyStep {
  id: string;
  narrative: string;
  question: string;
  choices: CaseStudyChoice[];
}

export interface CaseStudyScenario {
  introduction: string;
  steps: CaseStudyStep[];
  conclusion: string;
}

export const caseStudyChoiceSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  consequence: z.string().min(1),
  ethicalScore: z.number().min(0).max(100),
  nextStepId: z.string().optional(),
  feedback: z.string().min(1),
});

export const caseStudyStepSchema = z.object({
  id: z.string().min(1),
  narrative: z.string().min(1),
  question: z.string().min(1),
  choices: z.array(caseStudyChoiceSchema).min(2),
});

export const caseStudyScenarioSchema = z.object({
  introduction: z.string().min(1),
  steps: z.array(caseStudyStepSchema).min(1),
  conclusion: z.string().min(1),
});

export function getEthicalLabel(score: number): {
  label: string;
  color: string;
} {
  if (score >= 80) return { label: "Strong ethical choice", color: "text-emerald-600" };
  if (score >= 60) return { label: "Good consideration", color: "text-blue-600" };
  if (score >= 40) return { label: "Consider alternatives", color: "text-amber-600" };
  return { label: "Ethically challenging", color: "text-red-600" };
}
