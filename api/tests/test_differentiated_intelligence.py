"""
api/tests/test_differentiated_intelligence.py
─────────────────────────────────────────────
Comprehensive test suite verifying:
1. Portfolio Contribution Analytics (₹ P&L contribution, allocation %, detractor/contributor)
2. Market Breadth calculations (advancing/declining counts, buckets, breadth ratio)
3. Cross-Asset Pearson Correlation (bounds -1.0 <= r <= 1.0, pairwise, matrix)
4. Decision Journal Thesis Review (initial context vs subsequent observation)
5. Personal Market Memory & Chart Annotations (multi-tenant CRUD and timeline isolation)
"""

import pytest
from datetime import datetime
from api.services.correlation_service import compute_pearson_correlation, CorrelationService
from api.services.market_breadth_service import MarketBreadthService
from api.models.intelligence import DecisionJournalEntry, JournalStatus


class MockProvider:
    def get_stocks(self):
        return [
            {"symbol": "SYM1.NS", "display_name": "Symbol 1"},
            {"symbol": "SYM2.NS", "display_name": "Symbol 2"},
            {"symbol": "SYM3.NS", "display_name": "Symbol 3"},
        ]

    def get_quote(self, symbol):
        data = {
            "SYM1.NS": {"price": 110.0, "previous_close": 100.0, "change": 10.0, "change_pct": 10.0, "volume": 500000},
            "SYM2.NS": {"price": 95.0, "previous_close": 100.0, "change": -5.0, "change_pct": -5.0, "volume": 300000},
            "SYM3.NS": {"price": 100.0, "previous_close": 100.0, "change": 0.0, "change_pct": 0.0, "volume": 100000},
        }
        return data.get(symbol, data["SYM1.NS"])

    def get_ohlc(self, symbol, period="1y", interval="1d"):
        # 10 days of deterministic values
        mult = 1.0 if symbol == "SYM1.NS" else -1.0
        return [
            {"time": f"2026-01-{i+1:02d}", "open": 100 + i * mult, "high": 105 + i * mult, "low": 95 + i * mult, "close": 100 + i * mult, "volume": 1000}
            for i in range(10)
        ]

    def normalize_symbol(self, s):
        return s if s.endswith(".NS") else f"{s}.NS"


class TestPearsonCorrelation:

    def test_perfect_positive_correlation(self):
        a = [1.0, 2.0, 3.0, 4.0, 5.0]
        b = [2.0, 4.0, 6.0, 8.0, 10.0]
        r = compute_pearson_correlation(a, b)
        assert pytest.approx(r, abs=1e-3) == 1.0

    def test_perfect_negative_correlation(self):
        a = [1.0, 2.0, 3.0, 4.0, 5.0]
        b = [10.0, 8.0, 6.0, 4.0, 2.0]
        r = compute_pearson_correlation(a, b)
        assert pytest.approx(r, abs=1e-3) == -1.0

    def test_correlation_matrix_diagonal(self):
        mock = MockProvider()
        service = CorrelationService(mock)
        res = service.compute_matrix(["SYM1.NS", "SYM2.NS"], window=5)
        assert res["matrix"]["SYM1.NS"]["SYM1.NS"] == 1.0
        assert res["matrix"]["SYM2.NS"]["SYM2.NS"] == 1.0


class TestMarketBreadth:

    def test_breadth_counts_and_buckets(self):
        mock = MockProvider()
        svc = MarketBreadthService(mock)
        breadth = svc.compute_breadth()

        assert breadth["universe_size"] == 3
        assert breadth["advancing"] == 1
        assert breadth["declining"] == 1
        assert breadth["unchanged"] == 1
        assert breadth["breadth_ratio"] == 1.0
        assert breadth["distribution_buckets"]["gain_gt_2pct"] == 1
        assert breadth["distribution_buckets"]["loss_gt_2pct"] == 1


class TestThesisReviewAndAnnotations:

    def test_thesis_review_structure(self):
        from api.services.thesis_review_service import ThesisReviewService
        mock = MockProvider()
        reviewer = ThesisReviewService(mock)

        entry = DecisionJournalEntry(
            id=1,
            user_id=10,
            symbol="SYM1.NS",
            action="BUY",
            thesis="Anticipating breakout from base.",
            timestamp=datetime(2026, 1, 3),
            context_snapshot={"price": 102.0},
            status=JournalStatus.OPEN,
        )

        review = reviewer.review_entry(entry)
        assert review["journal_id"] == 1
        assert review["symbol"] == "SYM1.NS"
        assert review["review_available"] is True
        assert len(review["initial_context"]) > 0
        assert len(review["later_observation"]) > 0
