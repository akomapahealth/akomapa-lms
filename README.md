# Akomapa LMS Platform

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-15.1.0-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=for-the-badge&logo=postgresql)
![Prisma](https://img.shields.io/badge/Prisma-7.2.0-2D3748?style=for-the-badge&logo=prisma)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css)
![Clerk](https://img.shields.io/badge/Clerk-6.15.0-000000?style=for-the-badge)
![Stripe](https://img.shields.io/badge/Stripe-15.12-635BFF?style=for-the-badge&logo=stripe)

**Empowering the next generation of health leaders through student-powered, expert-supervised learning.**

[Features](#-features) • [Tech Stack](#-tech-stack) • [Getting Started](#-getting-started) • [Documentation](#-documentation)

</div>

---

## 📋 Table of Contents

- [About](#-about)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Database Setup](#-database-setup)
- [Running the Project](#-running-the-project)
- [Project Structure](#-project-structure)
- [Key Features](#-key-features)
- [Clerk Webhook Setup](#-clerk-webhook-setup)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 About

Akomapa LMS is a comprehensive Learning Management System designed specifically for healthcare education. Built with modern web technologies, it provides a robust platform for course creation, student enrollment, progress tracking, and analytics. The platform emphasizes community-rooted, expert-supervised learning experiences.

**Mission**: "Nya Akomapa" — Have a good heart. Training future healthcare professionals to transform communities.

---

## ✨ Features

### For Students
- 📚 **Course Discovery** - Browse and search courses by category and title
- 📊 **Progress Tracking** - Monitor learning progress with visual indicators
- 🎥 **Video Learning** - Integrated video player with Mux for seamless playback
- 📝 **Chapter Completion** - Track completed chapters and course progress
- 💳 **Secure Payments** - Stripe integration for course purchases
- 📱 **Responsive Design** - Optimized for all devices

### For Teachers
- 🎓 **Course Management** - Create, edit, and publish courses
- 📖 **Chapter Management** - Organize course content into chapters
- 🎬 **Video Upload** - Upload and manage course videos via Mux
- 📎 **Attachment Management** - Add course materials and resources
- 💰 **Pricing Control** - Set course prices and manage free/premium content
- 📈 **Analytics Dashboard** - Track student enrollment and course performance
- 🔄 **Drag & Drop** - Reorder chapters with intuitive drag-and-drop interface

### Platform Features
- 🔐 **Authentication** - Secure user authentication with Clerk
- 💾 **Database** - PostgreSQL with Prisma ORM
- 🎨 **Modern UI** - Beautiful interface built with Tailwind CSS and Radix UI
- 🔔 **Real-time Updates** - Toast notifications and confetti celebrations
- 📤 **File Uploads** - UploadThing integration for media management
- 🔍 **Search & Filter** - Advanced search and category filtering

---

## 🛠 Tech Stack

### Frontend
- **Framework**: [Next.js 15.1.0](https://nextjs.org/) (App Router)
- **Language**: [TypeScript 5.0](https://www.typescriptlang.org/)
- **UI Library**: [React 18](https://react.dev/)
- **Styling**: [Tailwind CSS 3.4](https://tailwindcss.com/)
- **Components**: [Radix UI](https://www.radix-ui.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Forms**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)

### Backend
- **Runtime**: [Node.js](https://nodejs.org/) 18.17.0+
- **Database**: [PostgreSQL 15](https://www.postgresql.org/)
- **ORM**: [Prisma 7.2.0](https://www.prisma.io/)
- **API Routes**: Next.js API Routes

### Services & Integrations
- **Authentication**: [Clerk 6.15.0](https://clerk.com/)
- **Payments**: [Stripe 15.12.0](https://stripe.com/)
- **Video Hosting**: [Mux](https://www.mux.com/)
- **File Storage**: [UploadThing](https://uploadthing.com/)
- **Webhooks**: [Svix](https://www.svix.com/)

### Development Tools
- **Package Manager**: npm
- **Linting**: ESLint with Next.js config
- **Type Checking**: TypeScript
- **Containerization**: Docker Compose

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.17.0 or higher ([Download](https://nodejs.org/))
- **npm** or **yarn** or **pnpm** or **bun**
- **PostgreSQL** 15+ (or use Docker Compose)
- **Git** ([Download](https://git-scm.com/))

### Optional
- **Docker** and **Docker Compose** (for local database)
- **ngrok** or **Cloudflare Tunnel** (for webhook testing)

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd akomapa-lms
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/akomapa?schema=public"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Clerk Webhook (for local development, use tunneling service)
CLERK_WEBHOOK_SECRET=whsec_...

# UploadThing
UPLOADTHING_SECRET=sk_live_...
UPLOADTHING_APP_ID=...

# Mux
MUX_TOKEN_ID=...
MUX_TOKEN_SECRET=...

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Teacher Mode (optional)
NEXT_PUBLIC_TEACHER_ID=user_...
```

### 4. Set Up Database

#### Option A: Using Docker Compose (Recommended)

```bash
docker-compose up -d
```

This will start a PostgreSQL container on port `5433` with:
- Database: `akomapa`
- User: `postgres`
- Password: `postgres`

#### Option B: Using Local PostgreSQL

1. Create a PostgreSQL database named `akomapa`
2. Update `DATABASE_URL` in `.env.local` with your connection string

### 5. Run Database Migrations

```bash
npx prisma migrate dev
# or
npx prisma migrate deploy
```

### 6. Generate Prisma Client

```bash
npx prisma generate
```

### 7. (Optional) Seed the Database

```bash
npm run seed
# or
npx tsx scripts/seed.ts
```

---

## 🏃 Running the Project

### Development Mode

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

### Other Commands

```bash
# Lint code
npm run lint

# Open Prisma Studio (Database GUI)
npx prisma studio

# Reset database (WARNING: Deletes all data)
npx prisma migrate reset
```

---

## 📁 Project Structure

```
akomapa-lms/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Authentication routes
│   │   ├── (routes)/
│   │   │   ├── sign-in/         # Sign in page
│   │   │   └── sign-up/          # Sign up page
│   │   └── layout.tsx           # Auth layout
│   ├── (dashboard)/              # Dashboard routes
│   │   ├── (routes)/
│   │   │   ├── (root)/          # Home dashboard
│   │   │   ├── search/           # Course search
│   │   │   └── teacher/         # Teacher dashboard
│   │   │       ├── courses/     # Course management
│   │   │       ├── analytics/   # Analytics dashboard
│   │   │       └── create/      # Create course
│   │   └── _components/         # Dashboard components
│   ├── (course)/                 # Course viewing routes
│   │   └── courses/
│   │       └── [courseId]/      # Course pages
│   ├── api/                      # API routes
│   │   ├── courses/              # Course API endpoints
│   │   ├── uploadthing/          # File upload endpoints
│   │   ├── webhook/              # Stripe webhook
│   │   └── webhooks/
│   │       └── clerk/            # Clerk webhook
│   ├── globals.css               # Global styles
│   └── layout.tsx               # Root layout
├── actions/                      # Server actions
├── components/                   # Reusable components
│   ├── ui/                       # UI components (Radix UI)
│   └── providers/               # Context providers
├── hooks/                        # Custom React hooks
├── lib/                          # Utility libraries
├── prisma/                       # Prisma schema and migrations
│   ├── migrations/              # Database migrations
│   └── schema.prisma            # Database schema
├── public/                       # Static assets
├── scripts/                      # Utility scripts
├── .env.local                    # Environment variables (not in git)
├── docker-compose.yml           # Docker configuration
├── middleware.ts                # Next.js middleware
├── next.config.mjs             # Next.js configuration
├── package.json                 # Dependencies
├── tailwind.config.ts          # Tailwind configuration
└── tsconfig.json                # TypeScript configuration
```

---

## 🔑 Key Features

### Authentication & Authorization

The platform uses Clerk for authentication with role-based access control:

- **Student Role**: Default role for all authenticated users
- **Teacher Role**: Set via `NEXT_PUBLIC_TEACHER_ID` environment variable
- Protected routes automatically redirect unauthenticated users

### Course Management

Teachers can create comprehensive courses with:

- **Course Details**: Title, description, image, category, pricing
- **Chapters**: Multiple chapters with videos, descriptions, and free/premium access
- **Attachments**: Course materials and resources
- **Publishing**: Control course visibility and availability

### Payment Integration

Stripe integration enables:

- Secure course purchases
- Webhook handling for payment confirmations
- Automatic enrollment upon successful payment

### Video Hosting

Mux integration provides:

- High-quality video streaming
- Automatic video processing
- Optimized playback experience

---

## 🔔 Clerk Webhook Setup

### Environment Variables

Add the following to your `.env.local` file:

```env
CLERK_WEBHOOK_SECRET=whsec_...
```

You can find your webhook secret in the Clerk Dashboard under **Webhooks → Your Webhook → Signing Secret**.

### Local Development

Clerk webhooks require a publicly accessible URL. For local development, use a tunneling service:

#### Option 1: Using ngrok (Recommended)

```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`) and use it in Clerk Dashboard.

#### Option 2: Using Cloudflare Tunnel

```bash
cloudflared tunnel --url http://localhost:3000
```

### Setting Up the Webhook

1. Go to **Clerk Dashboard → Webhooks**
2. Create or edit your webhook
3. Set the endpoint URL to: `https://your-tunnel-url.ngrok.io/api/webhooks/clerk`
4. Select events: `user.created`, `user.updated`, `user.deleted`
5. Save and copy the signing secret to your `.env.local`

### Webhook Endpoint

The webhook endpoint is located at `/api/webhooks/clerk` and handles:

- **`user.created`** - Creates a new user in the database
- **`user.updated`** - Updates existing user information
- **`user.deleted`** - Logged but not processed (preserves referential integrity)

### Debugging

Check your server logs for webhook processing. The webhook route includes comprehensive logging:

- `[Clerk Webhook] Received webhook request`
- `[Clerk Webhook] Event type: user.created`
- `[Clerk Webhook] User successfully saved to database`

**Troubleshooting:**

If users aren't being created, verify:

1. ✅ `CLERK_WEBHOOK_SECRET` is set in `.env.local`
2. ✅ Webhook URL in Clerk Dashboard matches your tunnel URL
3. ✅ Webhook events are enabled in Clerk Dashboard
4. ✅ Check server logs for error messages

---

## 🚢 Deployment

### Vercel (Recommended)

1. Push your code to GitHub/GitLab/Bitbucket
2. Import your repository in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

Vercel will automatically:
- Run `prisma generate` (via `postinstall` script)
- Run `prisma migrate deploy` (via build script)
- Build and deploy your application

### Environment Variables for Production

Ensure all environment variables are set in your deployment platform:

- Database connection string
- Clerk keys and secrets
- Stripe keys and webhook secrets
- UploadThing credentials
- Mux credentials
- Teacher ID (if applicable)

### Database Migrations

For production deployments:

```bash
npx prisma migrate deploy
```

This runs migrations without creating new ones (safe for production).

---

## 🎨 Design System

### Color Palette

The platform uses a custom color palette inspired by healthcare themes:

- **Munsell Blue**: `#0097b2` / `#0599b3` - Primary brand color
- **Pacific Blue**: `#25a5bc` - Secondary accent
- **Viking**: `#43b2c5` - Tertiary accent
- **Light Blue**: `#aadce5` - Light backgrounds
- **Brilliance**: `#fdfefe` - Background white
- **Ice Cold**: `#d5edf1` - Subtle backgrounds
- **Nicotine Gold**: `#ebb92b` - Accent color

These colors are configured in `tailwind.config.ts` as custom theme colors.

---

## 🐛 Contributing

This is a **private repository**. While we welcome bug reports and feedback, we are currently **not accepting pull requests or contributions** from external contributors.

### Reporting Bugs

If you encounter a bug or issue:

1. Check existing issues to see if it's already reported
2. Create a new issue with:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs. actual behavior
   - Environment details (OS, Node version, etc.)
   - Screenshots if applicable

### Development Guidelines

If you're working on this project internally:

- Follow TypeScript best practices
- Use ESLint for code quality
- Write clear commit messages
- Test changes thoroughly before committing
- Update documentation as needed

---

## 📄 License

This project is **private** and proprietary. All rights reserved.

---

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Authentication by [Clerk](https://clerk.com/)
- Payments by [Stripe](https://stripe.com/)
- Video hosting by [Mux](https://www.mux.com/)
- UI components by [Radix UI](https://www.radix-ui.com/)
- Icons by [Lucide](https://lucide.dev/)

---

## 📞 Support

For questions or support, please contact the development team or create an issue in this repository.

---

<div align="center">

**Made with ❤️ for healthcare education**

*"Nya Akomapa" — Have a good heart*

</div>
