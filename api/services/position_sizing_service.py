"""Deterministic, explainable position sizing for cash-equity entry plans."""

from decimal import Decimal, ROUND_FLOOR, ROUND_HALF_UP
from typing import Any


MONEY = Decimal("0.01")
PRICE = Decimal("0.0001")


class PositionSizingError(ValueError):
    pass


class PositionSizingService:
    VERSION = "POSITION-SIZING-V1"

    @staticmethod
    def _d(value: Any) -> Decimal:
        return Decimal(str(value))

    @classmethod
    def calculate(
        cls,
        *,
        intent: str,
        capital_base: Any | None,
        entry_zone_low: Any | None,
        entry_zone_high: Any | None,
        invalidation_price: Any | None,
        target_zone_low: Any | None,
        max_risk_pct: Any | None,
        max_allocation_pct: Any | None = None,
        available_cash: Any | None = None,
    ) -> dict[str, Any]:
        if intent.upper() not in {"ENTER", "ADD"}:
            return {
                "applicable": False,
                "formula_version": cls.VERSION,
                "reason": "Position sizing applies only to ENTER and ADD cash-equity plans.",
                "warnings": [],
            }

        required = {
            "capital_base": capital_base,
            "entry_zone_low": entry_zone_low,
            "entry_zone_high": entry_zone_high,
            "invalidation_price": invalidation_price,
            "target_zone_low": target_zone_low,
            "max_risk_pct": max_risk_pct,
        }
        missing = [name for name, value in required.items() if value is None]
        if missing:
            return {
                "applicable": True,
                "complete": False,
                "formula_version": cls.VERSION,
                "reason": f"Missing inputs: {', '.join(missing)}.",
                "warnings": [],
            }

        capital = cls._d(capital_base)
        low = cls._d(entry_zone_low)
        high = cls._d(entry_zone_high)
        invalidation = cls._d(invalidation_price)
        target = cls._d(target_zone_low)
        risk_pct = cls._d(max_risk_pct)
        allocation_pct = cls._d(max_allocation_pct) if max_allocation_pct is not None else None
        cash = cls._d(available_cash) if available_cash is not None else None

        if min(capital, low, high, invalidation, target, risk_pct) <= 0:
            raise PositionSizingError("Capital, prices, and risk percentage must be positive.")
        if low > high:
            raise PositionSizingError("Entry zone low cannot exceed entry zone high.")
        if invalidation >= low:
            raise PositionSizingError("Invalidation must be below the entry zone for a bullish entry plan.")
        if target <= high:
            raise PositionSizingError("Target must be above the entry zone for a bullish entry plan.")
        if risk_pct > Decimal("5"):
            raise PositionSizingError("Maximum risk percentage cannot exceed 5 percent.")
        if allocation_pct is not None and not Decimal("0") < allocation_pct <= Decimal("100"):
            raise PositionSizingError("Maximum allocation percentage must be between 0 and 100.")

        planned_entry = high
        risk_per_share = planned_entry - invalidation
        reward_per_share = target - planned_entry
        max_risk_amount = capital * risk_pct / Decimal("100")
        risk_quantity = (max_risk_amount / risk_per_share).to_integral_value(rounding=ROUND_FLOOR)

        limits: dict[str, Decimal] = {"RISK": risk_quantity}
        if cash is not None:
            if cash < 0:
                raise PositionSizingError("Available cash cannot be negative.")
            limits["CASH"] = (cash / planned_entry).to_integral_value(rounding=ROUND_FLOOR)
        if allocation_pct is not None:
            allocation_amount = capital * allocation_pct / Decimal("100")
            limits["ALLOCATION"] = (allocation_amount / planned_entry).to_integral_value(rounding=ROUND_FLOOR)

        limiting_factor, quantity = min(limits.items(), key=lambda item: item[1])
        capital_deployed = quantity * planned_entry
        potential_loss = quantity * risk_per_share
        potential_reward = quantity * reward_per_share
        rr = reward_per_share / risk_per_share
        warnings: list[str] = []
        if quantity <= 0:
            warnings.append("The configured risk and capital constraints allow zero shares.")
        if rr < Decimal("1"):
            warnings.append("The conservative reward-to-risk ratio is below 1.0.")

        def money(value: Decimal) -> float:
            return float(value.quantize(MONEY, rounding=ROUND_HALF_UP))

        return {
            "applicable": True,
            "complete": True,
            "formula_version": cls.VERSION,
            "rounding_policy": "Quantities round down to whole shares; money rounds half-up to paise.",
            "inputs": {
                "capital_base": money(capital),
                "entry_zone_low": float(low.quantize(PRICE)),
                "entry_zone_high": float(high.quantize(PRICE)),
                "invalidation_price": float(invalidation.quantize(PRICE)),
                "target_zone_low": float(target.quantize(PRICE)),
                "max_risk_pct": float(risk_pct),
                "max_allocation_pct": float(allocation_pct) if allocation_pct is not None else None,
                "available_cash": money(cash) if cash is not None else None,
            },
            "planned_entry_price": money(planned_entry),
            "risk_per_share": money(risk_per_share),
            "reward_per_share": money(reward_per_share),
            "maximum_risk_amount": money(max_risk_amount),
            "recommended_quantity": int(quantity),
            "capital_deployed": money(capital_deployed),
            "potential_loss": money(potential_loss),
            "potential_reward": money(potential_reward),
            "reward_to_risk": float(rr.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "limiting_factor": limiting_factor,
            "quantity_limits": {key.lower(): int(value) for key, value in limits.items()},
            "warnings": warnings,
        }
