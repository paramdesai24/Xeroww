"""
api/fuzzy
─────────────────────────────────────────────────────────────────
Classical Mamdani Fuzzy Inference System — Interpretation Layer.

Sits entirely ABOVE the deterministic analytics pipeline.
Consumes typed DTOs from AnalyticsOrchestrator and produces
linguistic labels with full rule-firing transparency.

This is NOT:
  - Machine Learning
  - Neural Networks
  - Price Prediction
  - Buy/Sell Recommendation

This IS:
  - Linguistic Variables
  - Membership Functions (trimf, trapmf, gaussmf)
  - Mamdani Rule Evaluation
  - Defuzzification → human-readable label

Zero external dependencies. Pure Python math.
"""

from api.fuzzy.membership import (
    trimf,
    trapmf,
    gaussmf,
    sigmf,
    MembershipResult,
    LinguisticVariable,
)
from api.fuzzy.rules import (
    Condition,
    Conclusion,
    FuzzyRule,
    FiredRule,
    RuleBase,
    defuzzify_max_membership,
)
from api.fuzzy.orchestrator import (
    FuzzyDimension,
    FuzzyExplainabilityReport,
    FuzzyOrchestrator,
    default_fuzzy_orchestrator,
)

__all__ = [
    # Membership
    "trimf",
    "trapmf",
    "gaussmf",
    "sigmf",
    "MembershipResult",
    "LinguisticVariable",
    # Rules
    "Condition",
    "Conclusion",
    "FuzzyRule",
    "FiredRule",
    "RuleBase",
    "defuzzify_max_membership",
    # Orchestrator
    "FuzzyDimension",
    "FuzzyExplainabilityReport",
    "FuzzyOrchestrator",
    "default_fuzzy_orchestrator",
]
