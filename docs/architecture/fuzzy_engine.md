# Fuzzy Explainability Engine — Architecture

> **Xeroww v0.8** | Classical Mamdani Fuzzy Inference System

---

## Overview

The Fuzzy Explainability Engine is a **read-only linguistic interpretation layer** that sits above Xeroww's deterministic analytics pipeline. It translates crisp numerical analytics outputs into human-readable linguistic labels using classical Mamdani Fuzzy Inference Systems (FIS).

### What it is NOT
- ❌ Machine Learning  
- ❌ Neural Networks  
- ❌ Price Prediction  
- ❌ Buy/Sell Signals  
- ❌ Probabilistic AI  
- ❌ Historical pattern fitting  

### What it IS
- ✅ Linguistic Variables with Membership Functions  
- ✅ Mamdani Rule Evaluation with full firing transparency  
- ✅ Defuzzification to a single auditable label  
- ✅ Complete rule-by-rule audit trail  
- ✅ Deterministic: same inputs → same outputs, always  

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│               React Dashboard (TypeScript)              │
│  FuzzyExplainCard.tsx                                   │
│  ├── OverallBadge (composite STRONGLY_BULLISH etc.)     │
│  ├── DimensionRow × 4 (activation bars)                 │
│  │   └── [expanded] MembershipBarList + FiredRulesList  │
│  └── Methodology disclaimer                             │
└──────────────────────────┬──────────────────────────────┘
                           │ GET /fuzzy/explain?symbol=…
┌──────────────────────────▼──────────────────────────────┐
│              FastAPI Route (/fuzzy/explain)              │
│  api/routes/fuzzy.py                                    │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│            FuzzyOrchestrator (api/fuzzy/orchestrator.py)│
│                                                         │
│  1. AnalyticsOrchestrator.run_market_structure_summary()│
│     └─→ MarketStructureSummaryDTO                       │
│           ├── EMA-9, EMA-20, SMA-200                    │
│           ├── RVOL, Volume                              │
│           ├── SignalAlignmentDTO                        │
│           ├── MarketRegimeDTO                           │
│           └── SRAnalysisDTO                             │
│                                                         │
│  2. Extract crisp inputs per FIS                        │
│                                                         │
│  3. Evaluate 4 FIS in sequence                          │
│     ├── MomentumFIS  → WEAK/MODERATE/STRONG/SURGING     │
│     ├── VolumeFIS    → DRY/NORMAL/ELEVATED/CLIMACTIC    │
│     ├── TrendFIS     → BEARISH/NEUTRAL/BULLISH/STR_BULL │
│     └── StructureFIS → BROKEN/CONTESTED/FIRM/DOMINANT   │
│                                                         │
│  4. Compute composite weighted score                    │
│     (Trend 35% + Momentum 30% + Volume 20% + Struct 15%)│
│                                                         │
│  5. Return FuzzyExplainabilityReport                    │
└──────────────────────────┬──────────────────────────────┘
                           │ (read-only, no writes)
┌──────────────────────────▼──────────────────────────────┐
│          Deterministic Analytics Pipeline               │
│  EMAService · SMAService · VolumeService · RVOLService  │
│  PatternService · StructureService · SRService          │
│  AnalyticsOrchestrator                                  │
│                                                         │
│  [Unchanged — fuzzy engine never modifies these]        │
└─────────────────────────────────────────────────────────┘
```

---

## Membership Function Shapes

```
trimf(x, a, b, c) — Triangular
         1 |      /\
           |     /  \
           |    /    \
         0 |___/      \___
               a  b  c

trapmf(x, a, b, c, d) — Trapezoidal
         1 |    /‾‾‾‾\
           |   /      \
         0 |__/        \__
              a  b   c  d

gaussmf(x, mean, sigma) — Gaussian Bell
         1 |      ╭─╮
           |    ╭─╯ ╰─╮
         0 |───╯       ╰───
                  mean
```

All functions return values in **[0.0, 1.0]** exclusively. Zero external dependencies — pure Python `math` module only.

---

## Mamdani Inference Process (per FIS dimension)

```
Step 1: Fuzzification
   crisp_value → linguistic_variable.fuzzify(x)
   → [MembershipResult(term="LARGE_POSITIVE", value=0.82), ...]

Step 2: Rule Evaluation
   for each FuzzyRule:
     condition_values = [cond.evaluate(activations) for cond in antecedent]
     firing_strength  = min(condition_values) × weight  [Mamdani conjunction]

Step 3: Aggregation
   aggregated_output[term] = max(firing_strength for all rules with that consequent)

Step 4: Defuzzification (Max-Membership)
   winning_label = argmax(aggregated_output)
   winning_activation = aggregated_output[winning_label]
