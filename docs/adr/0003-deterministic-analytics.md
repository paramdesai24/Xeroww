# ADR 0003: Deterministic Financial Analytics Architecture

## Status
Accepted

## Context
Many modern trading tools introduce black-box machine learning models, pseudo-probabilistic "confidence percentages", or predictive recommendations. In financial analytics, non-deterministic predictions erode user trust, introduce unquantifiable hallucination risks, create regulatory liability, and cannot be systematically backtested or audited. Traders need objective market structure awareness, verifiable pattern detection, and mathematical clarity regarding existing market conditions.

## Decision
All market analytics within Xeroww must be 100% deterministic and auditable:
- No machine learning, black-box heuristics, or probabilistic price predictions.
- Pattern detection (Marubozu, Engulfing, Harami, Stars, Doji, Hammer, etc.) adheres strictly to mathematical candle anatomy criteria and Varsity benchmarks.
- Support and resistance levels are computed via deterministic pivot point algorithms and fractal swing detection.
- Volume profiles, moving averages, and alignment scores are exact mathematical functions of the input time series.
- Given the exact same sequence of OHLCV candles, the analytics engine is guaranteed to produce the exact same analytical outputs.

## Consequences
### Positive
- Complete reproducibility and auditability of all analytics outputs.
- Testable through standard deterministic unit test suites with zero stochastic variance.
- Enables reliable Historical Market Replay where identical candle sequences yield identical historical alerts, levels, and patterns.
- Clear separation between facts (market state) and human judgment (trader decision-making).

### Negative
- Does not offer speculative "tomorrow's price" predictions to users seeking automated forecasting.
