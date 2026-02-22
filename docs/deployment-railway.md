# Railway Deployment

## Services
- `api`: deploy from `/apps/api` using root repo context.
- `web`: deploy from `/apps/web` using root repo context.
- `postgres`: Railway managed PostgreSQL.

## API env vars
Set all values from `/Users/bilal/dev/tkturners/tkturners-accounting/.env.example` API section.

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
