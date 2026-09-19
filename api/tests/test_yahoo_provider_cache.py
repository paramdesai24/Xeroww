from pathlib import Path

import pytest

from api.core.config import settings
from api.services import yahoo_provider


def test_provider_configures_writable_yfinance_cache(monkeypatch, tmp_path):
    cache_dir = tmp_path / "nested" / "yfinance"
    configured_paths: list[str] = []

    monkeypatch.setattr(settings, "YFINANCE_CACHE_DIR", str(cache_dir))
    monkeypatch.setattr(yahoo_provider, "_cache_is_configured", False)
    monkeypatch.setattr(
        yahoo_provider.yf,
        "set_tz_cache_location",
        configured_paths.append,
    )

    yahoo_provider.YahooFinanceProvider()

    assert cache_dir.is_dir()
    assert configured_paths == [str(cache_dir.resolve())]


def test_provider_reports_invalid_yfinance_cache_path(monkeypatch, tmp_path):
    cache_file = tmp_path / "not-a-directory"
    cache_file.write_text("occupied", encoding="utf-8")

    monkeypatch.setattr(settings, "YFINANCE_CACHE_DIR", str(cache_file))
    monkeypatch.setattr(yahoo_provider, "_cache_is_configured", False)

    with pytest.raises(RuntimeError, match="Unable to initialize Yahoo Finance cache"):
        yahoo_provider.YahooFinanceProvider()

    assert Path(cache_file).is_file()
