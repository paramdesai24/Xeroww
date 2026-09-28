"""Regression coverage for alert history on fresh and pre-created schemas."""

import pytest
import sqlalchemy as sa
from alembic.operations import Operations
from alembic.runtime.migration import MigrationContext

from api.database.migrations.versions import (
    d62f1a7b4e90_add_alert_evaluations as migration,
)


def _tables(metadata: sa.MetaData) -> tuple[sa.Table, sa.Table]:
    alerts = sa.Table("alerts", metadata, sa.Column("id", sa.Integer, primary_key=True))
    evaluations = sa.Table(
        "alert_evaluations",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("alert_id", sa.Integer, sa.ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("evaluated_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("triggered", sa.Boolean, nullable=False),
        sa.Column("observed_value", sa.Float),
        sa.Column("message", sa.String(240), nullable=False),
        sa.Column("data_quality_status", sa.String(24), nullable=False),
    )
    return alerts, evaluations


@pytest.mark.parametrize("precreated", [False, True])
def test_alert_evaluation_upgrade_accepts_fresh_or_precreated_table(monkeypatch, precreated: bool) -> None:
    engine = sa.create_engine("sqlite:///:memory:")
    metadata = sa.MetaData()
    alerts, evaluations = _tables(metadata)

    with engine.begin() as connection:
        metadata.create_all(connection, tables=[alerts, evaluations] if precreated else [alerts])
        if precreated:
            connection.execute(alerts.insert().values(id=1))
            connection.execute(evaluations.insert().values(
                id=1, alert_id=1, triggered=False, message="Observed", data_quality_status="delayed"
            ))

        operations = Operations(MigrationContext.configure(connection))
        monkeypatch.setattr(migration, "op", operations)
        migration.upgrade()
        migration.upgrade()

        inspector = sa.inspect(connection)
        assert inspector.has_table("alert_evaluations")
        assert {index["name"] for index in inspector.get_indexes("alert_evaluations")} == {
            "ix_alert_evaluations_alert_id", "ix_alert_evaluations_evaluated_at"
        }
        if precreated:
            assert connection.scalar(sa.select(sa.func.count()).select_from(evaluations)) == 1


def test_alert_evaluation_upgrade_rejects_incompatible_existing_table(monkeypatch) -> None:
    engine = sa.create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.exec_driver_sql("CREATE TABLE alert_evaluations (id INTEGER PRIMARY KEY)")
        monkeypatch.setattr(migration, "op", Operations(MigrationContext.configure(connection)))

        with pytest.raises(RuntimeError, match="does not match the expected schema"):
            migration.upgrade()
