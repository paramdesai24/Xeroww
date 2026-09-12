"""
api/analytics
─────────────
Analytics Pipeline and Isolated Calculation Services.

This package isolates every analytical computation into pure, deterministic
services and coordinates them via AnalyticsOrchestrator.

Designed as a drop-in architectural preparation for Kafka streaming
and Apache Spark distributed computation.
"""

from api.analytics.ema import EMAService, EMAResult, EMACrossoverResult
from api.analytics.sma import SMAService, SMAResult, SMACrossoverResult
from api.analytics.volume import VolumeService, VolumeDTO
from api.analytics.rvol import RVOLService, RVOLDTO
from api.analytics.pattern import (
    PatternService,
    PatternDetectionDTO,
    ContextualPatternDTO,
    CandleSummaryDTO,
    MarubozuResultDTO,
)
from api.analytics.structure import (
    StructureService,
    MarketRegimeDTO,
    SignalAlignmentDTO,
    StructureDTO,
)
from api.analytics.support import (
    SupportResistanceService,
    SRZoneDTO,
    SwingPointDTO,
    SRAnalysisDTO,
)
from api.analytics.orchestrator import (
    AnalyticsOrchestrator,
    MovingAveragesSnapshotDTO,
    MarketStructureSummaryDTO,
    default_orchestrator,
)

__all__ = [
    "EMAService",
    "EMAResult",
    "EMACrossoverResult",
    "SMAService",
    "SMAResult",
    "SMACrossoverResult",
    "VolumeService",
    "VolumeDTO",
    "RVOLService",
    "RVOLDTO",
    "PatternService",
    "PatternDetectionDTO",
    "ContextualPatternDTO",
    "CandleSummaryDTO",
    "MarubozuResultDTO",
    "StructureService",
    "MarketRegimeDTO",
    "SignalAlignmentDTO",
    "StructureDTO",
    "SupportResistanceService",
    "SRZoneDTO",
    "SwingPointDTO",
    "SRAnalysisDTO",
    "AnalyticsOrchestrator",
    "MovingAveragesSnapshotDTO",
    "MarketStructureSummaryDTO",
    "default_orchestrator",
]
