import pytest


@pytest.mark.parametrize(
    ("symbol", "display_name"),
    [
        ("^NSEI", "NIFTY 50"),
        ("^BSESN", "SENSEX"),
        ("^NSEBANK", "NIFTY BANK"),
        ("^INDIAVIX", "INDIA VIX"),
    ],
)
def test_market_index_quote_and_ohlc_routes_preserve_yahoo_symbol(client, symbol, display_name):
    quote = client.get(f"/quote/{symbol}")
    candles = client.get(f"/ohlc/{symbol}?period=1mo&interval=1d")

    assert quote.status_code == 200
    assert quote.json()["symbol"] == symbol
    assert candles.status_code == 200
    assert candles.json()["symbol"] == symbol
    assert candles.json()["display_name"] == display_name
    assert len(candles.json()["candles"]) == 20
