"""
api/events/handlers.py
──────────────────────
Default domain event subscribers and handlers.

Demonstrates decoupled side-effects:
- Logging / audit trail
- Cross-domain reactive flows (e.g. trade execution triggering alert evaluation)
- Future seam: forwarding events to Apache Kafka producer
"""

import logging
from api.events.base import DomainEvent
from api.events.bus import EventBus

logger = logging.getLogger("api.events")


def log_event_subscriber(event: DomainEvent) -> None:
    """
    Diagnostic / audit subscriber.
    Prints every domain event that transits through the event bus.
    """
    try:
        from api.services.health_registry import record_ws_message
        record_ws_message(1)
    except Exception:
        pass

    logger.info(
        f"[DOMAIN EVENT] {event.event_type} "
        f"| aggregate={event.aggregate_id} "
        f"| payload={event.payload}"
    )


def portfolio_trade_notification_handler(event: DomainEvent) -> None:
    """
    Decoupled handler reacting to portfolio trades.
    In production, this fans out to push notifications or webhook integrations.
    """
    symbol = event.payload.get("symbol", "")
    quantity = event.payload.get("quantity", 0)
    price = event.payload.get("price", 0)
    logger.info(
        f"[PORTFOLIO REACTION] Trade executed on {symbol}: "
        f"{quantity} units @ Rs.{price:,.2f}"
    )


def alert_triggered_notification_handler(event: DomainEvent) -> None:
    """
    Decoupled handler reacting to triggered alerts.
    In production, this routes to WebSocket / SMS / email notification pipelines.
    """
    symbol = event.payload.get("symbol", "")
    reason = event.payload.get("reason", "")
    price = event.payload.get("trigger_price")
    price_str = f" @ Rs.{price:,.2f}" if price else ""
    logger.warning(
        f"[ALERT TRIGGERED] {symbol}{price_str}: {reason}"
    )


def pattern_detected_handler(event: DomainEvent) -> None:
    """
    Decoupled handler reacting to detected technical patterns.
    Can be consumed by strategy backtesters or automated execution pipelines.
    """
    symbol = event.payload.get("symbol", "")
    pattern_name = event.payload.get("pattern_name", "")
    direction = event.payload.get("direction", "")
    confidence = event.payload.get("confidence", 0)
    logger.info(
        f"[PATTERN REACTION] {symbol} {pattern_name} ({direction}, conf={confidence:.2f})"
    )


def register_default_handlers(bus: EventBus) -> None:
    """
    Register core platform event handlers on startup.
    Called inside FastAPI lifespan handler.
    """
    # Wildcard logger for transparency & auditing
    bus.subscribe("*", log_event_subscriber)

    # Specialized domain reactions
    bus.subscribe("portfolio.asset_bought", portfolio_trade_notification_handler)
    bus.subscribe("portfolio.asset_sold", portfolio_trade_notification_handler)
    bus.subscribe("alert.triggered", alert_triggered_notification_handler)
    bus.subscribe("market.pattern_detected", pattern_detected_handler)

    logger.info("Domain event bus default handlers registered successfully.")

