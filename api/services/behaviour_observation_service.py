"""Private, explainable observations derived from replay session facts."""

from collections import Counter
from typing import Any


class BehaviourObservationService:
    VERSION = "BEHAVIOUR-OBSERVATIONS-V1"
    MINIMUM_SAMPLE = 5

    @classmethod
    def build(cls, sessions) -> list[dict[str, Any]]:
        eligible = [session for session in sessions if getattr(session.status, "value", session.status) == "COMPLETED"]
        if len(eligible) < cls.MINIMUM_SAMPLE:
            return [{
                "key": "INSUFFICIENT_SESSIONS",
                "statement": "Not enough completed sessions for a behaviour observation.",
                "numerator": len(eligible),
                "denominator": cls.MINIMUM_SAMPLE,
                "minimum_sample": cls.MINIMUM_SAMPLE,
                "version": cls.VERSION,
            }]

        counters = Counter()
        session_ids: dict[str, list[int]] = {
            "INVALIDATION_WIDENING": [],
            "UNPLANNED_EXIT": [],
            "HIGH_CONFIDENCE_LOW_PROCESS": [],
        }
        for session in eligible:
            events = list(session.events)
            if any(event.payload.get("risk_widened") for event in events if event.event_type == "DECISION_AMENDED"):
                counters["INVALIDATION_WIDENING"] += 1
                session_ids["INVALIDATION_WIDENING"].append(session.id)
            if any(event.event_type == "POSITION_EXITED" and event.payload.get("reason") in {"EMOTION", "OTHER"} for event in events):
                counters["UNPLANNED_EXIT"] += 1
                session_ids["UNPLANNED_EXIT"].append(session.id)
            if session.result and float(session.result.process_score or 0) < 60:
                counters["HIGH_CONFIDENCE_LOW_PROCESS"] += 1
                session_ids["HIGH_CONFIDENCE_LOW_PROCESS"].append(session.id)

        definitions = {
            "INVALIDATION_WIDENING": ("Invalidation was widened in several sessions.", 0.30),
            "UNPLANNED_EXIT": ("Several exits lacked a plan or evidence reason.", 0.30),
            "HIGH_CONFIDENCE_LOW_PROCESS": ("Low process adherence appears repeatedly.", 0.40),
        }
        observations = []
        for key, (statement, threshold) in definitions.items():
            count = counters[key]
            rate = count / len(eligible)
            if rate >= threshold:
                observations.append({
                    "key": key,
                    "statement": statement,
                    "numerator": count,
                    "denominator": len(eligible),
                    "threshold": threshold,
                    "session_ids": session_ids[key],
                    "version": cls.VERSION,
                    "limitation": "This is a rule-based observation, not a psychological diagnosis.",
                })
        return observations

