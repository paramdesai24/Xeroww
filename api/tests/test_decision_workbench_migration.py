"""Regression coverage for PostgreSQL enum creation order."""

from contextlib import nullcontext
from unittest.mock import patch

import sqlalchemy as sa

from api.database.migrations.versions import (
    c8f4d2a1b930_add_decision_workbench as migration,
)


class _BatchOperations:
    def __init__(self, actions: list[tuple[str, str]]) -> None:
        self.actions = actions

    def add_column(self, column: sa.Column) -> None:
        type_name = getattr(column.type, "name", None)
        self.actions.append(("add_column", type_name or column.name))

    def create_foreign_key(self, *args, **kwargs) -> None:
        return None

    def create_index(self, *args, **kwargs) -> None:
        return None


class _Operations:
    def __init__(self, actions: list[tuple[str, str]]) -> None:
        self.actions = actions

    def get_bind(self) -> object:
        return object()

    def batch_alter_table(self, table_name: str):
        return nullcontext(_BatchOperations(self.actions))

    def create_table(self, *args, **kwargs) -> None:
        return None

    def create_index(self, *args, **kwargs) -> None:
        return None


def test_named_enums_are_created_before_alter_table_uses_them(monkeypatch) -> None:
    actions: list[tuple[str, str]] = []
    monkeypatch.setattr(migration, "op", _Operations(actions))
    monkeypatch.setattr(
        migration.sa,
        "inspect",
        lambda bind: type("Inspector", (), {"has_table": lambda self, name: False})(),
    )

    def record_create(enum, bind, checkfirst=False):
        assert checkfirst is True
        actions.append(("create_enum", enum.name))

    with patch.object(sa.Enum, "create", autospec=True, side_effect=record_create):
        migration.upgrade()

    for enum_name in ("decisiondirection", "decisionintent", "decisionsource"):
        assert actions.index(("create_enum", enum_name)) < actions.index(("add_column", enum_name))
