# Phase 3: Quiz/Assessment System & Grades

> **Goal**: Build the complete pre-test/post-test assessment engine and the grades page.
> **Prerequisites**: Phase 1 (schema with Quiz models) and Phase 2 (dashboard, course structure).

---

## 1. Quiz Engine -- Student Experience

### 1.1 Quiz Entry Page

**File**: `app/(course)/courses/[courseId]/quiz/[quizId]/page.tsx`

Server component that:
1. Fetches quiz metadata (title, type, time limit, question count)
2. Checks if user has already completed it (show results link if so)
3. Checks lock status (post-test locked if modules incomplete)
4. Shows quiz info card with "Start Quiz" button

```
┌─────────────────────────────────────────────────────────────┐
│  GUSI POCUS Essentials > Pre-Test                           │
│                                                              │
│  Pre-Test: Leadership & Power                               │
│                                                              │
│  15 Questions  ·  30 minutes  ·  Passing: 70%              │
│                                                              │
│  This pre-test assesses your current understanding          │
│  before beginning the course modules.                       │
│                                                              │
│  [Start Quiz]                                               │
│                                                              │
│  ← Back to Course                                           │
└─────────────────────────────────────────────────────────────┘
```

For locked post-tests:
```
│  🔒 Post-Test Locked                                        │
│  Complete all modules to unlock this assessment.            │
│  Progress: 7/10 modules completed                           │
```

### 1.2 Quiz Taking UI

**File**: `app/(course)/courses/[courseId]/quiz/[quizId]/take/page.tsx`

Client component (`"use client"`) with Zustand state management.

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Pre-Test: Leadership         ⏱ 24:35 remaining            │
│  Question 3 of 15            ████████░░░░░ 20%              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Which of the following best describes "positionality"      │
│  in the context of global health leadership?                │
│                                                              │
│  ○ A) The geographic position of a health facility          │
│  ● B) How one's identity and social position shape          │
│       their perspective and power                           │
│  ○ C) The organizational hierarchy within a hospital        │
│  ○ D) A leadership style focused on authority               │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  [← Previous]                              [Next →]         │
│                                                              │
│  Questions: ● ● ● ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○                │
└─────────────────────────────────────────────────────────────┘
```

**Components:**

- `_components/quiz-timer.tsx` -- countdown timer, flashes red at <5min
- `_components/quiz-question.tsx` -- question text + radio group options
- `_components/quiz-progress-bar.tsx` -- progress indicator + question dots
- `_components/quiz-navigation.tsx` -- prev/next buttons + submit

**Behavior:**
- One question at a time (navigable via prev/next or question dots)
- Selected answer highlighted with teal border
- Answered questions shown as filled dots, unanswered as empty
- Timer runs continuously; warning at 5 minutes, auto-submit at 0
- "Submit Quiz" button appears on last question (or always visible)
- Confirmation dialog before submission: "Are you sure? You have X unanswered questions."
- Browser tab title shows remaining time: "24:35 - Pre-Test"
- Warn on page navigation (beforeunload event)

### 1.3 Quiz State Management

**File**: `hooks/use-quiz-store.ts`

```typescript
import { create } from "zustand";

interface QuizState {
  quizId: string | null;
  questions: QuizQuestion[];
  answers: Record<string, string>; // questionId -> optionId
  currentIndex: number;
  timeRemaining: number; // seconds
  isSubmitted: boolean;
  startedAt: Date | null;

