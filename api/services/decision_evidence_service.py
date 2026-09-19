"""Normalize deterministic analytics into inspectable decision evidence."""

from typing import Any


class DecisionEvidenceService:
    VERSION = "DECISION-EVIDENCE-V1"

    @staticmethod
    def _relationship(stance: str, direction: str) -> str:
        if stance == "unavailable":
            return "insufficient"
        if stance == "neutral" or direction == "NEUTRAL":
            return "contextual"
        return "aligned" if stance == direction.lower() else "conflicting"

    @classmethod
    def build(cls, *, direction: str, structure: dict[str, Any], fuzzy: dict[str, Any], data_quality: dict[str, Any]) -> dict[str, Any]:
        items: list[dict[str, Any]] = []

        def add(key: str, category: str, source: str, label: str, stance: str, explanation: str, value: Any = None) -> None:
            items.append({
                "key": key,
                "category": category,
                "source_engine": source,
                "label": label,
                "stance": stance,
                "relationship": cls._relationship(stance, direction),
                "explanation": explanation,
                "value": value,
                "algorithm_version": cls.VERSION,
            })

        regime = structure.get("market_regime") or {}
        regime_name = regime.get("regime", "UNAVAILABLE")
        regime_stance = "bullish" if regime_name == "TRENDING_UP" else "bearish" if regime_name == "TRENDING_DOWN" else "neutral"
        add("regime", "structure", "market_regime", regime_name, regime_stance, "; ".join(regime.get("reasons", [])) or "No regime explanation available.")

        alignment = structure.get("signal_alignment") or {}
        bias = alignment.get("dominant_bias", "UNAVAILABLE")
        alignment_stance = "bullish" if bias == "BULLISH_CONFLUENCE" else "bearish" if bias == "BEARISH_CONFLUENCE" else "neutral"
        add("signal_alignment", "confluence", "signal_alignment", bias, alignment_stance, alignment.get("factual_summary", "Signal alignment unavailable."), {
            "bullish": alignment.get("bullish_alignment_count"),
            "bearish": alignment.get("bearish_alignment_count"),
            "total": alignment.get("alignment_total"),
        })

        volume = structure.get("volume") or {}
        relationship = volume.get("price_volume_relationship", "UNAVAILABLE")
        volume_stance = "bullish" if relationship == "ACCUMULATION" else "bearish" if relationship == "DISTRIBUTION" else "neutral"
        add("volume", "volume", "volume", volume.get("volume_state", "UNAVAILABLE"), volume_stance, volume.get("explanation", "Volume evidence unavailable."), {"rvol": volume.get("rvol"), "relationship": relationship})

        averages = structure.get("moving_averages") or {}
        ema_rel = averages.get("ema9_ema20_relationship", "UNAVAILABLE")
        ma_stance = "bullish" if "ABOVE" in ema_rel or "BULL" in ema_rel else "bearish" if "BELOW" in ema_rel or "BEAR" in ema_rel else "neutral"
        add("moving_averages", "trend", "moving_averages", ema_rel, ma_stance, "Short and long moving-average relationships are retained independently in the snapshot.", {
            "price_vs_ema20": averages.get("price_vs_ema20"),
            "ema9_ema20": ema_rel,
            "sma50_sma200": averages.get("sma50_sma200_relationship"),
        })

        sr = structure.get("support_resistance") or {}
        support = sr.get("nearest_support")
        resistance = sr.get("nearest_resistance")
        add("support_proximity", "levels", "support_resistance", "SUPPORT_CONTEXT" if support else "UNAVAILABLE", "neutral" if support else "unavailable", "Nearest support is context for invalidation placement, not a standalone direction signal.", support)
        add("resistance_proximity", "levels", "support_resistance", "RESISTANCE_CONTEXT" if resistance else "UNAVAILABLE", "neutral" if resistance else "unavailable", "Nearest resistance is context for target feasibility, not a standalone direction signal.", resistance)

        patterns = structure.get("detected_patterns") or []
        if patterns:
            pattern = patterns[-1]
            stance = pattern.get("direction", "neutral")
            add("latest_pattern", "pattern", "pattern_engine", pattern.get("pattern", "UNKNOWN"), stance, pattern.get("explanation", "Pattern explanation unavailable."), pattern.get("context", {}))
        else:
            add("latest_pattern", "pattern", "pattern_engine", "NO_PATTERN", "neutral", "No qualifying recent pattern was detected.")

        for dimension in fuzzy.get("dimensions", []):
            name = str(dimension.get("name", "unknown"))
            label = str(dimension.get("label", "UNAVAILABLE"))
            upper = label.upper()
            if "BULL" in upper or upper in {"STRONG", "SURGING", "ELEVATED", "DOMINANT", "FIRM"}:
                stance = "bullish"
            elif "BEAR" in upper or upper in {"WEAK", "BROKEN"}:
                stance = "bearish"
            else:
                stance = "neutral"
            add(f"fuzzy_{name}", "fuzzy", f"fuzzy_{name}", label, stance, dimension.get("narrative", "Fuzzy narrative unavailable."), {"activation": dimension.get("activation"), "inputs": dimension.get("inputs", {})})

        quality_state = data_quality.get("state", "unavailable")
        add("data_quality", "quality", "market_data", quality_state.upper(), "unavailable" if quality_state in {"unavailable", "partial"} else "neutral", data_quality.get("note", "Data quality state unavailable."), data_quality)

        counts = {key: sum(1 for item in items if item["relationship"] == key) for key in ("aligned", "conflicting", "contextual", "insufficient")}
        if counts["insufficient"] > 0 and quality_state in {"unavailable", "partial"}:
            summary = "INSUFFICIENT_DATA"
        elif counts["aligned"] >= 4 and counts["conflicting"] <= 1:
            summary = "STRONG_ALIGNMENT"
        elif counts["aligned"] >= 2 and counts["aligned"] > counts["conflicting"]:
            summary = "PARTIAL_ALIGNMENT"
        elif counts["aligned"] >= 2 and counts["conflicting"] >= 2 or counts["aligned"] == counts["conflicting"] > 0:
            summary = "MIXED"
        else:
            summary = "WEAK_SUPPORT"

        return {
            "version": cls.VERSION,
            "summary": summary,
            "counts": counts,
            "items": items,
            "methodology_note": "The summary counts independent evidence relationships. It is not a probability, prediction, or recommendation.",
        }
