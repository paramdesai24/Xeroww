"""Cross-session Replay Lab analytics with explicit sample sizes."""

from collections import defaultdict
from statistics import mean, median
from typing import Any

from sqlalchemy.orm import Session

from api.models.replay_lab import ReplaySession, ReplaySessionStatus
from api.services.behaviour_observation_service import BehaviourObservationService


class ReplayAnalyticsService:
    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id

    def build(self) -> dict[str, Any]:
        sessions = (
            self.db.query(ReplaySession)
            .filter(ReplaySession.user_id == self.user_id, ReplaySession.status == ReplaySessionStatus.COMPLETED)
            .all()
        )
        outcomes = [session.result.outcome_metrics for session in sessions if session.result and session.result.outcome_metrics.get("applicable")]
        realized = [float(outcome["realized_r_multiple"]) for outcome in outcomes if "realized_r_multiple" in outcome]
        groups: dict[str, dict[str, list[float]]] = {
            "setup": defaultdict(list),
            "timeframe": defaultdict(list),
            "process_grade": defaultdict(list),
        }
        for session in sessions:
            if not session.result:
                continue
            value = session.result.outcome_metrics.get("realized_r_multiple")
            if value is None:
                continue
            groups["setup"][session.setup_category or "Unclassified"].append(float(value))
            groups["timeframe"][session.timeframe].append(float(value))
            groups["process_grade"][session.result.process_grade or "Unavailable"].append(float(value))
        return {
            "session_count": len(sessions),
            "eligible_outcome_count": len(realized),
            "summary": {
                "average_r": mean(realized) if realized else None,
                "median_r": median(realized) if realized else None,
                "win_count": sum(value > 0 for value in realized),
                "loss_count": sum(value < 0 for value in realized),
                "sample_size": len(realized),
            },
            "groups": {
                name: [
                    {"key": key, "sample_size": len(values), "average_r": mean(values) if values else None}
                    for key, values in sorted(entries.items())
                ]
                for name, entries in groups.items()
            },
            "behaviour_observations": BehaviourObservationService.build(sessions),
        }

