<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/logo/wordmark-footer.png">
    <img src="public/logo/wordmark.png" alt="Akomapa Academy" width="420">
  </picture>
</p>

<p align="center">
  <strong>Global Health Education &amp; Leadership Program (GHELP)</strong><br>
  A student-powered, expert-supervised learning platform for the next generation of health leaders.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React">
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma">
  <img src="https://img.shields.io/badge/Clerk-6C47FF?style=for-the-badge&logo=clerk&logoColor=white" alt="Clerk">
  <img src="https://img.shields.io/badge/Mux-FF2D5E?style=for-the-badge&logo=mux&logoColor=white" alt="Mux">
  <img src="https://img.shields.io/badge/Stripe-635BFF?style=for-the-badge&logo=stripe&logoColor=white" alt="Stripe">
  <img src="https://img.shields.io/badge/Framer_Motion-0055FF?style=for-the-badge&logo=framer&logoColor=white" alt="Framer Motion">
  <img src="https://img.shields.io/badge/Radix_UI-161618?style=for-the-badge&logo=radixui&logoColor=white" alt="Radix UI">
  <img src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel">
</p>

---

> [!IMPORTANT]
> **Proprietary and confidential.** This repository and its contents are the property of the Akomapa Health Foundation. It is not an open-source project. No license is granted to copy, distribute, modify, or reuse any part of this codebase. Access is restricted to authorized team members.

---

## About

Akomapa Academy is the digital home of the Akomapa Global Health Education &amp; Leadership Program (GHELP). It delivers a structured, ten-course curriculum that trains students to lead community-rooted, ethically grounded healthcare, pairing student-powered learning with expert supervision.

Guiding idea: *Nya Akomapa*, "have a good heart." The platform measures real growth (pre and post-tests), recognizes it (badges, streaks, reflection), and certifies it with independently verifiable certificates.

Akomapa Academy is operated by the Akomapa Health Foundation, a 501(c)(3) nonprofit. Learn more at [akomapa.org](https://www.akomapa.org).

## Features

### Learner experience
- **Ten-course GHELP pathway** with a guided learning path and progress tracking.
- **Course player** with Mux-hosted video chapters, free and gated content, and resource attachments.
- **Quizzes with pre and post-tests** that quantify knowledge growth per course.
- **Grades** overview across enrolled courses.
- **Community forum** for discussion, with categories, posts, and threaded comments.
- **Reflection journal** for personal learning notes.
- **Achievements**: badges and streaks to sustain engagement.
- **Verifiable certificates** rendered as PDFs, each with a unique number confirmable by anyone at `/verify`.

### Administration
- **Admin console** for courses, students, quizzes, and community moderation.
- **Analytics** dashboard (enrollment, engagement, outcomes) built with Recharts.
- **Authoring tools** for courses and chapters, including drag-and-drop ordering and a rich-text editor.

### Platform
- Public marketing site, authenticated app, and a public certificate-verification surface.
- Light and dark themes, responsive across devices, with a shared app shell and a collapsible sidebar rail.
- SEO and social-preview ready: Open Graph, Twitter cards, JSON-LD, sitemap, robots, and web manifest.

## Tech stack

| Area | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router), React 18 |
| Language | TypeScript |
| Styling | Tailwind CSS, shadcn/ui, Radix UI primitives, `tailwindcss-animate` |
| Motion | Framer Motion |
| Fonts | Fraunces (display), Outfit (sans) via `next/font` |
| Database | PostgreSQL with Prisma ORM (`@prisma/adapter-pg`) |
| Auth | Clerk |
| Video | Mux (`@mux/mux-node`, `@mux/mux-player-react`) |
| File uploads | UploadThing |
| Payments | Stripe |
| Certificates | `@react-pdf/renderer` |
| Data & tables | TanStack Table, Recharts |
| Forms & validation | React Hook Form, Zod |
| State | Zustand |
| Tooling | ESLint, Prettier-style lint-staged, Husky, `tsx` |

## Project structure

