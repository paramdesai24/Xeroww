# Private Beta Release Gate Implementation Plan

## Objective

Make every push and pull request prove that the existing Xeroww application passes backend and frontend quality checks, applies its full migration chain to a clean PostgreSQL database, builds the production containers, starts the real Docker Compose stack, and responds through both direct service ports and the Nginx edge proxy.

This work changes delivery validation only. It does not add product features or alter runtime architecture.

## Current state

The workflow has three jobs:

- Backend quality installs Python dependencies, runs Ruff, and runs the backend tests with SQLite.
- Frontend quality installs Node dependencies, runs TypeScript checking, and builds the frontend.
- Docker validation checks the Compose file and builds the backend and frontend images independently.

The current workflow does not run frontend tests, does not run frontend lint, does not start Docker Compose, does not prove that migrations apply to PostgreSQL, and does not perform smoke requests against built services.

## Architecture

Retain three CI jobs so independent backend and frontend checks run in parallel:

```text
backend-quality ----+
                    +--> deployment-gate
frontend-quality ---+
```

The deployment gate will reuse `docker-compose.yml`. It will not reproduce service definitions inside GitHub Actions. Compose will create PostgreSQL and Redis, wait for their health checks, run the existing one-shot Alembic migration container, start the backend, build and start the frontend, and expose the application through Nginx.

## Files to change

- `.github/workflows/ci.yml`
- `docs/plans/private-beta-release-gate-plan.md`

No application modules, API routes, database models, migrations, Dockerfiles, or Compose service definitions should change unless validation exposes a release-blocking defect that cannot be addressed in CI.

## Jobs and commands

### Backend quality

Use the existing Python installation and dependency process.

Run separate named steps for:

1. Ruff backend lint.
2. The complete pytest suite under `api/tests`.

Tests retain their isolated SQLite configuration and elevated test rate limits. PostgreSQL migration validation belongs to the deployment gate and must not replace the existing test suite.

### Frontend quality

Use `npm ci` and the existing package scripts.

Run separate named steps for:

1. `npm run test:run`.
2. `npm run lint`.
3. TypeScript project checking with `npx tsc -b --pretty false`.
4. `npm run build` for the production Vite output.

The build script also performs TypeScript compilation, but the explicit TypeScript step gives a distinct failure boundary as requested. No test is skipped or weakened.

### Deployment gate

Depend on successful backend and frontend jobs.

Steps:

1. Validate the Compose configuration.
2. Remove any stale project containers, networks, and volumes.
3. Start the existing full Compose stack with production builds and health waiting enabled.
4. Inspect the migration container and require a successful exit.
5. Run `alembic current` inside the built backend container and require the applied revision to be the migration head.
6. Display Compose service state for diagnostic clarity.
7. Smoke-check the backend health endpoint directly.
8. Smoke-check the frontend container directly.
9. Smoke-check the application through Nginx.
10. Smoke-check the proxied API health endpoint, stock catalogue endpoint, and metrics endpoint.
11. On failure, print service state and recent logs.
12. Always remove containers, networks, and named volumes.

## Data and control flow

```text
GitHub runner
  -> docker compose up --build
  -> PostgreSQL health check
  -> migration container runs alembic upgrade head
  -> Redis health check
  -> backend health check
  -> frontend health check
  -> Nginx health check
  -> migration-head assertion
  -> direct and proxied HTTP smoke requests
  -> diagnostics on failure
  -> unconditional docker compose down with volumes
```

## Interfaces and APIs

The smoke test will use stable existing interfaces:

- Backend `GET /health`
- Backend `GET /stocks`
- Backend `GET /metrics`
- Frontend root document
- Nginx root document
- Nginx `GET /api/health`
- Nginx `GET /api/stocks`
- Nginx `GET /metrics`

No Yahoo quote or OHLC endpoint will be used as a release gate because external market-provider availability is outside the deterministic build and deployment contract. The stock catalogue still exercises the real built FastAPI service without requiring an external provider request.

## Dependencies

- GitHub hosted Ubuntu runner with Docker and Docker Compose.
- Existing PostgreSQL and Redis images declared in Compose.
- Existing backend and frontend Dockerfiles.
- Existing Alembic configuration and migration container.
- Existing service health checks.
- `curl`, available on the hosted runner.

No new application or package dependency is required.

## Edge cases

- A stale local or runner resource must not make the database non-disposable. Run Compose teardown with volumes before startup.
- A migration container may exit successfully before other services start. Verify its exit code and the live database revision separately.
- A service may be running but not healthy. Use Compose health waiting and HTTP requests with bounded retries.
- A smoke request may race with Nginx startup. Use retries with connection-refused handling.
- A failed startup may hide its cause. Print service state and recent logs only on failure.
- Cleanup must run even if configuration validation, image build, migration, startup, or smoke checks fail.
- Market-provider network instability must not make the deployment gate flaky.

## Error handling

Each validation concern receives a distinct workflow step name so the GitHub Actions UI identifies the failing stage. Shell commands use strict failure behavior. HTTP requests use `curl --fail` with bounded retries. Migration checks fail if the migration container does not exit successfully or if `alembic current` does not report the head revision.

Failure diagnostics will include `docker compose ps --all` and recent logs from all services. Cleanup uses `if: always()` so temporary state does not survive the job.

## Performance considerations

- Backend and frontend quality jobs remain parallel.
- The deployment gate starts only after both quality jobs pass, avoiding expensive image builds for already-invalid commits.
- Compose builds both application images once and then uses those same images for smoke testing.
- Docker layer caching on hosted runners is not introduced in this change because it would add configuration beyond the release-gate requirement.
- Smoke requests target deterministic local endpoints and use bounded waits.

## Testing considerations

Local validation should include, where the environment permits:

1. Workflow YAML parsing or structural inspection.
2. Backend Ruff command.
3. Complete backend pytest suite.
4. Frontend tests.
5. Frontend lint.
6. TypeScript project checking.
7. Production frontend build.
8. `docker compose config --quiet`.
9. Clean Compose startup with builds and health waiting.
10. Migration-container exit and migration-head verification.
11. Direct and proxied HTTP smoke requests.
12. Compose teardown with named-volume removal.

## Step-by-step implementation

1. Preserve the current workflow triggers and concurrency behavior.
2. Keep backend lint and complete backend tests as separate named steps.
3. Add frontend test and lint steps before TypeScript checking and build.
4. Replace the image-only Docker job with a deployment gate that depends on both quality jobs.
5. Validate Compose before starting services.
6. Add clean pre-start teardown for disposable state.
7. Start the full stack with `docker compose up --detach --build --wait` and a bounded timeout.
8. Assert migration success and current migration head.
9. Add direct and proxied smoke requests with clear step labels.
10. Add failure-only Docker diagnostics.
11. Add unconditional cleanup with volume removal.
12. Run all feasible checks locally.
13. Review the final diff for application behavior changes, duplicated configuration, skipped tests, and cleanup coverage.
