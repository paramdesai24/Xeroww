# Varsity Candle Patterns — Xeroww Reference

> Source: Zerodha Varsity — Technical Analysis Module, Chapter on Candlesticks

---

## Marubozu

A **Marubozu** is a candle with no (or negligible) upper and lower shadows.
The session is entirely controlled by one side — buyers or sellers.

### Bullish Marubozu

```
     │← no upper shadow (or tiny)
  ┌──┤
  │  │  ← Body: Open = Low, Close = High
  │  │     Direction: Upward (Close > Open)
  └──┤
     │← no lower shadow (or tiny)
```

**Characteristics**:
- Open ≈ Low of the day
- Close ≈ High of the day
- Upper and lower shadows ≤ 2% of body

**Varsity Signal**:
> Day 1 (Signal): Bullish Marubozu detected → do NOT enter immediately.
> Day 2 (Confirmation): If the stock trades above Day 1's close → enter long.
> Stop Loss: Day 1's Low

### Bearish Marubozu

```
     │← no upper shadow
  ┌──┤
  │  │  ← Body: Open = High, Close = Low
  │  │     Direction: Downward (Close < Open)
  └──┤
     │← no lower shadow
```

**Characteristics**:
- Open ≈ High of the day
- Close ≈ Low of the day

**Varsity Signal**:
> Day 1 (Signal): Bearish Marubozu detected → do NOT short immediately.
> Day 2 (Confirmation): If the stock trades below Day 1's close → consider short/exit.
> Stop Loss: Day 1's High

---

## Xeroww Detection Thresholds

| Parameter | Value | Description |
|---|---|---|
| `MARUBOZU_SHADOW_THRESHOLD` | `0.02` | Shadow ≤ 2% of body |
| `MARUBOZU_BODY_RANGE_RATIO` | `0.90` | Body ≥ 90% of full day range |

These values are defined as constants in `api/services/pattern_service.py` and can be tuned.

---

## Planned Patterns

- Doji (indecision)
- Hammer / Hanging Man
- Engulfing (Bullish / Bearish)
- Morning Star / Evening Star
