"""
api/events/bus.py
─────────────────
In-Memory Event Bus and Bus Interface.

Provides publish-subscribe messaging for decoupled domain communication.
Designed as an architectural seam: today all events dispatch in-process synchronously;
tomorrow this module or get_event_bus() can be swapped for a KafkaEventBus / RedisStreamBus.
"""

from abc import ABC, abstractmethod
from collections import defaultdict
from collections.abc import Callable
import logging
from threading import Lock
from typing import Any
from api.events.base import DomainEvent

logger = logging.getLogger(__name__)

EventHandler = Callable[[DomainEvent], Any]


class EventBus(ABC):
    """Abstract Event Bus interface for publishing and subscribing to DomainEvents."""

    @abstractmethod
    def publish(self, event: DomainEvent) -> None:
        """Publish a domain event to all subscribed handlers."""
        pass

    @abstractmethod
    def subscribe(self, event_type: str, handler: EventHandler) -> None:
        """Subscribe a handler callable to a specific event type or wildcard '*'."""
        pass

    @abstractmethod
    def unsubscribe(self, event_type: str, handler: EventHandler) -> None:
        """Unsubscribe a previously registered handler."""
        pass


class InMemoryEventBus(EventBus):
    """
    Synchronous thread-safe In-Memory Event Bus.

    Features:
    - Exact matching (e.g. 'portfolio.asset_bought') and wildcard subscription ('*')
    - Fault isolation: one subscriber exception is logged and never breaks other subscribers
    - Event history ledger: retains recent events in memory for diagnostics, audits, and unit tests
    """

    def __init__(self, max_history: int = 1000):
        self._subscribers: dict[str, list[EventHandler]] = defaultdict(list)
        self._lock = Lock()
        self._history: list[DomainEvent] = []
        self._max_history = max_history

    def subscribe(self, event_type: str, handler: EventHandler) -> None:
        """Subscribe handler to event_type. Use '*' to receive all events."""
        with self._lock:
            if handler not in self._subscribers[event_type]:
                self._subscribers[event_type].append(handler)
                logger.debug(f"[EventBus] Subscribed {handler.__name__} to '{event_type}'")

    def unsubscribe(self, event_type: str, handler: EventHandler) -> None:
        with self._lock:
            if handler in self._subscribers[event_type]:
                self._subscribers[event_type].remove(handler)
                logger.debug(f"[EventBus] Unsubscribed {handler.__name__} from '{event_type}'")

    def publish(self, event: DomainEvent) -> None:
        """
        Publish an event to all matching subscribers.
        Catches subscriber exceptions to guarantee fault-isolation.
        """
        handlers_to_invoke: list[EventHandler] = []

        with self._lock:
            # Append to history with bounds
            self._history.append(event)
            if len(self._history) > self._max_history:
                self._history.pop(0)

            # Collect matching handlers
            handlers_to_invoke.extend(self._subscribers.get(event.event_type, []))
            handlers_to_invoke.extend(self._subscribers.get("*", []))

        # Invoke outside lock to prevent deadlocks
        for handler in handlers_to_invoke:
            try:
                handler(event)
            except Exception as ex:
                logger.error(
                    f"[EventBus] Error in handler {getattr(handler, '__name__', repr(handler))} "
                    f"for event {event.event_type} ({event.event_id}): {ex}",
                    exc_info=True,
                )

    def get_history(
        self,
        event_type: str | None = None,
        aggregate_id: str | None = None,
        limit: int = 100,
    ) -> list[DomainEvent]:
        """Query recent in-memory event history (useful for verification and tests)."""
        with self._lock:
            events = list(self._history)

        if event_type:
            events = [e for e in events if e.event_type == event_type]
        if aggregate_id:
            events = [e for e in events if e.aggregate_id == aggregate_id]

        return events[-limit:]

    def clear(self) -> None:
        """Clear all subscribers and history (primarily for test isolation)."""
        with self._lock:
            self._subscribers.clear()
            self._history.clear()


# ---------------------------------------------------------------------------
# Global Singleton Seam
# ---------------------------------------------------------------------------
_default_bus: EventBus = InMemoryEventBus()


def get_event_bus() -> EventBus:
    """Return the active global event bus instance."""
    return _default_bus


def set_event_bus(bus: EventBus) -> None:
    """Configure or replace the global event bus (e.g. for testing or Kafka swap)."""
    global _default_bus
    _default_bus = bus