  // Actions
  setQuiz: (quizId: string, questions: QuizQuestion[], timeLimit: number) => void;
  selectAnswer: (questionId: string, optionId: string) => void;
  goToQuestion: (index: number) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  tick: () => void; // decrement timer by 1 second
  submit: () => void;
  reset: () => void;
}
```

**localStorage backup**: On every answer change, persist state to `localStorage` under key `quiz-progress-${quizId}`. On mount, check for existing state and offer to resume.

### 1.4 Quiz Results Page

**File**: `app/(course)/courses/[courseId]/quiz/[quizId]/results/[attemptId]/page.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│  Pre-Test Results: Leadership & Power                       │
│                                                              │
│  Score: 12/15 (80%)                    ✓ Passed             │
│  Time: 18:42 / 30:00                                       │
│                                                              │
│  ┌─────────────────────────────┐                            │
│  │  ████████████████░░░  80%  │  (progress bar)            │
│  └─────────────────────────────┘                            │
│                                                              │
│  Question Review:                                           │
│  ✓ 1. Which of the following... (correct)                   │
│  ✗ 2. In the context of... (incorrect)                      │
│     Your answer: A) ...                                     │
│     Correct answer: C) ...                                  │
│  ✓ 3. What is positionality... (correct)                    │
│  ...                                                         │
│                                                              │
│  [Back to Course]    [Retake Quiz]                          │
└─────────────────────────────────────────────────────────────┘
```

- Color coding: green for correct, red for incorrect
- Show user's answer and correct answer for wrong questions
- "Retake Quiz" only if allowed (configurable per quiz)
- Confetti animation if passed

---

## 2. Quiz API Routes

### 2.1 Start Quiz

**File**: `app/api/courses/[courseId]/quizzes/[quizId]/start/route.ts`

`POST` handler:
1. Verify user is enrolled in the course
2. Check lock status (post-test requires all modules complete)
3. Create `QuizAttempt` record with `startedAt = now()`
4. Return questions with options (WITHOUT `isCorrect` field -- never send answers to client)
5. Return attempt ID and time limit

```typescript
// Response shape
{
  attemptId: string;
  timeLimit: number; // minutes
  questions: {
    id: string;
    text: string;
    position: number;
    options: { id: string; text: string; position: number }[];
  }[];
}
```

### 2.2 Submit Quiz

**File**: `app/api/courses/[courseId]/quizzes/[quizId]/submit/route.ts`

`POST` handler:
1. Verify the attempt belongs to the user and isn't already completed
2. Verify submission is within time limit (server-side check)
3. For each answer, check against `QuestionOption.isCorrect`
4. Calculate score and total points
5. Save `QuizAnswer` records
6. Update `QuizAttempt` with score, totalPoints, completedAt
7. Return graded results

```typescript
// Request body
{
  attemptId: string;
  answers: { questionId: string; selectedOptionId: string }[];
}

// Response
{
  score: number;
  totalPoints: number;
  percentage: number;
  passed: boolean;
  results: {
    questionId: string;
    correct: boolean;
    selectedOptionId: string;
    correctOptionId: string;
  }[];
}
```

### 2.3 Get Results

**File**: `app/api/courses/[courseId]/quizzes/[quizId]/results/[attemptId]/route.ts`

`GET` handler: returns full graded results with question text, all options, user's answer, and correct answer.

---

## 3. Pre-test / Post-test Flow

### 3.1 Flow Diagram

```
Student enrolls in Course
    │
    ▼
┌─────────────────┐
│  PRE-TEST       │ ← Available immediately
│  (Optional but  │
│   encouraged)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  MODULE 1       │
│  Topics + Quiz  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  MODULE 2       │
│  Topics + Quiz  │
└────────┬────────┘
         │
         ▼
       ...
         │
         ▼
