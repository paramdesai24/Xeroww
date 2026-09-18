# Xeroww Architecture V0.8

## Overview

Xeroww V0.8 is built around a strict **provider abstraction** pattern.
No route, service, or frontend component directly imports `yfinance`.
This boundary allows a future provider implementation to be introduced without changing route contracts. Kafka, Spark, and Snowflake are roadmap concepts, not active runtime components.

---

## V0.8 Data Flow

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
| HTTP Layer | `routes/` | FastAPI routers | Unchanged |
| Persistence | `models/` + `database/` | SQLAlchemy with SQLite or PostgreSQL and Alembic migrations | Scale and retention work as required |
| Frontend | `dashboard/src/` | React + TV Charts | Unchanged |
