# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.0] - 2026-01-13

### Overview

Fixed Next.js 15 compatibility issues by updating all dynamic API calls (`auth()`, `headers()`) to use async/await pattern as required by Next.js 15.

---

### Fixed

#### Next.js 15 Async API Compatibility
- **Issue**: Application was throwing errors: "Route '/' used `...headers()` or similar iteration. `headers()` should be awaited before using its value."
- **Root Cause**: Next.js 15 requires all dynamic APIs (`headers()`, `cookies()`, `params`, `auth()`) to be awaited before use
- **Solution**: Updated all `auth()` calls and `headers()` calls throughout the application to use `await`

**Files Updated:**
- All API routes (`app/api/**/route.ts`) - Updated `auth()` calls to `await auth()`
- All page components (`app/**/page.tsx`) - Updated `auth()` calls to `await auth()`
- All layout components (`app/**/layout.tsx`) - Updated `auth()` calls to `await auth()` and made components async
- Webhook route (`app/api/webhook/route.ts`) - Updated `headers()` to `await headers()`

**Before:**
```typescript
const { userId } = auth();
const signature = headers().get("Stripe-Signature");
```

**After:**
```typescript
const { userId } = await auth();
const headersList = await headers();
const signature = headersList.get("Stripe-Signature");
```

**Total Files Modified:** 25+ files across API routes, pages, layouts, and components

---

## [2.2.0] - 2026-01-13

### Overview

Added Docker-based local PostgreSQL development environment to enable offline development and testing before deploying to Supabase.

---

### Added

