# Xeroww Architecture V0.9

## Overview

Xeroww V0.9 combines a strict **provider abstraction** with an immutable Decision Workbench.
No route, service, or frontend component directly imports `yfinance`.
This boundary allows a future provider implementation to be introduced without changing route contracts. Kafka, Spark, and Snowflake are roadmap concepts, not active runtime components.

Decision tickets are user-owned records. Their market evidence is captured by the server from a single point-in-time candle slice, hashed for reproducibility, and never overwritten. Later changes are stored as append-only amendments.

The market provider exposes a centralized NIFTY 50 constituent catalogue. Decision forms consume that catalogue through `/stocks` and rank local prefix and contains matches without issuing a network request for every keystroke.

---

## V0.9 Data Flow

```text
                    ┌─────────────────────────┐
                    │   Yahoo Finance API      │
                    │   (Delayed, ~15-20 min)  │
                    └───────────┬─────────────┘
                                │  yfinance library
                                ▼
                    ┌─────────────────────────┐
                    │  YahooFinanceProvider    │
                    │  (implements             │
                    │   MarketDataProvider)    │
                    └───────────┬─────────────┘
                                │  Abstract interface
                                ▼
                    ┌─────────────────────────┐
                    │       FastAPI            │
                    │                         │
                    │  GET /health            │
                    │  GET /stocks            │
                    │  GET /quote/{symbol}    │
                    │  GET /ohlc/{symbol}     │
                    │  GET /patterns/{symbol} │
                    └───────────┬─────────────┘
                                │  JSON over HTTP
                                ▼
                    ┌─────────────────────────┐
                    │    React Dashboard       │
                    │    (Vite + TypeScript)  │
                    │                         │
                    │  Sidebar (Watchlist)    │
                    │  ChartPanel (TV Charts) │
                    │  OHLCStats Card         │
                    │  PatternCard (Marubozu) │
                    └─────────────────────────┘
```

## Decision Workbench Flow

```text
Market or Replay page
        |
        | symbol, source context, optional replay timestamp
        v
Decision draft page -> POST /decisions/preview
        |                       |
        |                       v
        |              Evidence snapshot + risk calculation
        v
POST /decisions -> immutable ticket + snapshot hash
        |
        v
Decision detail page -> append-only amendments and status events
```

The server reconstructs replay evidence only from bars at or before the requested timestamp. Live quote context is excluded from replay snapshots to prevent look-ahead leakage.

---

## Future Evolution

### V1 — Kafka Integration
```text
Yahoo Finance → Kafka Producer → Kafka Topic (market.ohlc)
                                      │
                                      ▼
                              KafkaMarketProvider
                              (implements MarketDataProvider)
                                      │
                                      ▼
                                  FastAPI  →  React
```
This is a target design. A production migration would also require transport configuration, operational telemetry, failure handling, and integration tests.

### V2 — Spark Processing
```text
Kafka Topic → Spark Streaming → Processed OHLC + Signals
                                      │
                                      ▼
                              SparkMarketProvider
                              (implements MarketDataProvider)
```

### V3 - Lakehouse Analytics
```text
Spark -> Iceberg/Parquet -> AnalyticalMarketProvider -> FastAPI -> React
```

---

## Module Boundaries

| Layer | Module | V0 Implementation | V1+ Replacement |
|---|---|---|---|
| Data Fetch | `yahoo_provider.py` | yfinance | KafkaMarketProvider |
| API Contract | `market_provider.py` | ABC, unchanged | ABC, unchanged |
| Business Logic | `pattern_service.py` | Marubozu engine | Unchanged |
| Decision Logic | `decision_service.py` + snapshot/evidence/risk services | Immutable tickets and append-only amendments | Event consumers and richer portfolio intelligence |
| HTTP Layer | `routes/` | FastAPI routers | Unchanged |
| Persistence | `models/` + `database/` | SQLAlchemy with SQLite or PostgreSQL and Alembic migrations | Scale and retention work as required |
| Frontend | `dashboard/src/` | React + TV Charts | Unchanged |
