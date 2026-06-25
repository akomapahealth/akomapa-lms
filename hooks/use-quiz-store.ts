import { create } from "zustand";

export interface QuizQuestion {
  id: string;
  text: string;
  position: number;
  options: {
    id: string;
    text: string;
    position: number;
  }[];
}

interface QuizState {
  quizId: string | null;
  attemptId: string | null;
  questions: QuizQuestion[];
  answers: Record<string, string>; // questionId -> optionId
  currentIndex: number;
  timeRemaining: number; // seconds
  isSubmitted: boolean;
  startedAt: number | null; // timestamp ms

  setQuiz: (
    quizId: string,
    attemptId: string,
    questions: QuizQuestion[],
    timeLimitSeconds: number
  ) => void;
  selectAnswer: (questionId: string, optionId: string) => void;
  goToQuestion: (index: number) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  tick: () => void;
  submit: () => void;
  reset: () => void;
  getResumableState: () => SavedQuizState | null;
}

interface SavedQuizState {
  quizId: string;
  attemptId: string;
  answers: Record<string, string>;
  currentIndex: number;
  startedAt: number;
  timeLimitSeconds: number;
}

const STORAGE_KEY = (quizId: string) => `quiz-progress-${quizId}`;

function saveToStorage(state: SavedQuizState) {
  try {
    localStorage.setItem(STORAGE_KEY(state.quizId), JSON.stringify(state));
  } catch {
    // localStorage unavailable
  }
}

function loadFromStorage(quizId: string): SavedQuizState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(quizId));
    if (!raw) return null;
    return JSON.parse(raw) as SavedQuizState;
  } catch {
    return null;
  }
}

function clearStorage(quizId: string) {
  try {
    localStorage.removeItem(STORAGE_KEY(quizId));
  } catch {
    // localStorage unavailable
  }
}

export const useQuizStore = create<QuizState>((set, get) => ({
  quizId: null,
  attemptId: null,
  questions: [],
  answers: {},
  currentIndex: 0,
  timeRemaining: 0,
  isSubmitted: false,
  startedAt: null,

  setQuiz: (quizId, attemptId, questions, timeLimitSeconds) => {
    // Check for resumable state
    const saved = loadFromStorage(quizId);
    if (saved && saved.attemptId === attemptId) {
      const elapsed = Math.floor((Date.now() - saved.startedAt) / 1000);
      const remaining = Math.max(0, saved.timeLimitSeconds - elapsed);

      set({
        quizId,
        attemptId,
        questions,
        answers: saved.answers,
        currentIndex: saved.currentIndex,
        timeRemaining: remaining,
        isSubmitted: false,
        startedAt: saved.startedAt,
      });
      return;
    }

    const now = Date.now();
    set({
      quizId,
      attemptId,
      questions,
      answers: {},
      currentIndex: 0,
      timeRemaining: timeLimitSeconds,
      isSubmitted: false,
      startedAt: now,
    });

    saveToStorage({
      quizId,
      attemptId,
      answers: {},
      currentIndex: 0,
      startedAt: now,
      timeLimitSeconds,
    });
  },

  selectAnswer: (questionId, optionId) => {
    const state = get();
    const newAnswers = { ...state.answers, [questionId]: optionId };
    set({ answers: newAnswers });

    if (state.quizId && state.attemptId && state.startedAt) {
      const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
      saveToStorage({
        quizId: state.quizId,
        attemptId: state.attemptId,
        answers: newAnswers,
        currentIndex: state.currentIndex,
        startedAt: state.startedAt,
        timeLimitSeconds: elapsed + state.timeRemaining,
      });
    }
  },

  goToQuestion: (index) => {
    const state = get();
    if (index >= 0 && index < state.questions.length) {
      set({ currentIndex: index });
    }
  },

  nextQuestion: () => {
    const state = get();
    if (state.currentIndex < state.questions.length - 1) {
      set({ currentIndex: state.currentIndex + 1 });
    }
  },

  prevQuestion: () => {
    const state = get();
    if (state.currentIndex > 0) {
      set({ currentIndex: state.currentIndex - 1 });
    }
  },

  tick: () => {
    const state = get();
    if (state.startedAt) {
      // Use actual elapsed time for accuracy
      const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
      const totalTime =
        state.timeRemaining + elapsed - (state.timeRemaining > 0 ? 0 : 0);
      // Simpler approach: just decrement
      const newTime = Math.max(0, state.timeRemaining - 1);
      set({ timeRemaining: newTime });
    }
  },

  submit: () => {
    const state = get();
    set({ isSubmitted: true });
    if (state.quizId) {
      clearStorage(state.quizId);
    }
  },

  reset: () => {
    const state = get();
    if (state.quizId) {
      clearStorage(state.quizId);
    }
    set({
      quizId: null,
      attemptId: null,
      questions: [],
      answers: {},
      currentIndex: 0,
      timeRemaining: 0,
      isSubmitted: false,
      startedAt: null,
    });
  },

  getResumableState: () => {
    const state = get();
    if (!state.quizId) return null;
    return loadFromStorage(state.quizId);
  },
}));
