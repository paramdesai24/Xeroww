"""Build authoritative point-in-time decision snapshots."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status

from api.analytics.orchestrator import AnalyticsOrchestrator, default_orchestrator
from api.fuzzy.orchestrator import FuzzyOrchestrator, default_fuzzy_orchestrator
from api.services.decision_evidence_service import DecisionEvidenceService
from api.services.market_data_service import MarketDataService


class DecisionSnapshotService:
    SCHEMA_VERSION = 1

    def __init__(
        self,
        market_data: MarketDataService,
        analytics: AnalyticsOrchestrator = default_orchestrator,
        fuzzy: FuzzyOrchestrator = default_fuzzy_orchestrator,
    ):
        self.market_data = market_data
        self.analytics = analytics
        self.fuzzy = fuzzy

    @staticmethod
    def _date_key(value: Any) -> str:
        return str(value or "")[:10]

    @staticmethod
    def _canonical_hash(payload: dict[str, Any]) -> str:
        encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str, ensure_ascii=True)
        return hashlib.sha256(encoded.encode("utf-8")).hexdigest()

    def build(
        self,
        *,
        symbol: str,
        direction: str,
        source_context: str,
        as_of: str | None = None,
        period: str = "1y",
    ) -> dict[str, Any]:
        normalized, candles = self.market_data.get_candles(symbol, period=period, interval="1d")
        eligible = candles
        requested_as_of = self._date_key(as_of) if as_of else None
        if requested_as_of:
            eligible = [c for c in candles if self._date_key(c.get("time")) <= requested_as_of]
            if not eligible:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={"code": "INSUFFICIENT_MARKET_DATA", "message": "No candle exists at or before the requested decision time."},
                )
        if not eligible:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={"code": "MARKET_DATA_UNAVAILABLE", "message": "No market candles are available for this decision."},
            )

        return self._assemble(
            normalized=normalized,
            eligible=eligible,
            direction=direction,
            source_context=source_context,
            requested_as_of=requested_as_of,
            period=period,
            timeframe="1d",
            include_quote=source_context.upper() != "REPLAY",
        )

    def build_from_candles(
        self,
        *,
        symbol: str,
        candles: list[dict[str, Any]],
        direction: str,
        as_of: str,
        timeframe: str,
        period: str,
    ) -> dict[str, Any]:
        """Build a replay snapshot from a server-owned, already-truncated candle slice."""
        if not candles:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "INSUFFICIENT_MARKET_DATA", "message": "The replay session has no visible candles."},
            )
        resolved_as_of = self._date_key(candles[-1].get("time"))
        if resolved_as_of != self._date_key(as_of):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "REPLAY_VERSION_CONFLICT", "message": "The replay cursor changed. Reload the session."},
            )
        return self._assemble(
            normalized=symbol,
            eligible=candles,
            direction=direction,
            source_context="REPLAY",
            requested_as_of=resolved_as_of,
            period=period,
            timeframe=timeframe,
            include_quote=False,
        )

    def _assemble(
        self,
        *,
        normalized: str,
        eligible: list[dict[str, Any]],
        direction: str,
        source_context: str,
        requested_as_of: str | None,
        period: str,
        timeframe: str,
        include_quote: bool,
    ) -> dict[str, Any]:
        summary = self.analytics.run_market_structure_summary(eligible, normalized).to_dict()
        fuzzy_report = self.fuzzy.explain(candles=eligible, symbol=normalized).to_dict()
        resolved_as_of = self._date_key(eligible[-1].get("time"))
        quote_context = None
        quality_state = "delayed"
        quality_note = "Historical or delayed provider data; not a live exchange feed."
        if include_quote:
            try:
                quote_context = self.market_data.get_quote(normalized)
            except Exception:
                quality_state = "partial"
                quality_note = "Candle analytics are available, but quote context could not be captured."

        provider = type(getattr(self.market_data, "provider", self.market_data)).__name__
        data_quality = {"state": quality_state, "note": quality_note}
        evidence = DecisionEvidenceService.build(
            direction=direction.upper(), structure=summary, fuzzy=fuzzy_report, data_quality=data_quality
        )
        analytical_payload = {
            "metadata": {
                "schema_version": self.SCHEMA_VERSION,
                "requested_source": source_context.upper(),
                "requested_as_of": requested_as_of,
                "resolved_as_of": resolved_as_of,
                "timeframe": timeframe,
                "period": period,
                "provider": provider,
                "transport": "HTTP REST",
                "source_candle_range": {
                    "start": self._date_key(eligible[0].get("time")),
                    "end": resolved_as_of,
                },
                "bar_count": len(eligible),
                "algorithm_versions": {
                    "snapshot": "DECISION-SNAPSHOT-V1",
                    "evidence": DecisionEvidenceService.VERSION,
                    "fuzzy": "MAMDANI-FIS-V1",
                },
                "data_quality": data_quality,
            },
            "market": {"current_candle": eligible[-1], "quote_context": quote_context},
            "structure": summary,
            "fuzzy": fuzzy_report,
            "evidence": evidence,
        }
        hash_payload = {
            **analytical_payload,
            "market": {"current_candle": analytical_payload["market"]["current_candle"]},
            "fuzzy": {
                key: value
                for key, value in fuzzy_report.items()
                if key not in {"computed_at", "computation_ms"}
            },
        }
        snapshot_hash = self._canonical_hash(hash_payload)
        snapshot = {
            **analytical_payload,
            "metadata": {
                **analytical_payload["metadata"],
                "captured_at": datetime.now(timezone.utc).isoformat(),
                "snapshot_hash": snapshot_hash,
            },
        }
        return {"snapshot": snapshot, "snapshot_hash": snapshot_hash, "resolved_as_of": resolved_as_of}
