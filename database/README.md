# Xeroww Database

## Current state

Xeroww persists users, watchlists, portfolios, alerts, decision tickets, decision amendments, replay sessions, replay events, replay executions, replay results, portfolio snapshots, portfolio snapshot holdings, risk policies, annotations, and optional market records through SQLAlchemy. Local development defaults to SQLite. Docker Compose uses PostgreSQL 16 with Psycopg 3.

The Decision Workbench evolves the existing `decision_journal_entries` table into the canonical decision-ticket store and adds `decision_ticket_amendments`. Ticket fields and captured evidence are immutable after submission. Notes, target changes, invalidation changes, and lifecycle transitions are appended as separate amendment rows.

The Replay and Behaviour Lab links replay decisions to a durable replay session and append-only replay event sequence. Portfolio Intelligence stores each portfolio valuation as an immutable header plus normalized holding rows. Formula outputs reference the snapshot and version used for calculation.

Alembic is the schema authority. `database/schema.sql` is an incomplete historical reference and must not be used to initialize the application database.

## Local development

The default development configuration uses `sqlite:///./xeroww.db`. Run migrations before starting the API. Automatic table creation is disabled by default and should be enabled only for disposable local databases because it can create tables ahead of Alembic.

From the repository root, apply and inspect the migration state:

```bash
alembic upgrade head
alembic current
```

## PostgreSQL

Set a Psycopg URL and disable runtime schema creation:

```text
DATABASE_URL=postgresql+psycopg://xeroww:password@localhost:5432/xeroww
AUTO_CREATE_TABLES=false
```

Then apply migrations before starting the API:

```bash
alembic upgrade head
```

Docker Compose performs this sequence through its one-shot `migrate` service. The backend starts only after that service succeeds.

## Adopting an existing database

If an existing pre-Alembic database already matches the baseline schema, back it up, verify it, stamp the baseline revision, and then run the remaining migrations:

```bash
alembic stamp 9e47b354fec1
alembic upgrade head
```

Do not stamp a database whose schema has not been verified against the baseline migration.
