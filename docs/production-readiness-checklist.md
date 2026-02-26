# Production Readiness Checklist

Last reviewed: 2026-02-23

## 1. Build, test, quality gates
- [x] `yarn lint` passes in monorepo.
- [x] API unit/integration tests pass (`yarn workspace api test`).
- [x] Web tests pass (`yarn workspace web test`).
- [x] Parser and shared tests pass (`yarn test`).
- [ ] Add CI-required status checks on GitHub branch protection.

## 2. Security and access control
- [x] Email/password auth enabled via Strapi local auth.
- [x] Workspace membership + role guard (`ADMIN`, `ACCOUNTANT`, `VIEWER`) enforced in finance controllers.
- [x] Slack signature verification implemented before Slack command/event processing.
- [x] Auth and Slack rate limiting middleware enabled.
- [ ] Add periodic JWT secret rotation runbook.
- [ ] Add security headers verification in production (CSP/HSTS policy check).

## 3. Data integrity and bookkeeping
- [x] Finance amounts stored as minor units (integer).
- [x] Transfer invariants and cross-currency validation are enforced.
- [x] Payroll and loan linkage writes metadata for traceability.
- [x] Idempotency keys implemented for high-risk write actions.
- [x] Audit logs + approval records appended for create/update/delete/approve/reject flows.
- [ ] Add DB backup restore drill checklist to docs (not just backup config).

## 4. Product workflows
- [x] Accounts, categories, counterparties CRUD available.
- [x] Transactions CRUD + approval flow available.
- [x] Subscriptions CRUD + generate-on-click available.
- [x] Payroll runs (create/generate/approve/pay) available.
- [x] Employee loans (create/disburse/repay) available.
- [x] Reports + CSV exports available.
- [ ] Add end-to-end smoke script for "create -> approve/pay -> report" flows.

## 5. Deployment and operations
- [x] API deployed on Railway.
- [x] Web deployed on Vercel.
- [x] API health endpoint reachable.
- [x] Railway Postgres service attached.
- [ ] Configure alerting for failed API deploys and failing health checks.
- [ ] Add automatic migration verification step in deploy pipeline.

## 6. Pre-launch go/no-go
- [ ] Seed staging with realistic data and run acceptance checklist.
- [ ] Verify Slack production app credentials and webhook URLs.
- [ ] Validate monthly close report output with real historical sample.
- [ ] Perform one rollback drill (web + API) and document exact steps.
