# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development commands

This is a Next.js App Router project (TypeScript, React) bootstrapped with `create-next-app`.

Before running the app:
- Copy `env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `APP_PASSWORD`.
- Ensure your Supabase project has the schema from the `supabase-*.sql` files applied (see **Backend & database** below).

Primary commands (using `npm`, since `package-lock.json` is present):
- `npm run dev` – Start the Next.js dev server on port 3000.
- `npm run build` – Production build.
- `npm run start` – Run the production server (after `npm run build`).
- `npm run lint` – Run ESLint (Next.js core-web-vitals + TypeScript rules via `eslint.config.mjs`).

There are currently no test scripts defined in `package.json`.

## Backend & environment

### Supabase client and types

Centralized Supabase configuration and domain types live in `src/lib/supabase.ts`:
- Creates a Supabase client with `createClient` using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Defines core domain entities used across the app:
  - `HealthSystem`
  - `Opportunity` and `OpportunityStatus` (`prospect | active | won`), plus `OPPORTUNITY_STATUSES` for UI.
  - `Contact` (including `cadence_days` for outreach cadence).
  - `OutreachLog` (per-contact outreach events: date, method, notes).
  - `PRODUCTS` and `Product` – the set of ArubaCRM products that can be sold.

All pages that talk to the database import the shared `supabase` client and types from here.

### Database schema & migrations

Supabase schema and migrations are defined as SQL files in the repo root, e.g. `supabase-schema.sql` and `supabase-migration-*.sql`.
- These files are intended to be run in the Supabase SQL editor against your project.
- They define the tables backing the `HealthSystem`, `Opportunity`, `Contact`, and `OutreachLog` types and add indices/policies.

If you add new tables or columns that should be used in the app, extend the types in `src/lib/supabase.ts` alongside updating the SQL migrations.

### Authentication & middleware

Authentication is handled via a simple password gate controlled by `APP_PASSWORD`:
- API route `src/app/api/auth/route.ts` exposes:
  - `POST /api/auth` – accepts `{ password }`, compares to `process.env.APP_PASSWORD`, and on success sets an `auth_token` cookie (HTTP-only, 30 days).
  - `DELETE /api/auth` – clears the `auth_token` cookie (used for logout).
- Middleware in `src/middleware.ts` runs on every request except `/login` and `/api/auth*`:
  - Reads `auth_token` and `APP_PASSWORD`.
  - If the cookie is missing or does not match `APP_PASSWORD`, redirects to `/login`.

The login flow is implemented in `src/app/login/page.tsx`:
- A client component that posts the password to `/api/auth`.
- On success, redirects to `/` (which then redirects to `/todo`).

Any new routes added under `src/app` are automatically protected by this middleware configuration unless they are explicitly excluded.

## Frontend architecture

### Next.js app structure

- Root layout: `src/app/layout.tsx`
  - Sets global metadata (`ArubaCRM` title and description).
  - Loads Geist fonts and global styles (`src/app/globals.css`).
  - Wraps all pages in `AppShell` from `src/components/AppShell.tsx`.

- Root route: `src/app/page.tsx`
  - Immediately redirects `/` to `/todo` using `next/navigation`'s `redirect`.

- App router is organized under `src/app` by feature:
  - `/login` – password gate UI.
  - `/todo` – daily outreach to-do list (primary home view).
  - `/dashboard` – high-level metrics and activity summaries.
  - `/accounts` and `/accounts/[id]` – account (health system) management and per-account opportunities.
  - `/opportunities` and `/opportunities/[id]` – pipeline overview and per-opportunity contact/outreach management.
  - `/contacts` – cross-account contact list.
  - `/api/auth` – auth API route used by login/logout.

Most page components under `src/app` are client components (`'use client'`) because they use hooks and the browser-side Supabase client.

### Shell, navigation, and layout

- `src/components/AppShell.tsx`
  - Uses `usePathname` to decide whether to render the top navigation.
  - Hides navigation on `/login` so the login page is clean.

- `src/components/Navigation.tsx`
  - Defines the main navigation items (`/todo`, `/dashboard`, `/opportunities`, `/accounts`, `/contacts`).
  - Uses `usePathname` to highlight the active route and treat `/todo` as the default home.
  - Provides a logout button that calls `DELETE /api/auth` and redirects to `/login`.
  - Implements both desktop and mobile navigation with a slide-down mobile menu and backdrop.

- `src/components/Logo.tsx`
  - SVG logo component used in the nav and login screen.

- Global styling is done via Tailwind CSS v4-style `@import "tailwindcss";` and `@theme inline` in `src/app/globals.css`.
  - Components use Tailwind utility classes rather than separate CSS modules.

### Domain model and feature flows

The core domain is a lightweight CRM for health systems:

- **Accounts / Health Systems**
  - Represented by `HealthSystem` records.
  - Managed in `src/app/accounts/page.tsx`.
    - Lists health systems with counts of opportunities and contacts.
    - Allows creating, editing, and deleting health systems.
    - Deleting a health system cascades to related opportunities/contacts/outreach (via DB constraints/migrations).

- **Opportunities**
  - Represent potential sales of a specific `PRODUCT` into a `HealthSystem`.
  - Global list view: `src/app/opportunities/page.tsx`.
    - Fetches opportunities with joined `health_systems` and enriches with contact counts and last outreach date (derived from `OutreachLog`).
    - Supports filtering by `OpportunityStatus` (`prospect`, `active`, `won`).
    - Groups opportunities by account for display.
  - Account-specific view: `src/app/accounts/[id]/page.tsx`.
    - For a single health system, shows all its opportunities and the contacts tied to each.
    - Allows adding/removing opportunities for specific `PRODUCTS` on that account.
  - Opportunity detail view: `src/app/opportunities/[id]/page.tsx`.
    - Shows a single opportunity with its contacts.
    - Allows adding/editing/deleting contacts.
    - Allows changing the opportunity `status` via a dropdown backed by `OPPORTUNITY_STATUSES`.
    - Integrates outreach logging and history (see below).

- **Contacts**
  - Represent individual people at health systems, usually attached to an opportunity.
  - Global contacts list: `src/app/contacts/page.tsx`.
    - Fetches contacts, health systems, and opportunities; materializes `ContactWithDetails` to render by account.
    - Deleting a contact removes its outreach history.
  - Opportunity detail page (`src/app/opportunities/[id]/page.tsx`) provides the main CRUD UI for contacts on a single opportunity, including fields like `cadence_days`.

- **Outreach logs & history**
  - `OutreachLog` records track each email or call.
  - `src/components/ContactHistoryModal.tsx` shows per-contact outreach history.
    - Fetches logs for a contact from Supabase.
    - Renders a modal with entries (date, method, notes) and supports deleting individual logs.
  - Both the to-do page and opportunity detail page share the pattern of logging outreach by inserting rows into `outreach_logs`.

### Daily to-do and dashboard logic

Two pages coordinate the core outreach workflow using shared business-day and cadence logic:

- **Daily To-Do** (`src/app/todo/page.tsx`)
  - Only considers opportunities in `prospect` status (or missing status for backward compatibility).
  - For each contact, computes:
    - The last outreach date (if any) from `OutreachLog`.
    - A due date using `cadence_days` and business days only.
    - Whether the contact is overdue and how many business days overdue.
  - Groups contacts into:
    - Today’s due items (including rollovers from prior business days).
    - Next-business-day items (used for weekend/"everything done" summaries).
  - Has three main views:
    - Non-business days (weekends): shows a "no activities due" state and next business day summary.
    - Business day with no due contacts: shows an "all activities completed" message plus upcoming summary.
    - Regular day with due contacts: renders a card per contact with context (account, opportunity, last outreach, cadence) and actions.
  - For each due contact, allows the user to:
    - Toggle `Emailed` and/or `Called`.
    - Optionally add notes.
    - Submit, which inserts one or two `OutreachLog` rows and refreshes the list.
  - Uses `ContactHistoryModal` to display outreach history for a contact.

- **Dashboard** (`src/app/dashboard/page.tsx`)
  - Aggregates stats across opportunities, accounts, contacts, and outreach logs:
    - Counts of opportunities by status.
    - Total accounts and contacts.
    - Contacts due today vs overdue (using the same prospect-only and business-day logic).
    - Outreach this week, broken down by emails vs calls.
    - Current outreach streak in consecutive business days with any activity.
    - Recent activity list based on latest `OutreachLog` entries.
  - Provides high-level visual summaries complementing the granular to-do list.

## TypeScript & project configuration

- `tsconfig.json` configures strict TypeScript with `moduleResolution: "bundler"` and a path alias:
  - `@/*` → `./src/*` (use `@/lib/supabase`, `@/components/...`, etc. rather than relative paths).
- `eslint.config.mjs` composes `eslint-config-next`'s `core-web-vitals` and `typescript` presets and customizes ignore patterns for build artifacts.
- `next.config.ts` currently uses the default `NextConfig` shape and is the place to add future Next.js configuration.
- `postcss.config.mjs` wires Tailwind via `@tailwindcss/postcss`.

When adding new code, follow the existing patterns:
- Place new routes under `src/app/...` using the App Router convention.
- Share Supabase access and domain types through `src/lib/supabase.ts`.
- Reuse layout primitives (`AppShell`, `Navigation`, `ContactHistoryModal`) where appropriate so navigation, auth, and outreach flows stay consistent.
