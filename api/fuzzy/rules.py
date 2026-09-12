"""
api/fuzzy/rules.py
────────────────────────────────────────────────────────────────────────────
Mamdani Fuzzy Rule Engine.

Provides the structures and evaluation logic for classical Mamdani-style
fuzzy inference:
  1.  Antecedent evaluation     — check each IF-condition against fuzzified inputs
  2.  Rule firing strength       — min-activation (standard Mamdani conjunction)
  3.  Aggregation                — collect all fired consequents
  4.  Defuzzification            — max-membership: highest-activation label wins

Defuzzification strategy: max-membership.
Rationale: For discrete output label spaces (e.g., WEAK/MODERATE/STRONG/SURGING),
max-membership is equivalent to centroid for evenly spaced singleton output
sets and is fully auditable — you can always see exactly which rule won and why.

Zero external dependencies. Pure Python only.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal


ModifierType = Literal["IS", "IS_NOT"]


# ---------------------------------------------------------------------------
# Antecedent / Consequent Structures
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Condition:
    """
    A single antecedent clause: variable IS/IS_NOT term.

    Attributes
    ----------
    variable : str — name of the input linguistic variable (e.g., "rvol")
    term     : str — linguistic term to match (e.g., "ELEVATED")
    modifier : "IS" | "IS_NOT" — logical qualifier
    """
    variable: str
    term: str
    modifier: ModifierType = "IS"

    def evaluate(self, activations: dict[str, dict[str, float]]) -> float:
        """
        Return the membership activation of this condition given the fuzzified
        inputs dictionary.

        Parameters
        ----------
        activations : {variable_name: {term: activation_value}}
            Pre-computed fuzzified values for all input variables.

        Returns
        -------
        float in [0.0, 1.0]
        """
        var_acts = activations.get(self.variable, {})
        raw = var_acts.get(self.term, 0.0)
        if self.modifier == "IS_NOT":
            return round(1.0 - raw, 4)
        return round(raw, 4)

    def to_dict(self) -> dict[str, Any]:
        return {
            "variable": self.variable,
            "term": self.term,
            "modifier": self.modifier,
        }


@dataclass(frozen=True)
class Conclusion:
    """
    A single consequent: output_variable IS term.

    Attributes
    ----------
    variable : str — name of the output linguistic variable
    term     : str — the linguistic output label (e.g., "STRONG")
    """
    variable: str
    term: str

    def to_dict(self) -> dict[str, Any]:
        return {"variable": self.variable, "term": self.term}


# ---------------------------------------------------------------------------
# Fuzzy Rule
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class FuzzyRule:
    """
    A single Mamdani fuzzy rule.

    IF (condition_1 AND condition_2 AND ...) THEN consequent [weight]

    The antecedent uses standard Mamdani conjunction (min) across all conditions.
    Multiple conditions produce a firing strength = min(all condition activations).

    Attributes
    ----------
    antecedent  : list[Condition] — one or more IF clauses (ANDed together)
    consequent  : Conclusion — the THEN output
    weight      : float in [0.0, 1.0] — rule importance weight (default 1.0)
    description : human-readable rule description for audit trail
    """
    antecedent: tuple[Condition, ...]
    consequent: Conclusion
    weight: float = 1.0
    description: str = ""

    def firing_strength(self, activations: dict[str, dict[str, float]]) -> float:
        """
        Compute the Mamdani firing strength for this rule.

        Firing strength = weight × min(antecedent condition activations)

        Parameters
        ----------
        activations : pre-fuzzified input activations {variable: {term: value}}

        Returns
        -------
        float in [0.0, 1.0]
        """
        if not self.antecedent:
            return 0.0
        condition_values = [c.evaluate(activations) for c in self.antecedent]
        strength = min(condition_values)  # Mamdani conjunction = min
        return round(strength * self.weight, 4)

    def to_dict(self) -> dict[str, Any]:
        return {
            "antecedent": [c.to_dict() for c in self.antecedent],
            "consequent": self.consequent.to_dict(),
            "weight": self.weight,
            "description": self.description,
        }


# ---------------------------------------------------------------------------
# Fired Rule (runtime result)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class FiredRule:
    """
    The result of evaluating a FuzzyRule against actual crisp inputs.

    Attributes
    ----------
    rule       : FuzzyRule — the rule that fired
    activation : float — the computed firing strength (0.0 if rule did not fire)
    reasoning  : str — human-readable explanation string
    fired      : bool — True if activation > 0.0
    """
    rule: FuzzyRule
    activation: float
    reasoning: str
    fired: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "description": self.rule.description,
            "consequent_term": self.rule.consequent.term,
            "activation": round(self.activation, 4),
            "fired": self.fired,
            "reasoning": self.reasoning,
            "antecedent": [c.to_dict() for c in self.rule.antecedent],
        }


# ---------------------------------------------------------------------------
# Rule Base
# ---------------------------------------------------------------------------

class RuleBase:
    """
    A typed collection of FuzzyRule objects for one FIS dimension.

    Provides:
      evaluate(activations) → list[FiredRule] sorted descending by activation
    """

    def __init__(self, rules: list[FuzzyRule], output_variable: str) -> None:
        self._rules = rules
        self.output_variable = output_variable

    def evaluate(
        self,
        activations: dict[str, dict[str, float]],
    ) -> list[FiredRule]:
        """
        Evaluate all rules against the fuzzified input activations.

        Returns
        -------
        list[FiredRule] — all rules evaluated, sorted descending by activation strength.
        Includes rules that did NOT fire (activation == 0.0) for full transparency.
        """
        results: list[FiredRule] = []
        for rule in self._rules:
            strength = rule.firing_strength(activations)
            # Build a human-readable reasoning string
            antecedent_parts = []
            for cond in rule.antecedent:
                var_acts = activations.get(cond.variable, {})
                act_val = var_acts.get(cond.term, 0.0)
                antecedent_parts.append(
                    f"{cond.variable} {cond.modifier} {cond.term} [{act_val:.3f}]"
                )
            reasoning = (
                f"IF {' AND '.join(antecedent_parts)} "
                f"THEN {rule.consequent.variable} IS {rule.consequent.term} "
                f"→ strength={strength:.3f}"
            )
            results.append(
                FiredRule(
                    rule=rule,
                    activation=strength,
                    reasoning=reasoning,
                    fired=strength > 0.0,
                )
            )

        return sorted(results, key=lambda r: -r.activation)


# ---------------------------------------------------------------------------
# Defuzzification
# ---------------------------------------------------------------------------

def defuzzify_max_membership(fired_rules: list[FiredRule]) -> tuple[str, float]:
    """
    Max-Membership defuzzification.

    Selects the consequent term with the highest firing activation.
    If no rule fires (all activations == 0.0), returns ("UNKNOWN", 0.0).

    Returns
    -------
    (winning_label: str, winning_activation: float)
    """
    if not fired_rules:
        return ("UNKNOWN", 0.0)

    # Aggregate: for each output term, take the MAX activation across all rules
    aggregated: dict[str, float] = {}
    for fr in fired_rules:
        term = fr.rule.consequent.term
        aggregated[term] = max(aggregated.get(term, 0.0), fr.activation)

    if not aggregated or max(aggregated.values()) == 0.0:
        return ("UNKNOWN", 0.0)

    best_term = max(aggregated, key=lambda t: aggregated[t])
    return (best_term, round(aggregated[best_term], 4))


def build_activations_map(
    variable_name: str,
    fuzzified: list,  # list[MembershipResult]
) -> dict[str, dict[str, float]]:
    """
    Helper: convert a list of MembershipResult into the activations dict
    format expected by RuleBase.evaluate().

    Parameters
    ----------
    variable_name : str
    fuzzified     : list[MembershipResult]

    Returns
    -------
    {variable_name: {term: value, ...}}
    """
    return {variable_name: {mr.term: mr.value for mr in fuzzified}}
