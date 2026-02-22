# Railway Deployment

## Services
- `api`: deploy from `/apps/api` using root repo context.
- `web`: deploy from `/apps/web` using root repo context.
- `postgres`: Railway managed PostgreSQL.

## API env vars
Set all values from `/Users/bilal/dev/tkturners/tkturners-accounting/.env.example` API section.
Required for production hardening:
- `CRON_SECRET`
- `FINANCE_SEED_ADMIN_PASSWORD_1`
- `FINANCE_SEED_ADMIN_PASSWORD_2`
- `RATE_LIMIT_AUTH_MAX`
- `RATE_LIMIT_AUTH_WINDOW_MS`
- `RATE_LIMIT_SLACK_MAX`
- `RATE_LIMIT_SLACK_WINDOW_MS`

## Web env vars
- `NEXT_PUBLIC_API_URL=https://<api-domain>/api`

## Build/start commands
- API build: `yarn workspace api build`
- API start: `yarn workspace api start`
- Web build: `yarn workspace web build`
- Web start: `yarn workspace web start`

## Cron for subscriptions check
Create Railway cron hitting:
`POST https://<api-domain>/api/finance/cron/subscriptions?auto_generate=false&workspace_id=1`

Header:
- `x-cron-secret: <CRON_SECRET>`

## GitHub auto-deploy
This repository includes `/Users/bilal/dev/tkturners/tkturners-accounting/.github/workflows/deploy-railway.yml`.

Required one-time setup in GitHub repository settings:
- Add secret `RAILWAY_TOKEN` (Project token with deploy access).

Deploy trigger:
- Every push to `main` deploys `api` and `web` services to Railway project `7bd08fab-9004-4386-9729-aad653f7fabc` environment `production`.
