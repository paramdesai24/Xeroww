from decimal import Decimal

import pytest

from api.services.position_sizing_service import PositionSizingError, PositionSizingService


def test_position_sizing_uses_conservative_entry_and_smallest_limit():
    result = PositionSizingService.calculate(
        intent="ENTER",
        capital_base=100000,
        entry_zone_low=98,
        entry_zone_high=100,
        invalidation_price=95,
        target_zone_low=110,
        max_risk_pct=1,
        max_allocation_pct=20,
        available_cash=15000,
    )

    assert result["complete"] is True
    assert result["planned_entry_price"] == 100.0
    assert result["risk_per_share"] == 5.0
    assert result["reward_to_risk"] == 2.0
    assert result["recommended_quantity"] == 150
    assert result["limiting_factor"] == "CASH"


def test_position_sizing_is_not_applicable_to_watch_decision():
    result = PositionSizingService.calculate(
        intent="WATCH",
        capital_base=None,
        entry_zone_low=None,
        entry_zone_high=None,
        invalidation_price=None,
        target_zone_low=None,
        max_risk_pct=None,
    )
    assert result["applicable"] is False


def test_position_sizing_rejects_invalidation_inside_entry_zone():
    with pytest.raises(PositionSizingError):
        PositionSizingService.calculate(
            intent="ENTER",
            capital_base=Decimal("100000"),
            entry_zone_low=98,
            entry_zone_high=100,
            invalidation_price=99,
            target_zone_low=110,
            max_risk_pct=1,
        )
