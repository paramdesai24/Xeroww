"""Add compact, persistent alert evaluation history.

Revision ID: d62f1a7b4e90
Revises: a91c40f62d77
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d62f1a7b4e90"
down_revision: Union[str, None] = "a91c40f62d77"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
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
    op.create_index("ix_alert_evaluations_alert_id", "alert_evaluations", ["alert_id"])
    op.create_index("ix_alert_evaluations_evaluated_at", "alert_evaluations", ["evaluated_at"])


def downgrade() -> None:
    op.drop_index("ix_alert_evaluations_evaluated_at", table_name="alert_evaluations")
    op.drop_index("ix_alert_evaluations_alert_id", table_name="alert_evaluations")
    op.drop_table("alert_evaluations")
