# ADR 0004: Historical Market Replay Engine Design

## Status
Accepted

## Context
Traders require backtesting and retrospective review tools to observe how market structures formed historically and evaluate their own past decision-making against objective conditions. However, many replay tools suffer from look-ahead bias, where calculations accidentally consume future data points before the simulated replay timestamp.

## Decision
We implement an isolated, point-in-time Historical Replay Engine:
- The replay engine accepts an instrument symbol, timeframe, date, and bounded time window `[start_time, end_time]`.
- The engine fetches the raw historical candle series and steps through one candle interval at a time.
- At each step index `t`, analytics functions consume strictly the slice `candles[0...t]`. Future candles `candles[t+1...]` are completely hidden from pattern detection, moving average calculation, support/resistance evaluation, and alert triggers.
- Decision journals and annotations recorded at or before replay timestamp `t` are rendered in context.
- The engine exposes REST timeline, step, and jump endpoints. The dashboard schedules playback locally and requests one deterministic snapshot per step. Network streaming is future work.

## Consequences
### Positive
- Strict prevention of look-ahead bias.
- Authentic simulation of historical cognitive environment for the trader.
- Seamless integration with existing deterministic pattern and market structure engines without duplicating logic.

### Negative
- Incremental window evaluation on large historical spans can require memory buffering or window optimization in lower-tier environments.