#### Docker Development Environment (`docker-compose.yml`)
- Created `docker-compose.yml` for local PostgreSQL database
- Uses `postgres:15` image (matches Supabase's PostgreSQL version)
- Database name: `akomapa`
- Default credentials: `postgres:postgres`
- Port: `5433` (to avoid conflict with locally installed PostgreSQL on port 5432)
- Includes health check for reliable startup detection
- Uses named volume `akomapa_postgres_data` for data persistence

**docker-compose.yml:**
```yaml
services:
  postgres:
    image: postgres:15
    container_name: akomapa-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: akomapa
    ports:
      - "5433:5432"
    volumes:
      - akomapa_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  akomapa_postgres_data:
```

---

### Local Development Setup

#### Environment Variables for Local Development
Update `.env` file with local Docker database connection:

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/akomapa"
DIRECT_URL="postgresql://postgres:postgres@127.0.0.1:5433/akomapa"
```

**Important Notes:**
- Use `127.0.0.1` instead of `localhost` (Windows resolves `localhost` to IPv6 which can cause connection issues)
- Use port `5433` to avoid conflict with locally installed PostgreSQL

#### Docker Commands Reference

| Command | Purpose |
|---------|---------|
| `docker-compose up -d` | Start the database |
| `docker-compose down` | Stop the database |
| `docker-compose down -v` | Stop and delete all data |
| `docker-compose logs -f postgres` | View database logs |

---

### Files Added

| File Path | Description |
|-----------|-------------|
| `docker-compose.yml` | Docker configuration for local PostgreSQL |

---

## [2.1.0] - 2026-01-13

### Overview

Database fixes, Next.js upgrade, and infrastructure improvements to resolve startup errors and modernize the application.

---

### Fixed

#### Prisma Configuration (`prisma.config.ts`)
- **Issue**: Prisma CLI commands (`prisma studio`, `prisma db push`) failed with "No database URL found" error
- **Root Cause**: Prisma 7.x requires datasource URL configuration in `prisma.config.ts`, and environment variables were not loaded
- **Solution**: 
  - Added `datasource` block with `url` and `directUrl` properties
  - Added `dotenv` import to load environment variables from `.env` file
  - Maintained `migrate.resolveDatasource()` for backward compatibility

**Before:**
```typescript
export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  migrate: { ... }
});
```

**After:**
```typescript
import { config } from "dotenv";
config();

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL!,
    directUrl: process.env.DIRECT_URL,
  },
  migrate: { ... }
});
```

#### Database Tables Missing
- **Issue**: Application crashed with "The table `public.Category` does not exist" and similar errors for Purchase table
- **Solution**: Ran `npx prisma db push` to synchronize schema with database
- **Tables Created**: Course, Category, Attachment, Chapter, MuxData, UserProgress, Purchase, StripCustomer

---

### Changed

#### Next.js Upgrade (`package.json`)
- Upgraded `next` from `14.2.35` to `^15.1.0`
- Upgraded `eslint-config-next` from `14.2.35` to `^15.1.0`
- Added `dotenv` dependency (`^16.4.5`) for Prisma configuration

#### Image Configuration (`next.config.mjs`)
- **Issue**: Deprecation warning "The 'images.domains' configuration is deprecated"
- **Solution**: Migrated from deprecated `images.domains` to `images.remotePatterns`

**Before:**
```javascript
images: {
    domains: ["utfs.io", "images.unsplash.com"]
}
```

**After:**
```javascript
images: {
    remotePatterns: [
        { protocol: 'https', hostname: 'utfs.io' },
        { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
}
```

---

### Files Modified

| File Path | Type of Change |
|-----------|---------------|
| `prisma.config.ts` | Added datasource config and dotenv loading |
| `package.json` | Updated Next.js to 15.1.0, added dotenv |
| `next.config.mjs` | Changed to remotePatterns for images |

---

### Migration Notes

1. **Environment Variables**: Ensure `.env` file exists with `DATABASE_URL` and optionally `DIRECT_URL`
2. **Database Sync**: Run `npx prisma db push` if tables are missing
3. **Prisma Generate**: Run `npx prisma generate` after updating Prisma configuration
4. **Next.js 15 Breaking Changes**: 
   - Async request APIs (cookies, headers, params) may need updates in future
   - Caching behavior has changed - monitor for any issues

---

## [2.0.0] - 2026-01-13

### Overview

Complete UI/UX redesign transitioning from "Stay-afloat" LMS to "Akomapa LMS" for Akomapa Health Foundation. This update implements the Akomapa Health brand identity with a teal and gold color scheme while maintaining all existing functionality.

### Color System

The following Akomapa brand colors have been implemented:

| Role | Color Name | Hex Code | Usage |
|------|-----------|----------|-------|
| Primary | Munsell Blue | `#0097b2` | Buttons, links, active states, sidebar accents |
| Primary Dark | Pacific Blue | `#0599b3` | Hover states, focus rings |
| Primary Light | Viking | `#25a5bc` | Lighter accents |
| Secondary/Accent | Nicotine Gold | `#ebb92b` | CTA buttons, highlights, badges |
| Background | Brilliance | `#fdfefe` | Page backgrounds |
| Surface | Ice Cold | `#d5edf1` | Cards, input backgrounds, muted surfaces |
| Border | Light Blue | `#aadce5` | Borders, dividers |

---

### Added

#### New CSS Variables (globals.css)
- Added `--akomapa-teal`, `--akomapa-teal-dark`, `--akomapa-teal-light` CSS variables
- Added `--akomapa-gold`, `--akomapa-ice`, `--akomapa-light-blue`, `--akomapa-cream` CSS variables
- Configured dark mode variants for all new color variables

#### New Tailwind Colors (tailwind.config.ts)
- Added `akomapa.teal` color scale (DEFAULT, dark, light, lighter)
- Added `akomapa.gold` for accent/CTA elements
- Added `akomapa.ice` for surface/background elements
- Added `akomapa.light-blue` for borders
- Added `akomapa.cream` for background variants

---

### Changed

#### Foundation Updates

**`app/globals.css`**
- Updated `--primary` from dark slate to Munsell Blue (`#0097b2`)
- Updated `--secondary` to Ice Cold (`#d5edf1`)
- Updated `--accent` to Nicotine Gold (`#ebb92b`)
- Updated `--background` to Brilliance (`#fdfefe`)
- Updated `--border` to Light Blue (`#aadce5`)
- Updated `--ring` to match primary teal color
- Updated dark mode variants with appropriate contrast

**`tailwind.config.ts`**
- Extended colors object with complete `akomapa` color palette
- Maintained compatibility with existing shadcn/ui components

**`app/layout.tsx`**
- Changed title from "Stay Afloat" to "Akomapa LMS"
- Updated description to: "Empowering the next generation of health leaders through student-powered, expert-supervised learning. Training future healthcare professionals to transform communities."

---

#### Auth Layout Redesign

**`app/(auth)/layout.tsx`**
- **BREAKING**: Fixed incorrect import - changed `Image` from `lucide-react` to `next/image`
- Replaced background image with healthcare-themed Unsplash image (medical professionals training)
- Updated gradient overlay from `sky-700/900` to `akomapa-teal` gradient
- Changed welcome text from "Stay-afloat" to "Akomapa LMS"
- Updated tagline to "Empowering the next generation of health leaders"
- Added Akomapa's motto: "Nya Akomapa — Have a good heart"
- Added gold cross accent element matching Akomapa branding

**Feature Cards Updated:**
- "Learn Anywhere" → "Train Anywhere" with health-focused description
- "Expert Teachers" → "Expert Mentors" with healthcare context

**Statistics Updated:**
- Changed from generic stats to Akomapa-specific metrics:
  - "500+ Patients Served"
  - "10+ Partner Institutions"  
  - "100+ Student Leaders"

**Trust Indicators Updated:**
- "4.9/5 Rating" → "Community-Rooted" with heart icon
- "Verified Platform" → "Expert-Supervised" with checkmark

**Right Panel Updates:**
- Updated logo source from `/stay-float.jpg` to `/akomapa-logo.png`
- Changed brand name from "Stay-afloat" to "Akomapa LMS"
- Changed tagline from "Your best study platform" to "Training Health Leaders"
- Updated stats to: "4 Countries", "5+ Programs", "501(c)(3) Nonprofit"
- Updated footer to "Akomapa Health Foundation"
- Added link to main website (akomapa.org)
- Applied `akomapa-cream` background color
- Applied `akomapa-teal` text color for headings
- Applied `akomapa-light-blue` border accents

---

#### Dashboard Components

**`app/(dashboard)/_components/logo.tsx`**
- Changed image source from `/stay-float.jpg` to `/akomapa-logo.png`
- Updated dimensions to 130x50 for horizontal logo display
- Added flex container with gap for potential text additions

**`app/(dashboard)/_components/sidebar.tsx`**
- Updated border color to `akomapa-light-blue/30`
- Added bottom border with `akomapa-ice` to logo section

**`app/(dashboard)/_components/sidebar-item.tsx`**
- Changed active text color from `sky-700` to `akomapa-teal`
- Changed active background from `sky-200/20` to `akomapa-ice/50`
- Changed hover text color from `slate-600` to `akomapa-teal`
- Changed hover background from `slate-300/20` to `akomapa-ice/50`
- Changed active border color from `sky-700` to `akomapa-teal`
- Changed icon active color from `sky-700` to `akomapa-teal`

---

#### Shared Components

**`components/icon-badge.tsx`**
- Changed default background variant from `bg-sky-100` to `bg-akomapa-ice`
- Changed default icon color from `text-sky-700` to `text-akomapa-teal`
- Maintained `success` variant with emerald colors

**`components/ui/progress.tsx`**
- Changed default progress bar color from `bg-sky-600` to `bg-akomapa-teal`
- Maintained `success` variant with emerald colors

**`components/course-progress.tsx`**
- Changed default text color from `text-sky-700` to `text-akomapa-teal`
- Updated base text class to `text-akomapa-teal`
- Maintained `success` variant with emerald colors

**`components/banner.tsx`**
- Changed warning variant background from `bg-yellow-200/80` to `bg-akomapa-gold/20`
- Changed warning variant border from `border-yellow-30` to `border-akomapa-gold/50`
- Changed warning variant text from `text-primary` to `text-amber-800`
- Changed success variant text from `text-secondary` to `text-white`

**`components/search-input.tsx`**
- Changed search icon color from `text-slate-600` to `text-akomapa-teal`
- Changed input background from `bg-slate-100` to `bg-akomapa-ice/50`
- Changed focus ring from `ring-slate-200` to `ring-akomapa-teal/30`
- Added border color `border-akomapa-light-blue/50`

**`components/course-card.tsx`**
- Changed border color to `border-akomapa-light-blue/30`
- Changed hover border to `border-akomapa-teal/30`
- Changed hover shadow from `shadow-sm` to `shadow-md`
- Changed title hover color from `text-sky-700` to `text-akomapa-teal`

---

#### Search Components

**`app/(dashboard)/(routes)/search/_components/category-item.tsx`**
- Changed border color from `border-slate-200` to `border-akomapa-light-blue/50`
- Changed hover border from `border-sky-700` to `border-akomapa-teal`
- Changed selected state:
  - Border from `border-sky-700` to `border-akomapa-teal`
  - Background from `bg-sky-200/20` to `bg-akomapa-ice/50`
  - Text from `text-sky-800` to `text-akomapa-teal`

---

#### Course Layout Components

**`app/(course)/courses/[courseId]/_components/course-sidebar-item.tsx`**
- Changed hover text color from `text-slate-600` to `text-akomapa-teal`
- Changed hover background from `bg-slate-300/20` to `bg-akomapa-ice/50`
- Changed active text from `text-slate-700` to `text-akomapa-teal`
- Changed active background from `bg-slate-200/20` to `bg-akomapa-ice/50`
- Changed active icon color from `text-slate-700` to `text-akomapa-teal`
- Changed active border from `border-slate-700` to `border-akomapa-teal`
- Maintained completed state styling with emerald colors

---

### Files Modified

| File Path | Type of Change |
|-----------|---------------|
| `app/globals.css` | CSS variables updated |
| `tailwind.config.ts` | Custom colors added |
| `app/layout.tsx` | Metadata updated |
| `app/(auth)/layout.tsx` | Complete redesign |
| `app/(dashboard)/_components/logo.tsx` | Logo source updated |
| `app/(dashboard)/_components/sidebar.tsx` | Border styling updated |
| `app/(dashboard)/_components/sidebar-item.tsx` | Colors updated |
| `components/icon-badge.tsx` | Colors updated |
| `components/ui/progress.tsx` | Colors updated |
| `components/course-progress.tsx` | Colors updated |
| `components/banner.tsx` | Colors updated |
| `components/search-input.tsx` | Colors updated |
| `components/course-card.tsx` | Colors updated |
| `app/(dashboard)/(routes)/search/_components/category-item.tsx` | Colors updated |
| `app/(course)/courses/[courseId]/_components/course-sidebar-item.tsx` | Colors updated |
| `CHANGELOG.md` | Created |
| `next.config.mjs` | Added Unsplash image domain |

---

### Migration Notes

1. **Logo Asset Required**: Ensure `/public/akomapa-logo.png` exists in the public folder
2. **External Image Domain**: `images.unsplash.com` has been added to `next.config.mjs` for the auth layout background image
3. **No Breaking Changes to Functionality**: All existing LMS features remain intact
4. **Dark Mode**: Updated dark mode colors maintain accessibility standards

---

### Dependencies

No new dependencies were added. All changes utilize existing:
- Tailwind CSS configuration
- Next.js Image component
- Class Variance Authority (cva) for component variants

---

## [1.0.0] - Previous

Initial "Stay-afloat" LMS implementation (prior to Akomapa rebranding).
