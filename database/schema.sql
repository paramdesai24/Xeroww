-- =============================================================================
-- Xeroww — PostgreSQL Schema DDL
-- Version: 0.1.0
-- Status:  Reference only — not applied in V0 (Option B: no runtime DB)
-- =============================================================================
-- Run this script in V0.5 or V1 after configuring DATABASE_URL in .env
-- =============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Table: stocks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stocks (
    id           SERIAL       PRIMARY KEY,
    symbol       VARCHAR(20)  NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    exchange     VARCHAR(20)  NOT NULL DEFAULT 'NSE',
    sector       VARCHAR(100),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stocks_symbol ON stocks(symbol);

-- Seed initial watchlist
INSERT INTO stocks (symbol, display_name, exchange, sector) VALUES
    ('RELIANCE.NS', 'Reliance Industries',        'NSE', 'Energy / Conglomerates'),
    ('TCS.NS',      'Tata Consultancy Services',  'NSE', 'Information Technology'),
    ('INFY.NS',     'Infosys',                    'NSE', 'Information Technology'),
    ('HDFCBANK.NS', 'HDFC Bank',                  'NSE', 'Banking & Financial Services'),
    ('ICICIBANK.NS','ICICI Bank',                 'NSE', 'Banking & Financial Services')
ON CONFLICT (symbol) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Table: daily_candles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_candles (
    id         SERIAL       PRIMARY KEY,
    stock_id   INTEGER      NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    date       DATE         NOT NULL,
    open       NUMERIC(12,4) NOT NULL,
    high       NUMERIC(12,4) NOT NULL,
    low        NUMERIC(12,4) NOT NULL,
    close      NUMERIC(12,4) NOT NULL,
    volume     BIGINT       NOT NULL,
    fetched_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(stock_id, date)
);

CREATE INDEX IF NOT EXISTS idx_candles_stock_date ON daily_candles(stock_id, date DESC);

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
COMMENT ON TABLE  stocks        IS 'Xeroww tracked stock instruments (watchlist)';
COMMENT ON TABLE  daily_candles IS 'Daily OHLCV candle data fetched from MarketDataProvider';
COMMENT ON COLUMN daily_candles.fetched_at IS 'Timestamp when this row was written by the data pipeline';
