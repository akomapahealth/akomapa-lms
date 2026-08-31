# Phase 4: Community Forum & Social Platform

> **Goal**: Build a lightweight social platform where students connect, discuss course material, and share ideas.
> **Prerequisites**: Phase 1-3 complete (schema, dashboard, quizzes).

---

## 1. Database Schema Additions

Add to `prisma/schema.prisma`:

```prisma
model ForumCategory {
  id          String @id @default(uuid())
  name        String @unique
  description String?
  color       String @default("#0097b2") // hex color for badge
  position    Int    @default(0)

  posts ForumPost[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ForumPost {
  id        String  @id @default(uuid())
  title     String
  content   String  @db.Text
  isPinned  Boolean @default(false)
  isLocked  Boolean @default(false)

  userId String
  user   User   @relation(fields: [userId], references: [id])

  categoryId String
  category   ForumCategory @relation(fields: [categoryId], references: [id])

  courseId String? // optional association with a course
  course   Course? @relation(fields: [courseId], references: [id])

  comments ForumComment[]
  likes    PostLike[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([categoryId])
  @@index([courseId])
  @@index([userId])
}

model ForumComment {
  id      String @id @default(uuid())
  content String @db.Text

  userId String
  user   User   @relation(fields: [userId], references: [id])

  postId String
  post   ForumPost @relation(fields: [postId], references: [id], onDelete: Cascade)

  parentId String?        // for nested replies (max 2 levels)
  parent   ForumComment?  @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies  ForumComment[] @relation("CommentReplies")

  likes CommentLike[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([postId])
  @@index([parentId])
  @@index([userId])
}

model PostLike {
  id String @id @default(uuid())

  userId String
  user   User @relation(fields: [userId], references: [id])

  postId String
  post   ForumPost @relation(fields: [postId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([userId, postId])
  @@index([postId])
}

model CommentLike {
  id String @id @default(uuid())

  userId String
  user   User @relation(fields: [userId], references: [id])

  commentId String
  comment   ForumComment @relation(fields: [commentId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([userId, commentId])
  @@index([commentId])
}
```

**Update existing models** -- add relations to `User` and `Course`:

```prisma
// In User model, add:
forumPosts    ForumPost[]
forumComments ForumComment[]
postLikes     PostLike[]
commentLikes  CommentLike[]

// In Course model, add:
forumPosts ForumPost[]
```

### Seed Default Categories

Add to seed script:

```typescript
const forumCategories = [
  { name: "General Discussion", description: "Open conversation about anything GHELP-related", color: "#0097b2" },
  { name: "Ethics & Values", description: "Discuss ethical dilemmas and values in global health", color: "#ebb92b" },
  { name: "Case Studies", description: "Share and analyze real-world case studies", color: "#10b981" },
  { name: "Introductions", description: "Introduce yourself to the GHELP community", color: "#8b5cf6" },
  { name: "Course Help", description: "Ask questions about course material", color: "#f59e0b" },
  { name: "Career & Mentorship", description: "Career guidance and mentorship connections", color: "#ec4899" },
];
```

---

## 2. Community Hub Page

**File**: `app/(dashboard)/(routes)/community/page.tsx`

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Community                                    [+ New Post]  │
│                                                              │
│  [All] [General] [Ethics] [Case Studies] [Intros] [Help]   │
│                                                              │
│  ┌─ Search posts... ─────────────────────── [Sort: Recent]─┐│
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ 📌 Welcome to the GHELP Community!                      ││
│  │ Posted by Akomapa Team · 2 days ago                     ││
│  │ Share your thoughts, ask questions, and connect with... ││
│  │ ♥ 24  💬 12                              [Ethics]       ││
│  ├──────────────────────────────────────────────────────────┤│
│  │ Ethical dilemma: When screening causes harm             ││
│  │ Posted by Brian F. · 5 hours ago                        ││
│  │ I've been thinking about the module on "Why Screening   ││
│  │ Alone Fails" and wanted to discuss...                   ││
│  │ ♥ 8  💬 3                          [Case Studies]       ││
│  ├──────────────────────────────────────────────────────────┤│
│  │ ...                                                      ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  [Load More]                                                │
└─────────────────────────────────────────────────────────────┘
```

### Components

**`_components/post-card.tsx`** -- Post preview card:
- Author avatar + name + relative timestamp ("5 hours ago")
- Post title (bold, clickable)
- Content excerpt (2-line clamp)
- Like count + comment count
- Category badge (colored)
- Pinned indicator for pinned posts
- Locked indicator for locked posts

**`_components/category-tabs.tsx`** -- Horizontal scrollable category filter:
- "All" tab + one tab per ForumCategory
- Active tab highlighted with category color
- Clicking filters the post list

**`_components/post-search.tsx`** -- Search + sort controls:
- Search input with debounce (reuse existing `useDebounce` hook)
- Sort dropdown: Recent, Most Liked, Most Discussed

### Data Loading

Use URL search params for filtering/sorting: `?category=xxx&sort=recent&q=search`

**Server action**: `actions/get-forum-posts.ts`

```typescript
interface GetForumPostsParams {
  categoryId?: string;
  courseId?: string;
  sort?: "recent" | "most_liked" | "most_discussed";
  search?: string;
  page?: number;
  limit?: number;
}

