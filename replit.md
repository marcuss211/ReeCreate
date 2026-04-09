# Instagram Reels Control Panel

## Overview

Production-ready full-stack Instagram Reels Tracking & Control Panel — an internal ops tool for admins to track daily reels submissions from users.

**Two roles:**
- **Admin**: manage users, accounts, approve/reject reports, monitor delays, watch wallet changes
- **User**: submit daily reels links per Instagram account, view history, manage USDT TRC20 wallet address

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Charts**: Recharts

## Packages

- `artifacts/api-server` — Express API backend (port 8080)
- `artifacts/reels-panel` — React frontend (port from `$PORT`)
- `lib/api-client-react` — Auto-generated TanStack Query hooks from OpenAPI spec
- `lib/api-spec` — OpenAPI specification (30+ endpoints)
- `lib/api-zod` — Zod validation schemas from OpenAPI spec
- `lib/db` — Drizzle ORM schema + database client

## Database Schema (7 tables)

- `users` — user accounts (id, name, username, password_hash, role, status, personnel_no)
- `instagram_accounts` — Instagram accounts assigned to users
- `daily_reports` — per-user per-day report (draft → submitted → approved/rejected)
- `report_items` — individual reel URLs within a report
- `wallet_addresses` — USDT TRC20 addresses per user (status: active/replaced/flagged)
- `wallet_address_logs` — change history for wallet addresses (security audit)
- `audit_logs` — all system actions logged
- `delay_flags` — detected submission delay and bulk-entry flags per user/date

## Test Credentials

- Admin: `admin` / `admin123`
- Users: `ahmet`, `mehmet`, `ayse` / `password123`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run build` — build API server + seed script
- `pnpm --filter @workspace/api-server run seed` — reseed database with correct password hashes
- `pnpm --filter @workspace/api-client-react exec tsc -p tsconfig.json` — rebuild type declarations

## Frontend Pages

### Admin
- `/admin/dashboard` — stats cards + 14-day activity bar chart
- `/admin/review` — review/approve/reject daily reports by date
- `/admin/users` — full CRUD: create, edit, toggle status, reset password
- `/admin/accounts` — manage Instagram accounts, assign to users
- `/admin/monitoring` — delay & bulk entry detection per user
- `/admin/wallets` — USDT TRC20 wallet change monitoring
- `/admin/audit` — full audit log
- `/admin/export` — CSV/Excel export of daily reports by date

### User
- `/dashboard` — today's status, missing days, assigned accounts, admin notes
- `/entry` — submit reels URLs per account per day (draft → submit)
- `/history` — past report history with admin notes
- `/cekim` — USDT TRC20 wallet address management with change history

## API Highlights

- JWT auth in `Authorization: Bearer` header, stored in `localStorage["auth_token"]`
- POST `/api/daily-reports` — idempotent create-or-return-existing for a given date
- `/api/dashboard/summary` — admin stats
- `/api/dashboard/user-summary` — user-facing stats
- `/api/dashboard/daily-activity` — 14-day chart data
- `/api/delay-flags/behavior-summary` — per-user behavior classification
- `/api/export/daily-report?date=&format=csv|xlsx` — export

## Notes

- Personnel number range: 300–2000
- Wallet validation: TRC20 regex `/^T[1-9A-HJ-NP-Za-km-z]{33}$/`
- Reels URL normalization: normalizes to `https://www.instagram.com/reel/{id}/`
- The `api-client-react` dist declarations must be regenerated after codegen changes: `cd lib/api-client-react && pnpm exec tsc -p tsconfig.json`
