# Dental Lab CRM

A full-featured lab management system built with Next.js 14, Prisma, and PostgreSQL. Manages cases, invoices, technician workflows, dental accounts, and optional Shopify order integration.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: NextAuth.js (credentials + JWT)
- **UI**: Tailwind CSS (dark theme)
- **Validation**: Zod
- **Deployment**: Vercel

## Prerequisites

- Node.js 18+
- PostgreSQL database (e.g. [Neon](https://neon.tech), [Supabase](https://supabase.com), [Railway](https://railway.app))

## Setup

1. **Clone and install dependencies**

   ```bash
   git clone <repo-url>
   cd dental-lab-crm
   npm install
   ```

2. **Configure environment variables**

   Copy `.env.example` to `.env.local` and fill in the values:

   ```bash
   cp .env.example .env.local
   ```

3. **Run database migrations**

   ```bash
   npx prisma migrate deploy
   ```

4. **Seed the database** with demo accounts, a default admin user, service products, and workflow templates:

   ```bash
   npm run seed
   ```

5. **Start the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Log in with the seeded admin credentials printed by the seed script.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (`postgresql://user:pass@host/db?sslmode=require`) |
| `NEXTAUTH_URL` | Yes | Full public URL of the app (e.g. `https://your-app.vercel.app`) |
| `NEXTAUTH_SECRET` | Yes | Random secret — generate with `openssl rand -base64 32` |
| `SHOPIFY_STORE_URL` | No | Shopify store URL (e.g. `https://store.myshopify.com`) |
| `SHOPIFY_ADMIN_TOKEN` | No | Shopify Admin API token (`shpat_...`) |
| `SHOPIFY_WEBHOOK_SECRET` | No | HMAC secret for validating Shopify webhooks |
| `SHOPIFY_DEFAULT_ACCOUNT_ID` | No | Dental account ID to assign imported Shopify orders |

## Seeding the Database

The seed script (`prisma/seed.ts`) creates:

- A default admin user (`admin@dentallab.com` / `Admin1234!`)
- Sample dental accounts and doctors
- Service product catalog (crowns, implants, veneers, etc.)
- Default workflow step templates by department

Run it any time against a fresh or existing database:

```bash
npm run seed
```

## Deployment (Vercel)

1. Push to GitHub and connect the repo to Vercel.
2. Add all environment variables from the table above in the Vercel project settings.
3. Vercel runs `npx prisma migrate deploy && next build` automatically on each deploy (configured in `vercel.json`).

## Project Structure

```
src/
  app/
    api/          # Next.js API routes (cases, invoices, accounts, technicians, …)
    cases/        # Case list + new case form
    tech/         # Technician mobile workspace
    technicians/  # Technician management
    …
  lib/
    prisma.ts     # Global Prisma singleton (prevents connection exhaustion on serverless)
    auth.ts       # NextAuth configuration
    constants.ts  # Shared enums and color maps
    utils.ts      # cn(), formatCurrency(), formatDate()
    shopify.ts    # Shopify API helpers
  server/
    services/     # Business logic (case creation, invoice allocation, Shopify import, …)
prisma/
  schema.prisma   # Database schema
  migrations/     # SQL migration history
  seed.ts         # Database seed script
```

## Key Features

- **Case management** — create, track, and audit cases through configurable workflow steps
- **Technician portal** — mobile-optimized workspace with start/complete/release step actions
- **Invoicing** — standard, credit, and remake invoice types with payment tracking
- **Shopify integration** — sync and import orders as cases; fulfill orders on ship
- **Dispatch board** — logistics and shipping status tracking
- **Accounting exports** — CSV exports for invoices, payments, and customers
- **Role-based access** — ADMIN, STAFF, TECHNICIAN, DOCTOR roles via NextAuth
