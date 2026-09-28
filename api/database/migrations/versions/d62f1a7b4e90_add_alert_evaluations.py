"""Add compact, persistent alert evaluation history.

Revision ID: d62f1a7b4e90
Revises: a91c40f62d77
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d62f1a7b4e90"
down_revision: str | None = "a91c40f62d77"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    if inspector.has_table("alert_evaluations"):
        actual_columns = {column["name"] for column in inspector.get_columns("alert_evaluations")}
        expected_columns = {
            "id", "alert_id", "evaluated_at", "triggered", "observed_value",
            "message", "data_quality_status",
        }
        missing_columns = expected_columns - actual_columns
        alert_foreign_key = any(
            key["constrained_columns"] == ["alert_id"] and key["referred_table"] == "alerts"
            for key in inspector.get_foreign_keys("alert_evaluations")
        )
        if missing_columns or not alert_foreign_key:
            raise RuntimeError(
                "Existing alert_evaluations table does not match the expected schema. "
                f"Missing columns: {sorted(missing_columns)}; alert foreign key: {alert_foreign_key}. "
                "Back up the database and repair its schema before retrying the migration."
            )
    else:
        op.create_table(
            "alert_evaluations",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("alert_id", sa.Integer(), nullable=False),
            sa.Column("evaluated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("triggered", sa.Boolean(), nullable=False),
            sa.Column("observed_value", sa.Float(), nullable=True),
            sa.Column("message", sa.String(length=240), nullable=False),
            sa.Column("data_quality_status", sa.String(length=24), nullable=False),
            sa.ForeignKeyConstraint(["alert_id"], ["alerts.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    existing_indexes = {index["name"] for index in sa.inspect(connection).get_indexes("alert_evaluations")}
    if "ix_alert_evaluations_alert_id" not in existing_indexes:
        op.create_index("ix_alert_evaluations_alert_id", "alert_evaluations", ["alert_id"])
    if "ix_alert_evaluations_evaluated_at" not in existing_indexes:
        op.create_index("ix_alert_evaluations_evaluated_at", "alert_evaluations", ["evaluated_at"])


def downgrade() -> None:
    op.drop_index("ix_alert_evaluations_evaluated_at", table_name="alert_evaluations")
    op.drop_index("ix_alert_evaluations_alert_id", table_name="alert_evaluations")
    op.drop_table("alert_evaluations")