┌─────────────────┐
│  MODULE N       │
│  Topics + Quiz  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  POST-TEST      │ ← Unlocked when ALL modules complete
│  (Required for  │
│   completion)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  SCORE COMPARE  │ Pre-test vs Post-test
│  Growth Report  │
└─────────────────┘
```

### 3.2 Lock Logic

**Post-test lock check** (reusable function):

```typescript
// actions/check-post-test-lock.ts
export async function isPostTestUnlocked(
  userId: string,
  courseId: string
): Promise<{ unlocked: boolean; completedModules: number; totalModules: number }> {
  const modules = await db.module.findMany({
    where: { courseId, isPublished: true },
    include: {
      topics: {
        where: { isPublished: true },
        include: {
          userProgress: {
            where: { userId },
          },
        },
      },
    },
  });

  let completedModules = 0;
  for (const module of modules) {
    const allComplete = module.topics.every(
      (t) => t.userProgress.some((p) => p.isCompleted)
    );
    if (allComplete && module.topics.length > 0) completedModules++;
  }

  return {
    unlocked: completedModules === modules.length,
    completedModules,
    totalModules: modules.length,
  };
}
```

### 3.3 Score Comparison Component

**File**: `components/score-comparison.tsx`

Shows pre-test vs post-test side by side:

```
┌──────────────────────────────────────────┐
│  Your Growth                             │
│                                          │
│  Pre-Test     Post-Test     Growth       │
│   65%    →     88%         +23%  ↑      │
│  ████░░░      █████████    ████████     │
│                                          │
│  You improved in 12 out of 15 areas!    │
└──────────────────────────────────────────┘
```

- Green growth indicator for improvement
- Red indicator if score decreased (with encouraging message)
- Bar charts or radial comparison

---

## 4. Admin Quiz Management

### 4.1 Quiz List Page

**File**: `app/(admin)/(routes)/courses/[courseId]/quizzes/page.tsx`

Table showing all quizzes for a course:
| Title | Type | Questions | Time Limit | Passing Score | Status | Actions |
|-------|------|-----------|------------|---------------|--------|---------|
| Pre-Test | PRE_TEST | 15 | 30min | 70% | Published | Edit/Delete |

"Create Quiz" button at top.

### 4.2 Quiz Editor Page

**File**: `app/(admin)/(routes)/courses/[courseId]/quizzes/[quizId]/page.tsx`

Form sections:
1. **Quiz Settings**: Title, Type (dropdown), Time Limit, Passing Score, Publish toggle
2. **Questions List**: Drag-and-drop reorderable list (use `@hello-pangea/dnd`)
3. "Add Question" button

### 4.3 Question Editor

**File**: `app/(admin)/(routes)/courses/[courseId]/quizzes/[quizId]/_components/question-form.tsx`

Inline editing within the quiz editor:

```
┌─────────────────────────────────────────┐
│  Question 3                    [↕] [🗑] │
│  ┌─────────────────────────────────────┐│
│  │ Which of the following best...      ││
│  └─────────────────────────────────────┘│
│  Points: [1]                            │
│                                         │
│  Options:                               │
│  ○ A) [Geographic position...]  [🗑]   │
│  ● B) [Identity and social...] ✓ [🗑]  │
│  ○ C) [Organizational...]      [🗑]    │
│  ○ D) [Leadership style...]    [🗑]    │
│                                         │
│  [+ Add Option]                         │
└─────────────────────────────────────────┘
```

- Radio button to mark correct answer
- Inline text editing for question and options
- Drag handle for reordering
- Delete button per question

### 4.4 Quiz Preview

**File**: `app/(admin)/(routes)/courses/[courseId]/quizzes/[quizId]/preview/page.tsx`

Renders the quiz-taking UI in read-only mode so admins can preview before publishing.

### 4.5 Quiz API Routes (Admin)

```
POST   /api/courses/[courseId]/quizzes              -- create quiz
PATCH  /api/courses/[courseId]/quizzes/[quizId]      -- update quiz settings
DELETE /api/courses/[courseId]/quizzes/[quizId]      -- delete quiz
PATCH  /api/courses/[courseId]/quizzes/[quizId]/publish   -- publish
PATCH  /api/courses/[courseId]/quizzes/[quizId]/unpublish -- unpublish

POST   /api/courses/[courseId]/quizzes/[quizId]/questions           -- add question
PATCH  /api/courses/[courseId]/quizzes/[quizId]/questions/[questionId] -- update
DELETE /api/courses/[courseId]/quizzes/[quizId]/questions/[questionId] -- delete
PUT    /api/courses/[courseId]/quizzes/[quizId]/questions/reorder   -- reorder
```

---

## 5. Grades Pages

### 5.1 Grades Overview

**File**: `app/(dashboard)/(routes)/grades/page.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│  Grades                                                      │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Course            Pre-Test  Post-Test  Growth  Progress  ││
│  ├──────────────────────────────────────────────────────────┤│
│  │ Leadership &      65%       88%        +23%↑   100%     ││
│  │ Power                                                    ││
│  │ Ethics in         72%       --         --      45%      ││
│  │ Community                                                ││
│  │ NCDs as Systems   --        --         --      0%       ││
│  │ Problems                                                 ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  Overall GPA / Average: 78.5%                               │
└─────────────────────────────────────────────────────────────┘
```

- Use shadcn `Table` component
- Clickable rows → navigate to `/grades/[courseId]`
- Growth column: green arrow up for improvement, red arrow down for decline, dash for N/A
- Progress column: percentage bar

**Data source**: `actions/get-grades-overview.ts`

### 5.2 Grades Detail

**File**: `app/(dashboard)/(routes)/grades/[courseId]/page.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│  Grades > Leadership & Power                                │
│                                                              │
│  [Score Comparison Widget: Pre-test 65% → Post-test 88%]   │
│                                                              │
│  Module Progress                                            │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Module                    Topics    Quiz Score  Status   ││
│  ├──────────────────────────────────────────────────────────┤│
│  │ Who Taught Us Power?     5/5       90%         ✓ Done   ││
│  │ What is Power?           3/4       --          ◑ 75%    ││
│  │ Positionality            0/6       --          ○ 0%     ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  Quiz Attempt History                                       │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Quiz              Date        Score   Time    Result    ││
│  ├──────────────────────────────────────────────────────────┤│
│  │ Pre-Test          May 3       65%     18:42   ✗ Failed  ││
│  │ Module 1 Quiz     May 10      90%     8:15    ✓ Passed  ││
│  │ Post-Test         Jun 1       88%     22:30   ✓ Passed  ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Data source**: `actions/get-grades-detail.ts`

