"""
schemas/ohlc.py
───────────────
Pydantic response schemas for the /ohlc endpoint.
Candle format is compatible with TradingView Lightweight Charts time-series API.
"""

from pydantic import BaseModel, Field
from typing import List


class OHLCBar(BaseModel):
    """
    A single OHLCV candlestick bar.
    The `time` field uses ISO date string format (YYYY-MM-DD)
    for direct compatibility with TradingView Lightweight Charts.
    """
    time: str = Field(..., description="Candle date in YYYY-MM-DD format (TradingView compatible)")
    chart_time: int | None = Field(default=None, description="UTC Unix timestamp for intraday chart bars")
    open: float = Field(..., description="Opening price")
    high: float = Field(..., description="Session high price")
    low: float = Field(..., description="Session low price")
    close: float = Field(..., description="Closing price")
    volume: int = Field(..., description="Session trading volume")

    model_config = {"from_attributes": True}


class OHLCResponse(BaseModel):
    symbol: str = Field(..., description="Stock ticker symbol")
    display_name: str = Field(..., description="Human-readable company name")
    period: str = Field(..., description="Data period (e.g., '1mo')")
    interval: str = Field(..., description="Candle interval (e.g., '1d')")
    candles: List[OHLCBar] = Field(..., description="Ordered list of OHLCV candles (oldest → newest)")
    data_note: str = Field(
        default="Near real-time data — Yahoo Finance delayed feed",
        description="Data freshness disclaimer"
    )

    model_config = {"from_attributes": True}
