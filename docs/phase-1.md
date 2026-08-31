# Phase 1: Foundation -- Schema, Roles, Sidebar, Route Structure

> **Goal**: Establish the data foundation and navigation shell that all future features build upon.
> **Prerequisites**: Current codebase on `dev` branch, PostgreSQL running, Clerk configured.

---

## 1. Database Schema Changes

### 1.1 Add Role to User Model

**File**: `prisma/schema.prisma`

Add `role` field to the existing `User` model:

```prisma
model User {
  id        String   @id
  email     String?  @unique
  firstName String?
  lastName  String?
  imageUrl  String?
  role      String   @default("STUDENT") // STUDENT, FACULTY, ADMIN

  // Faculty-specific fields (nullable, only populated for FACULTY role)
  bio            String?  @db.Text
  title          String?  // e.g., "Dr.", "Prof."
  specialization String?  // e.g., "Ethics", "Leadership"

  courses       Course[]
  purchases     Purchase[]
  progress      UserProgress[]
  stripeAccount StripCustomer?
  enrollments   Enrollment[]

  // Faculty relations
  assignedModules Module[] @relation("ModuleFaculty")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 1.2 Create Module Model

Sits between `Course` and `Chapter` (which we'll rename to `Topic`):

```prisma
model Module {
  id          String  @id @default(uuid())
  title       String
  description String? @db.Text
  imageUrl    String? @db.Text
  position    Int
  isPublished Boolean @default(false)

  courseId String
  course  Course @relation(fields: [courseId], references: [id], onDelete: Cascade)

  facultyId String?
  faculty   User?   @relation("ModuleFaculty", fields: [facultyId], references: [id])

  topics Topic[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([courseId])
}
```

### 1.3 Evolve Chapter -> Topic

Keep the existing database table name using `@@map` to avoid data migration issues:

```prisma
model Topic {
  id          String  @id @default(uuid())
  title       String
  description String? @db.Text
  videoUrl    String? @db.Text
  textContent String? @db.Text        // NEW: for non-video content
  contentType String  @default("VIDEO") // VIDEO, TEXT, INTERACTIVE
  position    Int
  isPublished Boolean @default(false)
  isFree      Boolean @default(false)

  muxData MuxData?

  moduleId String
  module   Module @relation(fields: [moduleId], references: [id], onDelete: Cascade)

  userProgress UserProgress[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("Chapter") // Keep existing table name
  @@index([moduleId])
}
```

**Remove** the old `courseId` from Topic/Chapter -- topics now belong to modules, which belong to courses.

### 1.4 Update Related Models

**MuxData** -- update relation from `chapter` to `topic`:
```prisma
model MuxData {
  id         String @id @default(uuid())
  playbackId String
  assetId    String

  topicId String @unique
  topic   Topic  @relation(fields: [topicId], references: [id], onDelete: Cascade)

  @@map("MuxData") // keep table name
}
```

**UserProgress** -- update relation from `chapter` to `topic`:
```prisma
model UserProgress {
  id     String @id @default(uuid())
  userId String
  user   User   @relation(fields: [userId], references: [id])

  topicId String
  topic   Topic  @relation(fields: [topicId], references: [id], onDelete: Cascade)

  isCompleted Boolean @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, topicId])
  @@map("UserProgress") // keep table name
  @@index([topicId])
}
```

### 1.5 Create Enrollment Model

Semantic layer alongside existing `Purchase`:

```prisma
model Enrollment {
  id     String @id @default(uuid())
  userId String
  user   User   @relation(fields: [userId], references: [id])

  courseId String
  course  Course @relation(fields: [courseId], references: [id], onDelete: Cascade)

  status    String   @default("ACTIVE") // ACTIVE, COMPLETED, SUSPENDED
  enrolledAt DateTime @default(now())

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, courseId])
  @@index([courseId])
}
```

### 1.6 Create Quiz System Models

```prisma
model Quiz {
  id               String  @id @default(uuid())
  title            String
  type             String  // PRE_TEST, POST_TEST, MODULE_QUIZ
  timeLimitMinutes Int?
  passingScore     Float   @default(70)
  isPublished      Boolean @default(false)

  courseId  String?
  course   Course?  @relation(fields: [courseId], references: [id], onDelete: Cascade)

  moduleId String?
  module   Module?  @relation(fields: [moduleId], references: [id], onDelete: Cascade)

  questions Question[]
  attempts  QuizAttempt[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([courseId])
  @@index([moduleId])
}

model Question {
  id       String @id @default(uuid())
  text     String @db.Text
  position Int
  points   Int    @default(1)

  quizId String
  quiz   Quiz   @relation(fields: [quizId], references: [id], onDelete: Cascade)

  options QuestionOption[]
  answers QuizAnswer[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([quizId])
}

model QuestionOption {
  id        String  @id @default(uuid())
  text      String
  isCorrect Boolean @default(false)
  position  Int

  questionId String
  question   Question @relation(fields: [questionId], references: [id], onDelete: Cascade)

  selectedIn QuizAnswer[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([questionId])
}

model QuizAttempt {
  id          String    @id @default(uuid())
  score       Float?
  totalPoints Int?
  startedAt   DateTime  @default(now())
  completedAt DateTime?

  userId String
  user   User   @relation(fields: [userId], references: [id])

  quizId String
  quiz   Quiz   @relation(fields: [quizId], references: [id], onDelete: Cascade)

  answers QuizAnswer[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([quizId])
}

model QuizAnswer {
  id String @id @default(uuid())

  attemptId String
  attempt   QuizAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)

  questionId String
  question   Question @relation(fields: [questionId], references: [id], onDelete: Cascade)

  selectedOptionId String?
  selectedOption   QuestionOption? @relation(fields: [selectedOptionId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([attemptId])
  @@index([questionId])
}
```

### 1.7 Update Course Model

Add relations for modules, enrollments, quizzes:

```prisma
model Course {
  id          String  @id @default(uuid())
  userId      String
  user        User    @relation(fields: [userId], references: [id])
  title       String  @db.Text
  description String? @db.Text
  imageUrl    String? @db.Text
  price       Float?
  isPublished Boolean @default(false)

  categoryId String?
  category   Category? @relation(fields: [categoryId], references: [id])

  modules     Module[]      // NEW: replaces chapters
  attachments Attachment[]
  purchases   Purchase[]
  enrollments Enrollment[]  // NEW
  quizzes     Quiz[]        // NEW

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([categoryId])
}
```

Add `quizAttempts` and `enrollments` relations to `User` model too.

---

## 2. Migration Strategy

### Step-by-step migration (to preserve existing data):

1. **Migration 1**: Create `Module` table, `Enrollment` table, Quiz system tables. Add `role`, `bio`, `title`, `specialization` to `User`.
2. **Migration 2**: Add nullable `moduleId` column to `Chapter` table.
3. **Data migration script** (`scripts/migrate-chapters-to-modules.ts`):
   - For each existing Course, create a default Module named "General"
   - Set all Chapters' `moduleId` to their course's default module
   - For each existing Purchase, create a corresponding Enrollment
4. **Migration 3**: Make `moduleId` required on Chapter. Remove old `courseId` from Chapter.
5. **Migration 4**: Rename model from `Chapter` to `Topic` in Prisma schema using `@@map("Chapter")`.

### Data migration script outline:

```typescript
// scripts/migrate-chapters-to-modules.ts
import { db } from "@/lib/db";

async function main() {
  // 1. Get all courses
  const courses = await db.course.findMany({ include: { chapters: true } });

  for (const course of courses) {
    // 2. Create default module for each course
    const module = await db.module.create({
      data: {
        title: "General",
        courseId: course.id,
        position: 0,
        isPublished: true,
      }
    });

    // 3. Assign all chapters to this module
    await db.chapter.updateMany({
      where: { courseId: course.id },
      data: { moduleId: module.id }
    });
  }

  // 4. Migrate purchases to enrollments
  const purchases = await db.purchase.findMany();
  for (const purchase of purchases) {
    await db.enrollment.create({
      data: {
        userId: purchase.userId,
        courseId: purchase.courseId,
        status: "ACTIVE",
        enrolledAt: purchase.createdAt,
      }
    });
  }

  console.log("Migration complete!");
}

main();
```

Run with: `npx tsx scripts/migrate-chapters-to-modules.ts`

---

## 3. Role System

### 3.1 Create `lib/roles.ts`

```typescript
import { db } from "@/lib/db";

export type UserRole = "STUDENT" | "FACULTY" | "ADMIN";

export async function getUserRole(userId: string): Promise<UserRole> {
  // Fallback: check legacy env var
  if (userId === process.env.NEXT_PUBLIC_TEACHER_ID) {
    return "ADMIN";
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  return (user?.role as UserRole) ?? "STUDENT";
}

export async function isAdmin(userId: string): Promise<boolean> {
  const role = await getUserRole(userId);
  return role === "ADMIN";
}

export async function isFaculty(userId: string): Promise<boolean> {
  const role = await getUserRole(userId);
  return role === "FACULTY" || role === "ADMIN";
}

export async function isStudent(userId: string): Promise<boolean> {
  const role = await getUserRole(userId);
  return role === "STUDENT";
}
```

### 3.2 Create `lib/roles-client.ts` (client-side)

```typescript
// Lightweight client-side check -- for UI rendering only, not security
export function isTeacherClient(userId?: string | null): boolean {
  return userId === process.env.NEXT_PUBLIC_TEACHER_ID;
}
```

### 3.3 Update references

Files that import from `lib/teacher.ts` or `lib/teacher-server.ts`:
- `components/navbar-routes.tsx` -- uses `isTeacher()` for "Teacher mode" button
- `app/(dashboard)/(routes)/teacher/` layout and pages -- uses `isTeacherServer()`
- Various API routes -- uses teacher check for authorization

**Strategy**: Keep `lib/teacher.ts` working during transition. Update `navbar-routes.tsx` to show "Admin" button instead of "Teacher mode" using the new role check. API routes can gradually migrate.

---

## 4. Sidebar Redesign

### 4.1 Update `app/(dashboard)/_components/sidebar-routes.tsx`

**New route arrays:**

```typescript
const studentRoutes = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: BookOpen,        label: "Courses",   href: "/courses" },
  { icon: GraduationCap,   label: "Grades",    href: "/grades" },
  { icon: Compass,         label: "Browse",    href: "/search" },
  { icon: Users,           label: "Community", href: "/community" },
];

const adminRoutes = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/admin" },
  { icon: BookOpen,        label: "Courses",   href: "/admin/courses" },
  { icon: Users,           label: "Students",  href: "/admin/students" },
  { icon: FileQuestion,    label: "Quizzes",   href: "/admin/quizzes" },
  { icon: BarChart,        label: "Analytics", href: "/admin/analytics" },
];

// Bottom items (both roles)
const bottomRoutes = [
  { icon: Settings, label: "Settings", href: "/settings" },
];
```

**Logic change**: Detect admin page by `pathname?.startsWith("/admin")` instead of `/teacher`.

### 4.2 Update `app/(dashboard)/_components/sidebar.tsx`

Add user info section at bottom, teal-tinted background, logout button:

```tsx
export const Sidebar = () => {
  return (
    <div className="h-full border-r border-akomapa-light-blue/30 flex flex-col overflow-y-auto bg-gradient-to-b from-white to-akomapa-ice/20 shadow-sm">
      <div className="p-6 border-b border-akomapa-ice">
        <Logo />
      </div>
      <div className="flex flex-col w-full flex-1">
        <SidebarRoutes />
      </div>
      {/* Bottom section: Settings + User */}
      <div className="border-t border-akomapa-ice p-4">
        <SidebarBottomRoutes />
        <SidebarUserInfo />
      </div>
    </div>
  );
};
```

### 4.3 Create `app/(dashboard)/_components/sidebar-user-info.tsx`

New component showing user avatar + name + logout:

```tsx
"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { LogOut } from "lucide-react";

export const SidebarUserInfo = () => {
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <div className="flex items-center gap-x-3 mt-2">
      <img
        src={user?.imageUrl}
        alt={user?.firstName || "User"}
        className="h-8 w-8 rounded-full"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate">
          {user?.firstName} {user?.lastName}
        </p>
      </div>
      <button
        onClick={() => signOut()}
        className="text-slate-400 hover:text-red-500 transition"
      >
        <LogOut size={18} />
      </button>
    </div>
  );
};
```

### 4.4 Update `app/(dashboard)/_components/sidebar-item.tsx`

Minor styling: ensure the teal-tinted hover/active states work with the new gradient background. No structural changes needed -- the existing component handles this well.

---

## 5. Route Structure

### 5.1 Create New Route Stubs

**Student routes (under `app/(dashboard)/(routes)/`):**

```
courses/page.tsx         -- "Enrolled Courses" (stub: "Coming in Phase 2")
courses/[courseId]/page.tsx -- "Course Detail" (stub)
grades/page.tsx          -- "Grades Overview" (stub: "Coming in Phase 3")
grades/[courseId]/page.tsx -- "Grades Detail" (stub)
settings/page.tsx        -- "Settings" (stub: "Coming in Phase 5")
community/page.tsx       -- "Community" (stub: "Coming in Phase 4")
```

**Admin routes (new route group `app/(admin)/`):**

```
app/(admin)/
  layout.tsx             -- Same sidebar/navbar pattern but with admin routes
  (routes)/
    page.tsx             -- Admin dashboard (redirect or stub)
    courses/
      page.tsx           -- Course management (move existing teacher/courses)
      [courseId]/
        page.tsx         -- Course editor (move existing)
        modules/
          [moduleId]/
            page.tsx     -- Module editor (NEW)
            topics/
              [topicId]/
                page.tsx -- Topic editor (move existing chapter editor)
    students/
      page.tsx           -- Student list (stub)
    quizzes/
      page.tsx           -- Quiz management (stub)
    analytics/
      page.tsx           -- Analytics (move existing teacher/analytics)
```

### 5.2 Admin Layout

Create `app/(admin)/layout.tsx` -- mirrors dashboard layout but uses admin sidebar routes:

```tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isAdmin, isFaculty } from "@/lib/roles";
import { Navbar } from "@/app/(dashboard)/_components/navbar";
import { Sidebar } from "@/app/(dashboard)/_components/sidebar";

const AdminLayout = async ({ children }: { children: React.ReactNode }) => {
  const { userId } = await auth();
  if (!userId) return redirect("/sign-in");

  const hasAccess = await isAdmin(userId) || await isFaculty(userId);
  if (!hasAccess) return redirect("/");

  return (
    <div className="h-full">
      <div className="max-md:hidden flex h-full w-56 flex-col fixed inset-y-0 left-0 z-[60]">
        <Sidebar />
      </div>
      <main className="md:pl-56 pt-[80px] h-full">
        <div className="fixed top-0 left-0 right-0 z-50 h-[80px]">
          <Navbar />
        </div>
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;
```

### 5.3 Update Navbar Routes

Update `components/navbar-routes.tsx`:
- Change "Teacher mode" to "Admin" button
- Change link from `/teacher/courses` to `/admin/courses`
- Change `isTeacherPage` to `isAdminPage` (check for `/admin` prefix)
- Update Exit button to go back to `/` from admin pages

---

## 6. Update Seed Script

### 6.1 Update `scripts/seed.ts`

Replace existing categories with GHELP-relevant ones:

```typescript
const categories = [
  { name: "Ethics & Values" },
  { name: "Leadership & Power" },
  { name: "Community Health" },
  { name: "Research & Data" },
  { name: "Systems Thinking" },
  { name: "Sustainability" },
  { name: "Interprofessional Practice" },
  { name: "Advocacy & Governance" },
];
```

---

## 7. Update Existing Actions & Components

### Files that reference `chapter`/`Chapter` (need renaming to `topic`/`Topic`):

| File | Change |
|------|--------|
| `actions/get-chapter.ts` | Rename to `get-topic.ts`, update Prisma queries |
| `actions/get-courses.ts` | Update to include modules → topics hierarchy |
| `actions/get-dashboard-courses.ts` | Update progress calculation through modules |
| `actions/get-progress.ts` | Update to traverse modules → topics |
| `app/(course)/.../chapters/[chapterId]/page.tsx` | Move to `topics/[topicId]/page.tsx` |
| `app/(course)/.../_components/course-sidebar.tsx` | Update to show modules → topics |
| `app/(course)/.../_components/course-sidebar-item.tsx` | Update props from chapter to topic |
| `components/navbar-routes.tsx` | Replace `isTeacher` with role check |
| All API routes under `api/courses/[courseId]/chapters/` | Move to `api/courses/[courseId]/modules/[moduleId]/topics/` |

### Strategy: Keep backward-compatible redirects

For any existing URLs like `/courses/[id]/chapters/[id]`, add redirects in the course layout or middleware to point to the new routes.

---

## 8. Verification Checklist

- [ ] `npx prisma migrate dev` runs successfully
- [ ] Data migration script runs without errors
- [ ] All existing chapters appear as topics under default modules
- [ ] All existing purchases have corresponding enrollments
- [ ] Sidebar shows correct routes for students
- [ ] Sidebar shows correct routes for admin users
- [ ] Admin layout protects routes (non-admin users redirected)
- [ ] Legacy `/teacher` URLs redirect to `/admin` equivalents
- [ ] "Admin" button in navbar appears for admin users
- [ ] User info displays at bottom of sidebar
- [ ] Logout button works
- [ ] `npm run build` succeeds with no type errors
- [ ] Existing course player still works with the new schema
- [ ] Seed script creates GHELP categories

---

## 9. Files Created/Modified Summary

### New Files
- `lib/roles.ts` -- role-based access helpers
- `lib/roles-client.ts` -- client-side role check
- `scripts/migrate-chapters-to-modules.ts` -- data migration
- `app/(dashboard)/_components/sidebar-user-info.tsx` -- user info component
- `app/(admin)/layout.tsx` -- admin layout
- `app/(admin)/(routes)/page.tsx` -- admin dashboard stub
- `app/(admin)/(routes)/courses/page.tsx` -- moved from teacher
- `app/(admin)/(routes)/students/page.tsx` -- stub
- `app/(admin)/(routes)/quizzes/page.tsx` -- stub
- `app/(dashboard)/(routes)/courses/page.tsx` -- stub
- `app/(dashboard)/(routes)/grades/page.tsx` -- stub
- `app/(dashboard)/(routes)/settings/page.tsx` -- stub
- `app/(dashboard)/(routes)/community/page.tsx` -- stub

### Modified Files
- `prisma/schema.prisma` -- all schema changes
- `app/(dashboard)/_components/sidebar-routes.tsx` -- new route arrays
- `app/(dashboard)/_components/sidebar.tsx` -- layout + user section
- `components/navbar-routes.tsx` -- admin button, role check
- `scripts/seed.ts` -- GHELP categories
- `actions/get-chapter.ts` -> `actions/get-topic.ts`
- `actions/get-courses.ts` -- module-aware queries
- `actions/get-dashboard-courses.ts` -- module-aware progress
- `actions/get-progress.ts` -- module-aware calculation
