"""NIFTY 50 constituent catalogue for the Xeroww supported universe.

Constituents reflect the index before the September 30, 2026 rebalance.
Yahoo Finance symbols use the NSE ``.NS`` suffix.
"""

from typing import Final


NIFTY50_AS_OF: Final[str] = "2026-09-19"
NIFTY50_SOURCE_URL: Final[str] = "https://www.nseindia.com/static/products-services/indices-nifty50-index"

NIFTY50: Final[list[dict[str, str]]] = [
    {"symbol": "ADANIENT.NS", "display_name": "Adani Enterprises", "exchange": "NSE", "sector": "Metals and Minerals Trading"},
    {"symbol": "ADANIPORTS.NS", "display_name": "Adani Ports and Special Economic Zone", "exchange": "NSE", "sector": "Transport Infrastructure"},
    {"symbol": "APOLLOHOSP.NS", "display_name": "Apollo Hospitals Enterprise", "exchange": "NSE", "sector": "Healthcare Services"},
    {"symbol": "ASIANPAINT.NS", "display_name": "Asian Paints", "exchange": "NSE", "sector": "Consumer Durables"},
    {"symbol": "AXISBANK.NS", "display_name": "Axis Bank", "exchange": "NSE", "sector": "Financial Services"},
    {"symbol": "BAJAJ-AUTO.NS", "display_name": "Bajaj Auto", "exchange": "NSE", "sector": "Automobile and Auto Components"},
    {"symbol": "BAJFINANCE.NS", "display_name": "Bajaj Finance", "exchange": "NSE", "sector": "Financial Services"},
    {"symbol": "BAJAJFINSV.NS", "display_name": "Bajaj Finserv", "exchange": "NSE", "sector": "Financial Services"},
    {"symbol": "BEL.NS", "display_name": "Bharat Electronics", "exchange": "NSE", "sector": "Aerospace and Defense"},
    {"symbol": "BHARTIARTL.NS", "display_name": "Bharti Airtel", "exchange": "NSE", "sector": "Telecommunication"},
    {"symbol": "CIPLA.NS", "display_name": "Cipla", "exchange": "NSE", "sector": "Pharmaceuticals"},
    {"symbol": "COALINDIA.NS", "display_name": "Coal India", "exchange": "NSE", "sector": "Consumable Fuels"},
    {"symbol": "DRREDDY.NS", "display_name": "Dr. Reddy's Laboratories", "exchange": "NSE", "sector": "Pharmaceuticals"},
    {"symbol": "EICHERMOT.NS", "display_name": "Eicher Motors", "exchange": "NSE", "sector": "Automobile and Auto Components"},
    {"symbol": "ETERNAL.NS", "display_name": "Eternal", "exchange": "NSE", "sector": "Consumer Services"},
    {"symbol": "GRASIM.NS", "display_name": "Grasim Industries", "exchange": "NSE", "sector": "Construction Materials"},
    {"symbol": "HCLTECH.NS", "display_name": "HCL Technologies", "exchange": "NSE", "sector": "Information Technology"},
    {"symbol": "HDFCBANK.NS", "display_name": "HDFC Bank", "exchange": "NSE", "sector": "Financial Services"},
    {"symbol": "HDFCLIFE.NS", "display_name": "HDFC Life Insurance", "exchange": "NSE", "sector": "Insurance"},
    {"symbol": "HINDALCO.NS", "display_name": "Hindalco Industries", "exchange": "NSE", "sector": "Metals and Mining"},
    {"symbol": "HINDUNILVR.NS", "display_name": "Hindustan Unilever", "exchange": "NSE", "sector": "Fast Moving Consumer Goods"},
    {"symbol": "ICICIBANK.NS", "display_name": "ICICI Bank", "exchange": "NSE", "sector": "Financial Services"},
    {"symbol": "INFY.NS", "display_name": "Infosys", "exchange": "NSE", "sector": "Information Technology"},
    {"symbol": "INDIGO.NS", "display_name": "InterGlobe Aviation", "exchange": "NSE", "sector": "Transport Services"},
    {"symbol": "ITC.NS", "display_name": "ITC", "exchange": "NSE", "sector": "Fast Moving Consumer Goods"},
    {"symbol": "JIOFIN.NS", "display_name": "Jio Financial Services", "exchange": "NSE", "sector": "Financial Services"},
    {"symbol": "JSWSTEEL.NS", "display_name": "JSW Steel", "exchange": "NSE", "sector": "Metals and Mining"},
    {"symbol": "KOTAKBANK.NS", "display_name": "Kotak Mahindra Bank", "exchange": "NSE", "sector": "Financial Services"},
    {"symbol": "LT.NS", "display_name": "Larsen and Toubro", "exchange": "NSE", "sector": "Construction"},
    {"symbol": "M&M.NS", "display_name": "Mahindra and Mahindra", "exchange": "NSE", "sector": "Automobile and Auto Components"},
    {"symbol": "MARUTI.NS", "display_name": "Maruti Suzuki India", "exchange": "NSE", "sector": "Automobile and Auto Components"},
    {"symbol": "MAXHEALTH.NS", "display_name": "Max Healthcare Institute", "exchange": "NSE", "sector": "Healthcare Services"},
    {"symbol": "NESTLEIND.NS", "display_name": "Nestle India", "exchange": "NSE", "sector": "Fast Moving Consumer Goods"},
    {"symbol": "NTPC.NS", "display_name": "NTPC", "exchange": "NSE", "sector": "Power"},
    {"symbol": "ONGC.NS", "display_name": "Oil and Natural Gas Corporation", "exchange": "NSE", "sector": "Oil"},
    {"symbol": "POWERGRID.NS", "display_name": "Power Grid Corporation of India", "exchange": "NSE", "sector": "Power"},
    {"symbol": "RELIANCE.NS", "display_name": "Reliance Industries", "exchange": "NSE", "sector": "Oil, Gas and Consumable Fuels"},
    {"symbol": "SBILIFE.NS", "display_name": "SBI Life Insurance", "exchange": "NSE", "sector": "Insurance"},
    {"symbol": "SHRIRAMFIN.NS", "display_name": "Shriram Finance", "exchange": "NSE", "sector": "Financial Services"},
    {"symbol": "SBIN.NS", "display_name": "State Bank of India", "exchange": "NSE", "sector": "Financial Services"},
    {"symbol": "SUNPHARMA.NS", "display_name": "Sun Pharmaceutical Industries", "exchange": "NSE", "sector": "Pharmaceuticals"},
    {"symbol": "TCS.NS", "display_name": "Tata Consultancy Services", "exchange": "NSE", "sector": "Information Technology"},
    {"symbol": "TATACONSUM.NS", "display_name": "Tata Consumer Products", "exchange": "NSE", "sector": "Fast Moving Consumer Goods"},
    {"symbol": "TMPV.NS", "display_name": "Tata Motors Passenger Vehicles", "exchange": "NSE", "sector": "Automobile and Auto Components"},
    {"symbol": "TATASTEEL.NS", "display_name": "Tata Steel", "exchange": "NSE", "sector": "Metals and Mining"},
    {"symbol": "TECHM.NS", "display_name": "Tech Mahindra", "exchange": "NSE", "sector": "Information Technology"},
    {"symbol": "TITAN.NS", "display_name": "Titan Company", "exchange": "NSE", "sector": "Consumer Durables"},
    {"symbol": "TRENT.NS", "display_name": "Trent", "exchange": "NSE", "sector": "Retailing"},
    {"symbol": "ULTRACEMCO.NS", "display_name": "UltraTech Cement", "exchange": "NSE", "sector": "Construction Materials"},
    {"symbol": "WIPRO.NS", "display_name": "Wipro", "exchange": "NSE", "sector": "Information Technology"},
]

