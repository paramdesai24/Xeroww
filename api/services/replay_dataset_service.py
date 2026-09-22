"""Dataset selection and fingerprinting for persisted replay sessions."""

import hashlib
import json
import random
import secrets
from datetime import datetime
from typing import Any

from fastapi import HTTPException, status

from api.data.nifty50 import NIFTY50


class ReplayDatasetService:
    VERSION = "REPLAY-DATASET-V1"
    TIMEFRAMES = {
        "1d": {"period": "5y", "interval": "1d", "warmup": 220},
        "1h": {"period": "2y", "interval": "1h", "warmup": 220},
        "15m": {"period": "60d", "interval": "15m", "warmup": 220},
    }

    def __init__(self, market_data):
        self.market_data = market_data

    @staticmethod
    def date_key(value: Any) -> str:
        return str(value or "")[:10]

    @staticmethod
    def to_datetime(value: Any) -> datetime:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed

    @staticmethod
    def fingerprint(symbol: str, timeframe: str, candles: list[dict[str, Any]]) -> str:
        payload = {
            "symbol": symbol,
            "timeframe": timeframe,
            "candles": [
                {
                    "time": candle.get("time"),
                    "open": candle.get("open"),
                    "high": candle.get("high"),
                    "low": candle.get("low"),
                    "close": candle.get("close"),
                    "volume": candle.get("volume"),
                }
                for candle in candles
            ],
        }
        encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
        return hashlib.sha256(encoded.encode("utf-8")).hexdigest()

    def resolve(
        self,
        *,
        symbol: str | None,
        randomize_symbol: bool,
        start_date: str | None,
        randomize_start: bool,
        timeframe: str,
        session_bars: int,
    ) -> dict[str, Any]:
        config = self.TIMEFRAMES.get(timeframe)
        if not config:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "REPLAY_DATA_WINDOW_UNAVAILABLE", "message": "Unsupported replay timeframe."},
            )

        seed = secrets.token_hex(16)
        rng = random.Random(seed)
        candidates = [item["symbol"] for item in NIFTY50]
        selected_symbol = rng.choice(candidates) if randomize_symbol else str(symbol).strip().upper()

        normalized, candles = self.market_data.get_candles(
            selected_symbol, period=config["period"], interval=config["interval"]
        )
        candles = sorted(candles, key=lambda candle: str(candle.get("time")))
        warmup = int(config["warmup"])
        latest_start = len(candles) - session_bars
        if latest_start < warmup:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "REPLAY_DATA_WINDOW_UNAVAILABLE",
                    "message": "The provider did not return enough warmup and session candles.",
                    "supported_alternatives": ["1d"],
                },
            )

        if randomize_start:
            start_index = rng.randint(warmup, latest_start)
        elif start_date:
            eligible = [
                index for index, candle in enumerate(candles)
                if index >= warmup and self.date_key(candle.get("time")) >= self.date_key(start_date)
            ]
            if not eligible or eligible[0] > latest_start:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        "code": "REPLAY_DATA_WINDOW_UNAVAILABLE",
                        "message": "The requested start date cannot support the selected session length.",
                    },
                )
            start_index = eligible[0]
        else:
            start_index = latest_start

        end_index = min(start_index + session_bars - 1, len(candles) - 1)
        return {
            "symbol": normalized,
            "candles": candles,
            "source_period": config["period"],
            "interval": config["interval"],
            "warmup_start_index": max(0, start_index - warmup),
            "start_index": start_index,
            "end_index": end_index,
            "random_seed": seed,
            "fingerprint": self.fingerprint(normalized, timeframe, candles),
        }

