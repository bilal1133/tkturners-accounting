# TkTurners Accounting

Internal accounting system for [TkTurners](https://tkturners.com): a Strapi API for the books and a React dashboard for the team, plus a Slack command for quick financial lookups.

## What's inside

| Folder | Stack | Purpose |
| --- | --- | --- |
| [`api/`](api) | Strapi 5, PostgreSQL, TypeScript | Data model and REST API |
| [`dashboard/`](dashboard) | React 19, Vite, TypeScript, React Hook Form, Zod | Web UI for accounts, contacts, projects and transactions |

**Data model (`api/src/api`):** accounts, categories, contacts, currencies, transactions, projects, loans, payroll, employee Slack links and a financial-query audit log.

## Getting started

### API

```bash
cd api
cp .env.example .env   # fill in the Strapi secrets and database settings
npm install
npm run develop        # admin panel at http://localhost:1337/admin
```

A Dockerfile for Railway lives in `api/docker/`.

### Dashboard

```bash
cd dashboard
npm install
npm run dev
```

## Slack financial self-service

The API can answer a Slack slash command (default `/financials`). It is off by default; see [`api/README.md`](api/README.md) for the environment variables (`SLACK_FINANCIALS_ENABLED`, `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN`, `SLACK_ALLOWED_TEAM_ID`, `SLACK_COMMAND_NAME`).

## Security

Never commit `.env` files or real financial data. Queries made through Slack are recorded in the financial-query audit log.
