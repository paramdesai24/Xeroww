"""
api/services/forensic_service.py
────────────────────────────────
Candle Forensics & Data Provenance Service for Xeroww V0.6.

Principle:
"Click any candle. Open a forensic inspector showing OHLC, Body, Shadows,
ratios, Volume, RVOL, Pattern, Trend context, S/R context, MA relationship,
and Market Regime. Every analytics result should be explainable in terms of its source."

Data Provenance:
Exposes metadata:
  - source_provider: YahooFinanceProvider
  - symbol, timeframe, input_interval
  - calculation_window
  - calculation_timestamp
  - algorithm_version: e.g. FORENSIC-V1, EMA-V1, SWING-CLUSTER-V1
  - source_candle_range: {"start": ..., "end": ..., "bar_count": N}
Ready to map to Kafka topic, Spark job, or Iceberg snapshot in V1.
"""

from datetime import datetime, timezone
from typing import Any
from api.services.replay_service import ReplayEngine
from api.services.pattern_engine import extract_metrics, scan_patterns


class ProvenanceMetadata:
    """Encapsulates verifiable algorithmic and data lineage metadata."""

    @staticmethod
    def build(
        symbol: str,
        timeframe: str,
        algorithm_version: str,
        calculation_window: str,
        candles_used: list[dict[str, Any]],
        provider: str = "YahooFinanceProvider",
    ) -> dict[str, Any]:
        start_time = candles_used[0]["time"] if candles_used else None
        end_time = candles_used[-1]["time"] if candles_used else None
        return {
            "source_provider": provider,
            "symbol": symbol,
            "timeframe": timeframe,
            "input_interval": "1d",
            "calculation_window": calculation_window,
            "calculation_timestamp": datetime.now(timezone.utc).isoformat(),
            "algorithm_version": algorithm_version,
            "transport": "HTTP REST",
            "data_freshness_note": "Historical or delayed provider data; not a live exchange feed.",
            "source_candle_range": {
                "start": start_time,
                "end": end_time,
                "bar_count": len(candles_used),
            },
        }


class CandleForensicsService:
    """Dissects a single historical candle down to its deterministic components."""

    def __init__(
        self,
        symbol: str,
        all_candles: list[dict[str, Any]],
        provider_name: str = "ConfiguredMarketDataProvider",
    ):
        self.symbol = symbol
        self.all_candles = all_candles
        self.engine = ReplayEngine(symbol, all_candles)
        self.total_bars = len(all_candles)
        self.provider_name = provider_name

    def inspect_candle(self, timestamp: str) -> dict[str, Any]:
        """
        Inspect the candle at timestamp, evaluating all market structure
        measurements strictly using data available up to that timestamp.
        """
        match_idx = None
        for i, c in enumerate(self.all_candles):
            if c["time"] == timestamp:
                match_idx = i
                break

        if match_idx is None:
            # Fallback to latest bar
            match_idx = max(0, self.total_bars - 1)

        # Evaluate deterministic market state at this bar
        state = self.engine.evaluate_at_step(match_idx)
        candle = state["current_candle"]
        slice_candles = state["candles_slice"]

        if not candle:
            return {"error": "Candle not found"}

        # Geometric breakdown
        metrics = extract_metrics(candle, index=match_idx)
        body_size = round(metrics.body, 2)
        upper_shadow = round(metrics.upper_shadow, 2)
        lower_shadow = round(metrics.lower_shadow, 2)
        total_range = round(metrics.day_range, 2)
        body_ratio = round(metrics.body_ratio * 100, 2)
        upper_shadow_ratio = round(metrics.upper_shadow_ratio * 100, 2)
        lower_shadow_ratio = round(metrics.lower_shadow_ratio * 100, 2)

        # Detected pattern on this bar
        patterns = scan_patterns(slice_candles, lookback=1)
        active_pattern = patterns[-1].pattern if patterns else "None detected"

        # Volume context
        vol_info = state["volume"] or {}
        rvol = vol_info.get("rvol", 1.0)
        vol_state = vol_info.get("volume_state", "NORMAL")

        # S/R context
        sr_info = state["support_resistance"] or {}
        nearest_sup = sr_info.get("nearest_support")
        nearest_res = sr_info.get("nearest_resistance")

        # MA relationship
        ma_info = state["moving_averages"] or {}
        price_vs_ema20 = ma_info.get("price_vs_ema20", "UNKNOWN")
        ema_rel = ma_info.get("ema9_ema20_relationship", "UNKNOWN")

        # Market regime
        reg_info = state["market_regime"] or {}
        regime = reg_info.get("regime", "MIXED")

        # Build Data Provenance Record
        provenance = ProvenanceMetadata.build(
            symbol=self.symbol,
            timeframe="1d",
            algorithm_version="CANDLE-FORENSICS-V1",
            calculation_window=f"{len(slice_candles)} historical sessions",
            candles_used=slice_candles,
            provider=self.provider_name,
        )

        return {
            "symbol": self.symbol,
            "timestamp": candle["time"],
            "ohlc": {
                "open": candle["open"],
                "high": candle["high"],
                "low": candle["low"],
                "close": candle["close"],
                "day_range": total_range,
                "is_bullish": candle["close"] >= candle["open"],
            },
            "anatomy": {
                "body_size": body_size,
                "upper_shadow": upper_shadow,
                "lower_shadow": lower_shadow,
                "body_ratio_pct": body_ratio,
                "upper_shadow_ratio_pct": upper_shadow_ratio,
                "lower_shadow_ratio_pct": lower_shadow_ratio,
            },
            "volume_context": {
                "volume": candle.get("volume", 0),
                "baseline_volume": vol_info.get("baseline_avg_volume", 0),
                "rvol": rvol,
                "volume_state": vol_state,
                "relationship": vol_info.get("price_volume_relationship", "NEUTRAL"),
            },
            "pattern_context": {
                "pattern": active_pattern,
                "explanation": patterns[-1].explanation if patterns else "No standard single or multi-candle pattern satisfied strict criteria.",
            },
            "support_resistance_context": {
                "nearest_support": nearest_sup,
                "nearest_resistance": nearest_res,
                "active_zones_count": len(sr_info.get("support_zones", [])) + len(sr_info.get("resistance_zones", [])),
            },
            "moving_average_context": {
                "price_vs_ema20": price_vs_ema20,
                "ema9_ema20_relationship": ema_rel,
                "sma50_sma200_relationship": ma_info.get("sma50_sma200_relationship", "UNKNOWN"),
            },
            "regime_context": {
                "regime": regime,
                "reasons": reg_info.get("reasons", []),
            },
            "provenance": provenance,
        }
