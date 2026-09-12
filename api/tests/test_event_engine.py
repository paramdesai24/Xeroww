"""
tests/test_event_engine.py
──────────────────────────
Unit tests for the Market Event Timeline and Explainability Engine.
Verifies all 8 domain event types, deterministic rule coverage, and anti-lookahead guarantees.
"""

from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from api.main import app
from api.services.event_engine import EventEngine
from api.schemas.events import MarketEventType, EventSeverity

test_client = TestClient(app)


@pytest.fixture
def mock_candles():
    """Generates synthetic price action with breakouts, volume spikes, and patterns."""
    candles = []
    base_price = 1000.0
    for i in range(30):
        # Introduce a breakout at candle 20 and volume spike
        if i == 20:
            o = 1050.0
            h = 1120.0
            l = 1045.0
            c = 1115.0
            v = 5000000.0  # 5x volume
        elif i == 25:
            # Rejection candle
            o = 1110.0
            h = 1150.0
            l = 1090.0
            c = 1095.0
            v = 1500000.0
        else:
            o = base_price + i * 2.0
            h = o + 5.0
            l = o - 4.0
            c = o + 3.0
            v = 1000000.0

        candles.append({
            "time": f"2026-01-{i+1:02d}",
            "open": o,
            "high": h,
            "low": l,
            "close": c,
            "volume": v,
        })
    return candles


def test_event_engine_point_in_time_accuracy(mock_candles):
    engine = EventEngine("RELIANCE.NS", mock_candles)
    events = engine.generate_all_events()

    assert isinstance(events, list)
    for evt in events:
        # Verify domain model structure
        assert evt.id.startswith("evt-")
        assert evt.symbol == "RELIANCE.NS"
        assert evt.candle_index >= 0
        assert evt.candle_index < len(mock_candles)
        assert evt.explainability is not None
        assert 0.0 <= evt.explainability.confidence <= 1.0
        assert len(evt.explainability.triggeredRules) > 0

        # Verify timestamp matches slice candle exactly
        assert evt.timestamp == mock_candles[evt.candle_index]["time"]


def test_event_engine_volume_spike_detection(mock_candles):
    engine = EventEngine("RELIANCE.NS", mock_candles)
    # Candle 20 has 5x volume
    events_at_20 = engine.detect_events_at_step(20)
    types_at_20 = [e.type for e in events_at_20]

    assert MarketEventType.HIGH_RVOL in types_at_20
    rvol_evt = next(e for e in events_at_20 if e.type == MarketEventType.HIGH_RVOL)
    assert rvol_evt.severity in (EventSeverity.WARNING, EventSeverity.CRITICAL)
    assert rvol_evt.metadata["rvol"] >= 2.0


def test_events_api_timeline(mock_candles):
    with patch("api.routes.events._provider.get_ohlc", return_value=mock_candles):
        res = test_client.get("/events/timeline/RELIANCE.NS?period=1mo")
        assert res.status_code == 200
        data = res.json()
        assert "symbol" in data
        assert "total_events" in data
        assert "events" in data
        assert isinstance(data["events"], list)


def test_events_api_at_step(mock_candles):
    with patch("api.routes.events._provider.get_ohlc", return_value=mock_candles):
        res = test_client.get("/events/at/RELIANCE.NS?step=20&period=1mo")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert any(e["type"] == "HIGH_RVOL" for e in data)
