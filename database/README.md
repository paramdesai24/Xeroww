# Xeroww Database

## Current state

Xeroww persists users, watchlists, portfolios, alerts, journal entries, annotations, and optional market records through SQLAlchemy. Local development defaults to SQLite. Docker Compose uses PostgreSQL 16 with Psycopg 3.

Alembic is the schema authority. `database/schema.sql` is an incomplete historical reference and must not be used to initialize the application database.

## Local development

The default development configuration uses `sqlite:///./xeroww.db` and may create tables automatically when `AUTO_CREATE_TABLES=true`.

To exercise the migration path explicitly:

```bash
alembic upgrade head
alembic downgrade base
alembic upgrade head
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

If an existing database was created from the same SQLAlchemy metadata and already matches the baseline schema, back it up, verify the schema, and mark the baseline as applied:

```bash
alembic stamp head
```

Do not stamp a database whose schema has not been verified against the baseline migration.
