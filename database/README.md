# Database — Xeroww

## V0 Status: No Database Required

Xeroww V0 uses **Option B** — all data is fetched live from Yahoo Finance.  
No PostgreSQL instance is required to run the backend.

SQLAlchemy ORM models are defined in `api/models/stock.py` as a **schema contract** for V1.

---

## V0.5 / V1 — Enabling PostgreSQL

When you are ready to introduce persistence:

### 1. Create the database

```bash
psql -U postgres
CREATE DATABASE xeroww;
\q
```

### 2. Apply the schema

```bash
psql -U postgres -d xeroww -f database/schema.sql
```

### 3. Configure the connection

Copy `.env.example` to `.env` and set:

```
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/xeroww
```

### 4. In `api/main.py`, add to the lifespan startup block:

```python
from api.database.session import engine, Base
if engine:
    Base.metadata.create_all(engine)
```

---

## Migration Path

| Version | Database Layer |
|---------|---------------|
| V0      | None — yfinance live fetch |
| V0.5    | PostgreSQL — store fetched candles |
| V1      | PostgreSQL + Kafka consumer writes candles |
| V2+     | Snowflake (analytical queries) |