interface ForumPostPreview {
  id: string;
  title: string;
  excerpt: string; // first 200 chars of content
  author: { id: string; firstName: string; lastName: string; imageUrl: string };
  category: { id: string; name: string; color: string };
  course?: { id: string; title: string };
  likeCount: number;
  commentCount: number;
  isLikedByUser: boolean;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: Date;
}
```

Pagination: cursor-based or offset-based, 20 posts per page.

---

## 3. Post Detail Page

**File**: `app/(dashboard)/(routes)/community/[postId]/page.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Community                                        │
│                                                              │
│  Ethical dilemma: When screening causes harm                │
│  [Case Studies]  [Leadership & Power course]                │
│                                                              │
│  ┌──────────────────────────────┐                           │
│  │ [Avatar] Brian F.            │  Posted 5 hours ago       │
│  │ Student · Course 2           │                           │
│  └──────────────────────────────┘                           │
│                                                              │
│  I've been thinking about the module on "Why Screening      │
│  Alone Fails" and wanted to discuss a scenario that came    │
│  up during our reading...                                   │
│                                                              │
│  [Full rich-text content rendered here]                     │
│                                                              │
│  ♥ 8 Likes    [♥ Like]                                     │
│                                                              │
│  ─────────────────────────────────────────                  │
│  3 Comments                                                 │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ [Avatar] Sarah K. · 3 hours ago                         ││
│  │ Great point! I had a similar experience when...         ││
│  │ ♥ 2  [Reply]                                            ││
│  │                                                          ││
│  │   ┌──────────────────────────────────────────────────────┤│
│  │   │ [Avatar] Brian F. · 1 hour ago                      ││
│  │   │ Thanks Sarah! That's exactly what I was thinking... ││
│  │   │ ♥ 1                                                 ││
│  │   └──────────────────────────────────────────────────────┤│
│  ├──────────────────────────────────────────────────────────┤│
│  │ [Avatar] Dr. Rabin · 2 hours ago                        ││
│  │ Excellent discussion. Consider also the ethical          ││
│  │ framework we covered in Module 3...                     ││
│  │ ♥ 5  [Reply]                                            ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Write a comment...                                       ││
│  │                                                          ││
│  │                                      [Post Comment]     ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Components

**`_components/comment-thread.tsx`** -- Renders a comment with nested replies:
- Author avatar + name + relative time
- Comment content (rendered from text, support basic markdown)
- Like button + count
- Reply button (opens inline reply form)
- Replies indented (max 1 level of nesting to keep it manageable)

**`_components/comment-form.tsx`** -- Comment input:
- Textarea with placeholder
- "Post Comment" button
- Loading state during submission
- Optimistic UI: show comment immediately, revert on error

**`_components/like-button.tsx`** -- Reusable like toggle:
- Heart icon (outline when not liked, filled when liked)
- Count display
- Optimistic toggle with server sync
- Works for both posts and comments

---

## 4. Create Post Page

**File**: `app/(dashboard)/(routes)/community/new/page.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Community                                        │
│                                                              │
│  Create a New Post                                          │
│                                                              │
│  Title                                                      │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Enter your post title...                                 ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  Category                                                   │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Select a category...                              [▾]   ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  Related Course (optional)                                  │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Select a course...                                [▾]   ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  Content                                                    │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ [React Quill rich text editor]                           ││
│  │                                                          ││
│  │                                                          ││
│  │                                                          ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  [Cancel]                              [Preview] [Publish]  │
└─────────────────────────────────────────────────────────────┘
```