```
app/
  (marketing)/        Public landing site (hero, mission, journey, outcomes, ...)
  (auth)/             Clerk sign-in / sign-up
  (dashboard)/        Authenticated app (student + admin), uses AppShell
    (routes)/         dashboard, courses, grades, search, community,
                      journal, learning-path, settings, admin/*, teacher/*
  (course)/           Course player: chapters + quizzes (take / results)
  verify/             Public certificate verification
  api/                Route handlers (courses, community, journal, settings,
                      uploadthing, Clerk + Stripe webhooks)
  robots.ts           SEO robots
  sitemap.ts          SEO sitemap
  layout.tsx          Root layout, metadata, providers
actions/              Server actions
components/
  shell/              AppShell, header, mobile nav, collapsible sidebar
  ui/                 shadcn/Radix primitives
  brand/              Brand mark
lib/                  Utilities, site config, certificate template, Stripe
prisma/               Schema and migrations
public/               Static assets (logos, landing media, icons)
scripts/              Seed and maintenance scripts
```

## Getting started

> For authorized internal development only.

### Prerequisites
- Node.js 18.17+ and npm
- PostgreSQL 15+ (or Docker Compose)
- Accounts/keys for Clerk, Mux, UploadThing, and Stripe

### 1. Install

```bash
npm install
```

### 2. Configure environment

Create `.env.local`:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/akomapa?schema=public"

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
CLERK_WEBHOOK_SECRET=whsec_...

# Mux
MUX_TOKEN_ID=...
MUX_TOKEN_SECRET=...

# UploadThing
UPLOADTHING_SECRET=sk_live_...
UPLOADTHING_APP_ID=...

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Canonical/OG base for production (else falls back to the Vercel production URL)
NEXT_PUBLIC_SITE_URL=https://your-production-domain

# Admin/teacher access
NEXT_PUBLIC_TEACHER_ID=user_...
```

### 3. Database

```bash
docker-compose up -d        # optional local Postgres on :5433
npx prisma migrate deploy   # apply migrations
npx prisma generate         # generate client
npm run seed                # optional seed data
```

### 4. Run

```bash
npm run dev                 # http://localhost:3000
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Generate Prisma client, apply migrations, build for production |
| `npm start` | Run the production build |
| `npm run lint` | ESLint (zero warnings allowed) |
| `npm run typecheck` | TypeScript type checking |
| `npm run validate` | Lint + typecheck |
| `npm run db:migrate` | Create/apply a development migration |
| `npm run db:studio` | Open Prisma Studio |
| `npm run seed` | Seed the database |

## Design system

The brand pairs Akomapa's Munsell teal with a warm gold accent, set in Fraunces (display) and Outfit (text). All color is driven by CSS variables in `app/globals.css` and mapped through `tailwind.config.ts`, so theming (including dark mode) stays centralized. The marketing site uses an editorial rhythm of light sections with deep-teal anchor bands; the app uses a shared shell with a collapsible sidebar rail.

| Token | Value |
| --- | --- |
| Primary (Munsell teal) | `#0097b2` |
| Accent (gold) | `#ebb92b` |
| Deep surface | `#06373f` |
| Background | `#f3f8f9` |

## SEO and metadata

Metadata is centralized in `lib/site-config.ts` and the root layout: title templates, Open Graph and Twitter cards, icons, web manifest, canonical URL, and theme color. The homepage emits `EducationalOrganization` and `WebSite` JSON-LD. `app/robots.ts` and `app/sitemap.ts` generate `robots.txt` and `sitemap.xml`. Set `NEXT_PUBLIC_SITE_URL` in production so canonical and social URLs are absolute.

## Deployment

Deployed on Vercel. The build runs `prisma generate` and `prisma migrate deploy` before `next build`. Configure all environment variables in the Vercel project, and set `NEXT_PUBLIC_SITE_URL` plus the Clerk fallback redirect URLs (`/dashboard`) for production.

## Webhooks

- **Clerk** (`/api/webhooks/clerk`): syncs users on `user.created` / `user.updated`. For local testing, expose the dev server with a tunnel (ngrok, Cloudflare Tunnel) and register the URL in the Clerk dashboard with the signing secret in `CLERK_WEBHOOK_SECRET`.
- **Stripe** (`/api/webhook`): handles checkout/payment events; configure `STRIPE_WEBHOOK_SECRET`.

---

<p align="center">
  <em>Nya Akomapa, have a good heart.</em><br>
  © Akomapa Health Foundation. All rights reserved.
</p>
