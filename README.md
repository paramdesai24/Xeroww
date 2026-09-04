# Xeroww

> A distributed financial analytics platform — built in evolutionary versions.

**Xeroww V0** is the Market Terminal: an Indian stock market dashboard powered by Yahoo Finance (near real-time, delayed), FastAPI, and a React terminal interface with TradingView Lightweight Charts.

---

## Architecture

```text
                    Yahoo Finance API
                    (near real-time — 15–20 min delay)
                           │
                           ▼
              YahooFinanceProvider
              (implements MarketDataProvider ABC)
                           │
                           ▼
                       FastAPI
              ┌────────────┼────────────┐
              ▼            ▼            ▼
          /stocks      /ohlc      /patterns
          /quote       /health
                           │
                           ▼
                   React Dashboard
           (Vite + TypeScript + Tailwind)
           TradingView Lightweight Charts
```

### Evolution Path

| Version | Data Layer |
|---------|-----------|
| **V0** (current) | Yahoo Finance → FastAPI → React |
| **V1** | Yahoo Finance → **Kafka** → FastAPI → React |
| **V2** | Yahoo Finance → Kafka → **Spark** → FastAPI → React |
| **V3** | Yahoo Finance → Kafka → Spark → **Snowflake** → FastAPI → React |

The `MarketDataProvider` abstract interface in `api/services/market_provider.py` is the architectural contract that enables this evolution without rewriting routes or frontend code.

---

## Project Structure

```text
xeroww/
├── api/                     ← FastAPI backend
│   ├── main.py              ← Entry point (uvicorn)
│   ├── requirements.txt
│   ├── routes/              ← HTTP endpoint handlers
│   ├── services/            ← Business logic + provider abstraction
│   │   ├── market_provider.py   ← Abstract Base Class (the key interface)
│   │   ├── yahoo_provider.py    ← yfinance implementation
│   │   └── pattern_service.py   ← Marubozu detection engine
│   ├── models/              ← SQLAlchemy ORM models (V1 readiness)
│   ├── schemas/             ← Pydantic request/response models
│   └── database/            ← Session factory (no runtime DB in V0)
├── dashboard/               ← React + Vite + TypeScript frontend
│   └── src/
│       ├── api/             ← Typed API client
│       ├── components/      ← Navbar, Sidebar, ChartPanel, OHLCStats, PatternCard
│       ├── hooks/           ← useMarketData
│       └── types/           ← TypeScript interfaces
├── database/                ← PostgreSQL schema DDL (V1 reference)
├── docs/                    ← Architecture + Varsity pattern reference
└── README.md
```

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- Internet access (Yahoo Finance API)

No database required for V0.

---

## Running the Backend

```powershell
cd api

# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn main:app --reload --port 8000
```

API will be available at:
- **Docs**: http://localhost:8000/docs
- **Health**: http://localhost:8000/health

### API Endpoints

| Endpoint | Description |
|---|---|
| `GET /health` | Service health check |
| `GET /stocks` | Watchlist (RELIANCE, TCS, INFY, HDFCBANK, ICICIBANK) |
| `GET /quote/{symbol}` | Latest market quote |
| `GET /ohlc/{symbol}` | 1-month OHLCV candles (TradingView format) |
| `GET /patterns/{symbol}` | Marubozu detection + Varsity trade setup |

---

## Running the Frontend

```powershell
cd dashboard

# Install dependencies
npm install

# Start development server
npm run dev
```

Dashboard will be available at: **http://localhost:5173**

Make sure the FastAPI backend is running first (`http://localhost:8000`).

---

## Candle Pattern Detection

Xeroww detects **Marubozu** patterns using Zerodha Varsity textbook rules:

- **Bullish Marubozu**: Strong buying, open ≈ low, close ≈ high, shadows < 2% of body
- **Bearish Marubozu**: Strong selling, open ≈ high, close ≈ low

The API returns:
- Pattern classification
- Signal date
- Varsity textbook action: `watch_next_session_for_confirmation`
- Stop-loss level
- Latest Candle Summary (body %, direction, range %)

See [`docs/varsity_patterns.md`](docs/varsity_patterns.md) for full pattern documentation.

---

## Architecture Notes

- `api/services/market_provider.py` contains the `MarketDataProvider` ABC — **do not bypass this interface in routes**
- `api/services/yahoo_provider.py` is the **only file** that imports `yfinance`
- All routes depend on the abstract provider, not the concrete implementation
- SQLAlchemy models in `api/models/` define schema for V1 persistence (no DB writes in V0)

---

## License

MIT — Xeroww is an open-source learning project.