```

**Why Max-Membership instead of Centroid?**  
For discrete singleton output sets (WEAK/MODERATE/STRONG/SURGING), max-membership produces equivalent results to centroid for evenly-spaced outputs, and is **fully auditable** — you can always point to the exact rule that determined the output label.

---

## FIS Dimensions Reference

### 1. MomentumFIS
| Input | Computation | Terms |
|---|---|---|
| `ema_spread` | `(EMA-9 − EMA-20) / price × 100` | STRONGLY_NEGATIVE / NEGATIVE / FLAT / SMALL_POSITIVE / LARGE_POSITIVE |
| `price_vs_ema20` | `(price − EMA-20) / price × 100` | FAR_BELOW / BELOW / AT / ABOVE / FAR_ABOVE |

**Output:** `WEAK` → `MODERATE` → `STRONG` → `SURGING`

### 2. VolumeFIS
| Input | Computation | Terms |
|---|---|---|
| `rvol` | `today_vol / baseline_avg_vol` | VERY_LOW / LOW / NORMAL / HIGH / EXTREME |
| `volume_trend` | `(today_vol − avg_5d) / avg_5d × 100` | DECLINING / STABLE / RISING / SURGING |

**Output:** `DRY` → `NORMAL` → `ELEVATED` → `CLIMACTIC`

### 3. TrendFIS
| Input | Computation | Terms |
|---|---|---|
| `price_vs_sma200` | `(price − SMA-200) / price × 100` | FAR_BELOW / BELOW / AT / ABOVE / FAR_ABOVE |
| `alignment_score` | `(bullish_count − bearish_count) / total_conditions` | STRONGLY_BEARISH → STRONGLY_BULLISH |

**Output:** `BEARISH` → `NEUTRAL` → `BULLISH` → `STRONGLY_BULLISH`

### 4. StructureFIS
| Input | Computation | Terms |
|---|---|---|
| `zone_proximity` | `min(abs(price − zone_mid) / price × 100)` | AT_ZONE / NEAR_ZONE / APPROACHING / BETWEEN / FAR |
| `regime_strength` | Encoded from `MarketRegimeDTO.regime` | WEAK / FRAGILE / MODERATE / STRONG / DOMINANT |

**Regime encoding:**
```
TRENDING_UP     → 0.85
TRENDING_DOWN   → 0.15
RANGE_BOUND     → 0.50
HIGH_VOLATILITY → 0.35
LOW_ACTIVITY    → 0.25
MIXED           → 0.45
```

**Output:** `BROKEN` → `CONTESTED` → `FIRM` → `DOMINANT`

---

## Composite Score

```python
weighted_score = (
    momentum.activation  × 0.30 +
    volume.activation    × 0.20 +
    trend.activation     × 0.35 +
    structure.activation × 0.15
)
```

| Score Range | Overall Label |
|---|---|
| ≥ 0.80 | `STRONGLY_BULLISH` |
| ≥ 0.62 | `MODERATELY_BULLISH` |
| ≥ 0.48 | `NEUTRAL` |
| ≥ 0.32 | `MODERATELY_BEARISH` |
| < 0.32 | `STRONGLY_BEARISH` |

Weights are **hard-coded constants**, NOT learned or tuned on historical data.

---

## How to Add a New FIS Dimension

1. Create `api/fuzzy/dimensions/your_dimension.py`
2. Define `LinguisticVariable` objects for each input
3. Create a `RuleBase` with `FuzzyRule` objects
4. Implement `YourFIS.evaluate(inputs) -> YourFISResult`
5. Import and call from `FuzzyOrchestrator.explain()`
6. Add `FuzzyDimension` to the `dimensions` list
7. Update `DIMENSION_WEIGHTS` constant
8. Add TypeScript display metadata to `DIMENSION_META` in `FuzzyExplainCard.tsx`

---

## File Map

```
api/
  fuzzy/
    __init__.py               — package exports
    membership.py             — trimf, trapmf, gaussmf, sigmf, LinguisticVariable
    rules.py                  — FuzzyRule, RuleBase, FiredRule, defuzzify_max_membership
    orchestrator.py           — FuzzyOrchestrator, FuzzyExplainabilityReport
    dimensions/
      __init__.py
      momentum.py             — MomentumFIS (EMA-based)
      volume.py               — VolumeFIS (RVOL-based)
      trend.py                — TrendFIS (SMA-200 + alignment)
      structure.py            — StructureFIS (SR zones + regime)
  routes/
    fuzzy.py                  — GET /fuzzy/explain

dashboard/src/
  types/
    fuzzy.ts                  — TypeScript interfaces (readonly)
  api/
    client.ts                 — api.fuzzy.explain() method
  components/
    FuzzyExplainCard.tsx      — Institutional UI component
```

---

## Academic Reference

This implementation follows the classical Mamdani FIS paper:
> Mamdani, E.H. and Assilian, S. (1975). "An experiment in linguistic synthesis with a fuzzy logic controller." *International Journal of Man-Machine Studies*, 7(1), pp.1–13.

And the textbook formulation in:
> Ross, T.J. (2010). *Fuzzy Logic with Engineering Applications* (3rd ed.). Wiley.

The Xeroww FIS uses triangular/trapezoidal membership functions (Chapters 3–4) and the Mamdani max-min inference method (Chapter 6) with max-membership defuzzification (Chapter 7).
