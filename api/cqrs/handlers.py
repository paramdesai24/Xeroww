"""
api/cqrs/handlers.py
────────────────────
Handler protocols and buses for CQRS Commands and Queries.

Provides an architectural dispatch boundary between API routes and Domain Services.
Enables transparent transition from local in-process dispatch to Kafka / RPC workers.
"""

from abc import ABC, abstractmethod
from typing import Any, Protocol, TypeVar
from api.cqrs.commands import Command
from api.cqrs.queries import Query

TCommand = TypeVar("TCommand", bound=Command)
TQuery = TypeVar("TQuery", bound=Query)
TResult = TypeVar("TResult")


class CommandHandler(Protocol[TCommand, TResult]):
    """Protocol for executing state-mutating commands."""

    def handle(self, command: TCommand) -> TResult:
        ...


class QueryHandler(Protocol[TQuery, TResult]):
    """Protocol for resolving read-only queries."""

    def handle(self, query: TQuery) -> TResult:
        ...


class CommandBus(ABC):
    """Abstract Command Bus for routing commands to their designated handler."""

    @abstractmethod
    def dispatch(self, command: Command) -> Any:
        pass


class QueryBus(ABC):
    """Abstract Query Bus for resolving queries via registered handlers."""

    @abstractmethod
    def ask(self, query: Query) -> Any:
        pass
