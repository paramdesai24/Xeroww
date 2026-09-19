"""add decision workbench

Revision ID: c8f4d2a1b930
Revises: 9e47b354fec1
Create Date: 2026-09-19 14:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c8f4d2a1b930"
down_revision: Union[str, None] = "9e47b354fec1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    decision_direction = sa.Enum("BULLISH", "BEARISH", "NEUTRAL", name="decisiondirection")
    decision_intent = sa.Enum("ENTER", "ADD", "HOLD", "REDUCE", "EXIT", "WATCH", "AVOID", name="decisionintent")
    decision_source = sa.Enum("MANUAL", "MARKET", "REPLAY", "PORTFOLIO", name="decisionsource")
    amendment_type = sa.Enum(
        "OBSERVATION", "THESIS_REVISION", "RISK_REVISION", "STATUS_CHANGE", name="amendmenttype"
    )

    with op.batch_alter_table("decision_journal_entries") as batch_op:
        batch_op.add_column(sa.Column("ticket_version", sa.Integer(), server_default="0", nullable=False))
        batch_op.add_column(sa.Column("direction", decision_direction, nullable=True))
        batch_op.add_column(sa.Column("intent", decision_intent, nullable=True))
        batch_op.add_column(sa.Column("holding_period", sa.String(length=40), nullable=True))
        batch_op.add_column(sa.Column("setup_type", sa.String(length=80), nullable=True))
        batch_op.add_column(sa.Column("entry_trigger", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("entry_zone_low", sa.Numeric(18, 4), nullable=True))
        batch_op.add_column(sa.Column("entry_zone_high", sa.Numeric(18, 4), nullable=True))
        batch_op.add_column(sa.Column("invalidation_price", sa.Numeric(18, 4), nullable=True))
        batch_op.add_column(sa.Column("target_zone_low", sa.Numeric(18, 4), nullable=True))
        batch_op.add_column(sa.Column("target_zone_high", sa.Numeric(18, 4), nullable=True))
        batch_op.add_column(sa.Column("max_risk_pct", sa.Numeric(7, 4), nullable=True))
        batch_op.add_column(sa.Column("max_allocation_pct", sa.Numeric(7, 4), nullable=True))
        batch_op.add_column(sa.Column("confidence", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("change_mind_condition", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("portfolio_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("source_context", decision_source, nullable=True))
        batch_op.add_column(sa.Column("source_as_of", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("source_period", sa.String(length=10), nullable=True))
        batch_op.add_column(sa.Column("snapshot_schema_version", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("snapshot_hash", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("supporting_evidence_keys", sa.JSON(), server_default="[]", nullable=False))
        batch_op.add_column(sa.Column("conflicting_evidence_keys", sa.JSON(), server_default="[]", nullable=False))
        batch_op.add_column(sa.Column("risk_snapshot", sa.JSON(), server_default="{}", nullable=False))
        batch_op.add_column(sa.Column("submitted_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("closed_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("version", sa.Integer(), server_default="1", nullable=False))
        batch_op.create_foreign_key(
            "fk_decision_journal_entries_portfolio_id", "portfolios", ["portfolio_id"], ["id"], ondelete="SET NULL"
        )
        batch_op.create_index("ix_decision_journal_entries_portfolio_id", ["portfolio_id"])
        batch_op.create_index("ix_decision_journal_entries_snapshot_hash", ["snapshot_hash"])
        batch_op.create_index("ix_decision_user_timestamp", ["user_id", "timestamp"])
        batch_op.create_index("ix_decision_user_status_timestamp", ["user_id", "status", "timestamp"])
        batch_op.create_index("ix_decision_user_symbol_timestamp", ["user_id", "symbol", "timestamp"])

    # Local development can auto-create newly registered tables before Alembic
    # upgrades an older database. Keep this migration safe for that transition.
    if not sa.inspect(bind).has_table("decision_ticket_amendments"):
        op.create_table(
            "decision_ticket_amendments",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("decision_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("amendment_type", amendment_type, nullable=False),
            sa.Column("reason", sa.Text(), nullable=False),
            sa.Column("payload", sa.JSON(), nullable=False),
            sa.Column("from_status", sa.String(length=20), nullable=True),
            sa.Column("to_status", sa.String(length=20), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
            sa.ForeignKeyConstraint(["decision_id"], ["decision_journal_entries.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_decision_ticket_amendments_decision_id", "decision_ticket_amendments", ["decision_id"])
        op.create_index("ix_decision_ticket_amendments_user_id", "decision_ticket_amendments", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_decision_ticket_amendments_user_id", table_name="decision_ticket_amendments")
    op.drop_index("ix_decision_ticket_amendments_decision_id", table_name="decision_ticket_amendments")
    op.drop_table("decision_ticket_amendments")

    with op.batch_alter_table("decision_journal_entries") as batch_op:
        batch_op.drop_index("ix_decision_user_symbol_timestamp")
        batch_op.drop_index("ix_decision_user_status_timestamp")
        batch_op.drop_index("ix_decision_user_timestamp")
        batch_op.drop_index("ix_decision_journal_entries_snapshot_hash")
        batch_op.drop_index("ix_decision_journal_entries_portfolio_id")
        batch_op.drop_constraint("fk_decision_journal_entries_portfolio_id", type_="foreignkey")
        for column in (
            "version", "closed_at", "submitted_at", "risk_snapshot", "conflicting_evidence_keys",
            "supporting_evidence_keys", "snapshot_hash", "snapshot_schema_version", "source_period",
            "source_as_of", "source_context", "portfolio_id", "change_mind_condition", "confidence",
            "max_allocation_pct", "max_risk_pct", "target_zone_high", "target_zone_low",
            "invalidation_price", "entry_zone_high", "entry_zone_low", "entry_trigger", "setup_type",
            "holding_period", "intent", "direction", "ticket_version",
        ):
            batch_op.drop_column(column)

    sa.Enum(name="amendmenttype").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="decisionsource").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="decisionintent").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="decisiondirection").drop(op.get_bind(), checkfirst=True)
