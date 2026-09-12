"""
api/events
──────────
Domain Events and In-Memory Event Bus.

Decouples side-effects and cross-domain communication across Xeroww.
Provides a drop-in replacement seam for Apache Kafka / Redis Streams in distributed deployments.
"""

from api.events.base import DomainEvent

__all__ = ["DomainEvent"]
