from api.data.nifty50 import NIFTY50, NIFTY50_AS_OF, NIFTY50_SOURCE_URL


def test_nifty50_catalogue_has_fifty_unique_nse_symbols():
    symbols = [stock["symbol"] for stock in NIFTY50]

    assert len(symbols) == 50
    assert len(set(symbols)) == 50
    assert all(symbol.endswith(".NS") for symbol in symbols)


def test_nifty50_catalogue_includes_current_reference_members():
    symbols = {stock["symbol"] for stock in NIFTY50}

    assert {"RELIANCE.NS", "INDIGO.NS", "MAXHEALTH.NS", "TMPV.NS", "WIPRO.NS"} <= symbols
    assert NIFTY50_AS_OF == "2026-09-19"
    assert NIFTY50_SOURCE_URL.startswith("https://www.nseindia.com/")
