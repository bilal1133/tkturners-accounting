# TkTurners Finance Ops MVP

Private internal finance operations app for founders.

## Stack
- Frontend: Next.js (App Router)
- Backend: Strapi 5 custom finance APIs
- Database: PostgreSQL
- Parsing: deterministic Slack parser (`packages/parser`)

## Monorepo Layout
- `/Users/bilal/dev/tkturners/tkturners-accounting/apps/web`
- `/Users/bilal/dev/tkturners/tkturners-accounting/apps/api`
- `/Users/bilal/dev/tkturners/tkturners-accounting/packages/shared-types`
- `/Users/bilal/dev/tkturners/tkturners-accounting/packages/parser`
- `/Users/bilal/dev/tkturners/tkturners-accounting/docker`
- `/Users/bilal/dev/tkturners/tkturners-accounting/docs`

## Features Implemented
- Manual accounts CRUD + account running ledger.
- Transactions CRUD for income/expense/transfer.
- Transfer invariants and cross-currency constraints.
- Transfer fee tracking (creates a linked expense entry and keeps approvals/deletes in sync).
- Subscriptions CRUD + generate-on-click.
- Custom category management from web Settings (create/delete non-system categories).
- Monthly reports: summary, expense breakdown, cashflow, account balances.
- Employee payroll module: employee master, monthly payroll runs, entry-level edits, approve/pay workflow, linked salary postings.
- Payroll payouts support same-account, same-currency, and cross-currency funding (e.g., USD -> PKR) with FX rate, transfer fee, and additional fee tracking linked to each payroll entry.
- Employee loan module: disbursement via receivable control transfer, repayment tracking (manual + payroll deductions), schedule carry-forward.
- Employee timeline: linked salary sent dates, loans, repayments, and finance transactions.
- Payroll and loan reports + CSV exports.
- CSV exports for transactions and monthly summaries.
- Slack ingestion endpoints (`/money`, channel listener, interactions) with confirm/edit/cancel flow.
- Pending review queue and approve/reject actions.
- Immutable audit log + approval records.
- Workspace settings (base currency, timezone, defaults).

## Strapi Data Model
- Finance domain entities are registered as Strapi content-types and stored in PostgreSQL `finance_*` tables.
- Content Manager shows finance collections (accounts, currencies, categories, transactions, subscriptions, approvals, audit logs, Slack drafts, tags, notes, attachments, workspace entities).

## Local Setup
1. Copy env samples:
- `cp .env.example .env`
- `cp apps/api/.env.example apps/api/.env`
- `cp apps/web/.env.example apps/web/.env.local`

2. Install dependencies:
- `yarn install`

3. Run Postgres (local or docker):
- `docker compose -f docker/docker-compose.yml up -d postgres`

4. Start API:
- `yarn dev:api`

5. Start Web:
- `yarn dev:web`

6. Login with seeded users:
- `bilal@tkturners.com / ChangeMe123!`
- `cofounder@tkturners.com / ChangeMe123!`

## Commands
- `yarn test` (parser + reporting unit tests)
- `yarn workspace api seed` (re-run migrations + seed)
- `yarn build`

## Slack Setup
See `/Users/bilal/dev/tkturners/tkturners-accounting/docs/slack-setup.md`.

## Deployment
See `/Users/bilal/dev/tkturners/tkturners-accounting/docs/deployment-railway.md`.
