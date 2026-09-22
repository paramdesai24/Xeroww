"""Build a leak-safe visible state for a persisted replay session."""

from typing import Any

from api.services.replay_service import ReplayEngine


class ReplaySessionStateService:
    VERSION = "REPLAY-STATE-V1"

    @staticmethod
    def build(session, *, active_decision_id: int | None, position: dict[str, Any]) -> dict[str, Any]:
        candles = list(session.dataset_payload or [])
        working = candles[session.warmup_start_index : session.end_index + 1]
        engine = ReplayEngine(session.symbol, working)
        evaluated = engine.evaluate_at_step(session.current_index - session.warmup_start_index)
        visible = candles[session.start_index : session.current_index + 1]
        compact = ReplaySessionStateService._compact_evidence(evaluated)
        status_value = getattr(session.status, "value", session.status)
        symbol_hidden = bool(session.hide_symbol and status_value not in {"COMPLETED", "ABANDONED"})
        date_hidden = bool(session.hide_calendar_date and status_value not in {"COMPLETED", "ABANDONED"})
        return {
            "id": session.id,
            "status": status_value,
            "symbol": "HIDDEN" if symbol_hidden else session.symbol,
            "symbol_hidden": symbol_hidden,
            "calendar_date_hidden": date_hidden,
            "timeframe": session.timeframe,
            "setup_category": session.setup_category,
            "starting_capital": session.starting_capital,
            "current_cash": session.current_cash,
            "maximum_risk_pct": session.maximum_risk_pct,
            "current_index": session.current_index,
            "visible_step": session.current_index - session.start_index,
            "total_session_steps": session.end_index - session.start_index + 1,
            "remaining_bars": max(0, session.end_index - session.current_index),
            "current_market_time": session.current_market_time,
            "version": session.version,
            "decision_required": status_value == "AWAITING_DECISION",
            "active_decision_id": active_decision_id,
            "position": position,
            "candles": visible,
            "analytics": {
                "moving_averages": evaluated.get("moving_averages"),
                "support_resistance": evaluated.get("support_resistance"),
                "volume": evaluated.get("volume"),
                "market_regime": evaluated.get("market_regime"),
                "signal_alignment": evaluated.get("signal_alignment"),
                "pattern": evaluated.get("pattern"),
            },
            "compact_evidence": compact,
            "provenance": {
                "analytics_version": ReplaySessionStateService.VERSION,
                "dataset_fingerprint": session.dataset_fingerprint,
                "warmup_bars": session.start_index - session.warmup_start_index,
                "visible_bars": len(visible),
                "future_values_exposed": False,
            },
        }

    @staticmethod
    def _compact_evidence(evaluated: dict[str, Any]) -> list[dict[str, Any]]:
        regime = evaluated.get("market_regime") or {}
        alignment = evaluated.get("signal_alignment") or {}
        volume = evaluated.get("volume") or {}
        pattern = evaluated.get("pattern") or {}
        items = [
            {
                "key": "regime",
                "label": str(regime.get("regime", "Unavailable")),
                "explanation": "Current point-in-time market regime",
            },
            {
                "key": "alignment",
                "label": str(alignment.get("alignment", alignment.get("state", "Unavailable"))),
                "explanation": "Trend and structure agreement",
            },
            {
                "key": "volume",
                "label": str(volume.get("volume_state", volume.get("state", "Unavailable"))),
                "explanation": "Participation relative to baseline",
            },
        ]
        if pattern:
            items[-1] = {
                "key": "pattern",
                "label": str(pattern.get("pattern", "Pattern")),
                "explanation": "Latest eligible candle pattern",
            }
        return items
