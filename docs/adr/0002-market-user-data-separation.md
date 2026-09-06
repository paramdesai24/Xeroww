# ADR 0002: Separation of Market Data and User State

## Status
Accepted

## Context
Xeroww processes two distinct classes of data:
1. Public Market Data: Ephemeral and immutable time-series events (ticks, candles, quotes, volume profiles).
2. Private User State: Highly sensitive, relational, transactional state (user accounts, watchlists, portfolio holdings, decision journals, chart annotations, price alerts).

Mixing these concerns within identical database tables or storage tiers degrades performance, complicates database scaling, introduces authorization vulnerabilities, and violates tenant isolation principles.

## Decision
We enforce a strict physical and logical boundary between Market Data and User Data:
- User Data is persisted in PostgreSQL (or SQLite during lightweight local development) under strict relational foreign key constraints and user ownership checks (`user_id = current_user.id`).
- Market Data is treated as read-only, cachable time series. It is retrieved via the provider boundary and cached in Redis with strict TTL policies.
- At no point are market price feeds persisted into the relational user database tables.
- Route handlers enforce authorization and tenant ownership at the service layer before any user-owned mutation or query occurs.

## Consequences
### Positive
- Prevents cross-tenant data leakage and authorization tampering (OWASP BOLA/IDOR protection).
- Relational schema remains clean, small, and easily backuppable without bloating from millions of time-series ticks.
- Paves the way for V1.0 architecture where market data streams flow into columnar time-series storage (Apache Iceberg / ClickHouse) while relational state stays in PostgreSQL.

### Negative
- Joining user transactions with historical market quotes requires application-level coordination rather than single SQL joins.
