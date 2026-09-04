# Xeroww Architecture — V0

## Overview

Xeroww V0 is built around a strict **provider abstraction** pattern.
No route, service, or frontend component directly imports `yfinance`.
This single decision enables the evolution from Yahoo Finance to Kafka + Spark + Snowflake
without rewriting any upstream code.

---

## V0 Data Flow

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
**Only `api/services/yahoo_provider.py` is replaced.**
Routes, schemas, and frontend are **unchanged**.

### V2 — Spark Processing
```text
Kafka Topic → Spark Streaming → Processed OHLC + Signals
                                      │
                                      ▼
                              SparkMarketProvider
                              (implements MarketDataProvider)
```

### V3 — Snowflake Analytics
```text
Spark → Snowflake → SnowflakeMarketProvider → FastAPI → React
```

---

## Module Boundaries

| Layer | Module | V0 Implementation | V1+ Replacement |
|---|---|---|---|
| Data Fetch | `yahoo_provider.py` | yfinance | KafkaMarketProvider |
| API Contract | `market_provider.py` | ABC — unchanged | ABC — unchanged |
| Business Logic | `pattern_service.py` | Marubozu engine | Unchanged |
| HTTP Layer | `routes/` | FastAPI routers | Unchanged |
| Persistence | `models/` + `database/` | Schema only | SQLAlchemy + PostgreSQL |
| Frontend | `dashboard/src/` | React + TV Charts | Unchanged |
