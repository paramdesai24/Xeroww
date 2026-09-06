"""
tests/test_signal_alignment.py
──────────────────────────────
Deterministic unit tests for Signal Alignment Confluence & Contextual Pattern Enrichment.
"""

import pytest
from api.services.signal_alignment_service import evaluate_signal_alignment
from api.services.contextual_pattern_service import enrich_pattern_with_context
from api.services.pattern_engine import PatternDetection


def _bar(c, v=1000.0, t="2026-01-01"):
    return {
        "time": t,
        "open": c - 1.0,
        "high": c + 2.0,
        "low": c - 2.0,
        "close": c,
        "volume": v,
    }


class TestSignalAlignment:
    def test_alignment_count_structure(self):
        # 25 upward trending bars
        candles = [_bar(100.0 + (i * 2.0), v=1500.0, t=f"d{i}") for i in range(25)]
        result = evaluate_signal_alignment(candles, symbol="ALIGNED.NS")

        assert result.alignment_total == 6
        assert result.bullish_alignment_count >= 3
        assert len(result.conditions) == 12  # 6 bullish + 6 bearish
        assert result.dominant_bias in ("BULLISH_CONFLUENCE", "NEUTRAL_MIXED")
        assert "prediction" in result.methodology_note.lower()

    def test_insufficient_candles(self):
        result = evaluate_signal_alignment([_bar(100.0)], symbol="FEW")
        assert result.bullish_alignment_count == 0
        assert result.dominant_bias == "NEUTRAL_MIXED"


class TestContextualPatternEnrichment:
    def test_enriches_pattern_with_sr_and_volume(self):
        candles = [_bar(100.0 + (i * 1.0), v=1200.0, t=f"d{i}") for i in range(25)]
        raw_pattern = PatternDetection(
            pattern="Hammer",
            direction="bullish",
            candle_index=24,
            timestamp="d24",
            body_ratio=0.2,
            upper_shadow_ratio=0.05,
            lower_shadow_ratio=0.75,
            category="reversal",
            explanation="Hammer detected.",
            context={"stop_loss": 120.0},
        )

        enriched = enrich_pattern_with_context(raw_pattern, candles, symbol="ENRICH.NS")
        assert enriched.pattern == "Hammer"
        assert enriched.direction == "bullish"
        assert enriched.current_price == 124.0
        assert enriched.rvol > 0.0
        assert enriched.market_regime is not None
        assert "Hammer formed" in enriched.context_summary