---

## 6. Dashboard Integration

Update the dashboard (Phase 2) quiz progress widget to link to grades and quiz pages:
- Clicking a quiz item navigates to the quiz entry page
- "View All Grades" link at bottom of quiz progress card → `/grades`
- Grade summary card on dashboard showing overall average

---

## 7. Verification Checklist

- [ ] Pre-test is available at course enrollment
- [ ] Post-test is locked until all modules are complete
- [ ] Post-test unlocks correctly when last module is completed
- [ ] Quiz timer counts down and auto-submits at 0
- [ ] Timer warning appears at 5 minutes remaining
- [ ] Quiz state persists in localStorage (resume after accidental nav)
- [ ] Answers are validated server-side (correct answers never sent to client)
- [ ] Quiz results show correct/incorrect with explanations
- [ ] Confetti on passing a quiz
- [ ] Admin can create/edit/delete quizzes
- [ ] Admin can add/edit/delete/reorder questions
- [ ] Admin can preview quiz
- [ ] Grades overview shows all enrolled courses
- [ ] Grades detail shows module breakdown and attempt history
- [ ] Score comparison widget shows pre vs post growth
- [ ] `npm run build` succeeds

---

## 8. Files Created/Modified Summary

### New Files
- `app/(course)/courses/[courseId]/quiz/[quizId]/page.tsx` -- quiz entry
- `app/(course)/courses/[courseId]/quiz/[quizId]/take/page.tsx` -- quiz taking
- `app/(course)/courses/[courseId]/quiz/[quizId]/results/[attemptId]/page.tsx` -- results
- `app/(course)/courses/[courseId]/quiz/[quizId]/_components/quiz-timer.tsx`
- `app/(course)/courses/[courseId]/quiz/[quizId]/_components/quiz-question.tsx`
- `app/(course)/courses/[courseId]/quiz/[quizId]/_components/quiz-progress-bar.tsx`
- `app/(course)/courses/[courseId]/quiz/[quizId]/_components/quiz-navigation.tsx`
- `hooks/use-quiz-store.ts` -- Zustand quiz state
- `components/score-comparison.tsx`
- `actions/check-post-test-lock.ts`
- `actions/get-grades-overview.ts`
- `actions/get-grades-detail.ts`
- `app/(dashboard)/(routes)/grades/page.tsx`
- `app/(dashboard)/(routes)/grades/[courseId]/page.tsx`
- `app/(admin)/(routes)/courses/[courseId]/quizzes/page.tsx`
- `app/(admin)/(routes)/courses/[courseId]/quizzes/[quizId]/page.tsx`
- `app/(admin)/(routes)/courses/[courseId]/quizzes/[quizId]/preview/page.tsx`
- `app/(admin)/(routes)/courses/[courseId]/quizzes/[quizId]/_components/question-form.tsx`
- All quiz API routes (start, submit, results, CRUD)

### Modified Files
- `app/(dashboard)/(routes)/(root)/_components/quiz-progress.tsx` -- link to quiz/grades
- `app/(course)/courses/[courseId]/_components/course-sidebar.tsx` -- quiz items in sidebar
