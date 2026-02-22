# Deployment: Vercel + Railway (Cheapest Stable Split)

## Target topology
- `api` on Railway (Strapi + custom finance APIs)
- `postgres` on Railway managed DB
- `web` on Vercel (Next.js)

This removes the extra always-on Railway web runtime cost while keeping backend close to DB.

## Live endpoints (current)
- Railway API: `https://api-production-54c4.up.railway.app`
- Vercel Web (public alias): `https://web-silk-chi-70.vercel.app`

## Railway services
- Keep: `api`, `Postgres`
- Optional cost cut: keep Railway `web` service undeployed (`railway down --service web --environment production --yes`)

## Railway API env vars (required)
Set these on Railway `api` service:
- `HOST=0.0.0.0`
- `PORT=1337`
- `NODE_ENV=production`
- `DATABASE_CLIENT=postgres`
- `DATABASE_HOST=postgres.railway.internal`
- `DATABASE_PORT=5432`
- `DATABASE_NAME=railway`
- `DATABASE_USERNAME=postgres`
- `DATABASE_PASSWORD=<railway postgres password>`
- `DATABASE_SSL=false`
- `APP_KEYS=<comma-separated-4-keys>`
- `API_TOKEN_SALT=<secret>`
- `ADMIN_JWT_SECRET=<secret>`
- `TRANSFER_TOKEN_SALT=<secret>`
- `JWT_SECRET=<secret>`
- `ENCRYPTION_KEY=<secret>`
- `CRON_SECRET=<secret>`
- `CORS_ORIGIN=https://web-silk-chi-70.vercel.app`
- `RATE_LIMIT_AUTH_MAX=10`
- `RATE_LIMIT_AUTH_WINDOW_MS=900000`
- `RATE_LIMIT_SLACK_MAX=120`
- `RATE_LIMIT_SLACK_WINDOW_MS=60000`

Finance seed:
- `FINANCE_AUTO_SEED=true`
- `FINANCE_WORKSPACE_NAME=TkTurners`
- `FINANCE_BASE_CURRENCY=USD`
- `FINANCE_TIMEZONE=UTC`
- `FINANCE_WEB_DEFAULT_STATUS=APPROVED`
- `FINANCE_SEED_ADMIN_EMAIL_1=<email>`
- `FINANCE_SEED_ADMIN_USERNAME_1=<username>`
- `FINANCE_SEED_ADMIN_PASSWORD_1=<strong-password>`
- `FINANCE_SEED_ADMIN_EMAIL_2=<email>`
- `FINANCE_SEED_ADMIN_USERNAME_2=<username>`
- `FINANCE_SEED_ADMIN_PASSWORD_2=<strong-password>`

## Vercel web env vars
Set on Vercel project (`production`, `preview`, `development`):
- `NEXT_PUBLIC_API_URL=https://api-production-54c4.up.railway.app/api`

## Deploy flow
1. API deploy (GitHub Actions on push to `main`):
   - Workflow: `/Users/bilal/dev/tkturners/tkturners-accounting/.github/workflows/deploy-railway.yml`
   - Requires GitHub secret: `RAILWAY_TOKEN`
2. Web deploy:
   - Vercel CLI from `/apps/web`: `vercel deploy --prod`
   - Recommended: connect Vercel project to GitHub for automatic deploys on push

## Health checks
- API health:
  - `GET https://api-production-54c4.up.railway.app/api/finance/health`
- CORS check:
  - `OPTIONS /api/auth/local` with `Origin: https://web-silk-chi-70.vercel.app` should return `access-control-allow-origin`

## Cron endpoint setup (Railway)
Use external scheduler/cron job:
- URL: `POST https://api-production-54c4.up.railway.app/api/finance/cron/subscriptions?auto_generate=false&workspace_id=1`
- Header: `x-cron-secret: <CRON_SECRET>`