- Use React Quill (already installed) for rich text editing
- Category selector (required) -- shadcn Select
- Course selector (optional) -- shadcn Combobox for search
- Preview mode: render the post as it will appear
- Form validation with react-hook-form + zod

---

## 5. API Routes

```
GET    /api/community/posts                    -- list posts (with pagination, filters)
POST   /api/community/posts                    -- create post
GET    /api/community/posts/[postId]           -- get post detail
PATCH  /api/community/posts/[postId]           -- edit post (author only)
DELETE /api/community/posts/[postId]           -- delete post (author or admin)

POST   /api/community/posts/[postId]/comments  -- add comment
PATCH  /api/community/comments/[commentId]     -- edit comment
DELETE /api/community/comments/[commentId]     -- delete comment

POST   /api/community/posts/[postId]/like      -- toggle post like
POST   /api/community/comments/[commentId]/like -- toggle comment like

GET    /api/community/categories               -- list categories
```

### Key API Behaviors

**Like toggle**: POST to like endpoint. If like exists, delete it (unlike). If not, create it. Return new like count.

**Comment nesting**: When creating a comment with `parentId`, verify the parent exists and belongs to the same post. Reject if nesting would exceed 2 levels.

**Authorization**:
- Any authenticated user can create posts and comments
- Only the author can edit their own post/comment
- Admins can delete any post/comment and pin/lock posts
- Locked posts: no new comments allowed

---

## 6. Community Profile (Lightweight)

**File**: `app/(dashboard)/(routes)/community/profile/[userId]/page.tsx`

Simple profile view accessible from clicking a user's name in community:

```
┌─────────────────────────────────────────────────────────────┐
│  [Avatar]  Brian Fleischer                                  │
│  Student · Joined May 2026                                  │
│  Enrolled in 3 courses                                      │
│                                                              │
│  Posts (12)                                                  │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ [Post card previews - most recent 5]                     ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  Recent Activity                                            │
│  • Commented on "Ethical dilemma..." · 1 hour ago           │
│  • Liked "Welcome to GHELP" · 2 hours ago                  │
│  • Posted "My reflection on Module 3" · yesterday          │
└─────────────────────────────────────────────────────────────┘
```

Data from User + ForumPost + ForumComment queries. No separate profile model needed -- use Clerk user data + forum activity.

---

## 7. Admin Community Management

Add to admin panel:

**File**: `app/(admin)/(routes)/community/page.tsx`

- View all posts with moderation actions
- Pin/unpin posts
- Lock/unlock posts (prevent new comments)
- Delete posts or comments
- Manage forum categories (CRUD)

---

## 8. Verification Checklist

- [ ] Community page loads with category tabs
- [ ] Posts display with correct author, excerpt, counts
- [ ] Category filtering works
- [ ] Search works with debounce
- [ ] Sorting works (recent, most liked, most discussed)
- [ ] Post detail shows full content + comments
- [ ] Nested replies render correctly (max 2 levels)
- [ ] Like toggle works for posts and comments (optimistic UI)
- [ ] Create post form validates and submits
- [ ] Rich text renders correctly in post detail
- [ ] Comment form submits and shows new comment
- [ ] Reply to comment works inline
- [ ] Locked posts prevent new comments
- [ ] Pinned posts appear at top of list
- [ ] Admin can pin/lock/delete posts
- [ ] Community profile shows user's posts and activity
- [ ] Pagination/load more works
- [ ] `npm run build` succeeds

---

## 9. Files Created/Modified Summary

### New Files
- `app/(dashboard)/(routes)/community/page.tsx`
- `app/(dashboard)/(routes)/community/[postId]/page.tsx`
- `app/(dashboard)/(routes)/community/new/page.tsx`
- `app/(dashboard)/(routes)/community/profile/[userId]/page.tsx`
- `app/(dashboard)/(routes)/community/_components/post-card.tsx`
- `app/(dashboard)/(routes)/community/_components/category-tabs.tsx`
- `app/(dashboard)/(routes)/community/_components/post-search.tsx`
- `app/(dashboard)/(routes)/community/_components/comment-thread.tsx`
- `app/(dashboard)/(routes)/community/_components/comment-form.tsx`
- `app/(dashboard)/(routes)/community/_components/like-button.tsx`
- `app/(admin)/(routes)/community/page.tsx`
- `actions/get-forum-posts.ts`
- All community API routes

### Modified Files
- `prisma/schema.prisma` -- forum models
- `scripts/seed.ts` -- forum categories
