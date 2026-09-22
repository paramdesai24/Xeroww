"""add replay and portfolio intelligence

Revision ID: a91c40f62d77
Revises: c8f4d2a1b930
Create Date: 2026-09-22 12:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a91c40f62d77"
down_revision: Union[str, None] = "c8f4d2a1b930"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("replay_sessions"):
        op.create_table(
            "replay_sessions",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("symbol", sa.String(length=30), nullable=False),
            sa.Column("symbol_was_randomized", sa.Boolean(), nullable=False),
            sa.Column("start_was_randomized", sa.Boolean(), nullable=False),
            sa.Column("hide_symbol", sa.Boolean(), nullable=False),
            sa.Column("hide_calendar_date", sa.Boolean(), nullable=False),
            sa.Column("timeframe", sa.String(length=10), nullable=False),
            sa.Column("source_period", sa.String(length=10), nullable=False),
            sa.Column("starting_capital", sa.Numeric(18, 4), nullable=False),
            sa.Column("current_cash", sa.Numeric(18, 4), nullable=False),
            sa.Column("maximum_risk_pct", sa.Numeric(7, 4), nullable=False),
            sa.Column("setup_category", sa.String(length=80), nullable=True),
            sa.Column("start_index", sa.Integer(), nullable=False),
            sa.Column("current_index", sa.Integer(), nullable=False),
            sa.Column("end_index", sa.Integer(), nullable=False),
            sa.Column("warmup_start_index", sa.Integer(), nullable=False),
            sa.Column("started_at_market_time", sa.DateTime(), nullable=False),
            sa.Column("current_market_time", sa.DateTime(), nullable=False),
            sa.Column("ended_at_market_time", sa.DateTime(), nullable=True),
            sa.Column("completion_reason", sa.String(length=32), nullable=True),
            sa.Column("random_seed", sa.String(length=64), nullable=False),
            sa.Column("dataset_fingerprint", sa.String(length=64), nullable=False),
            sa.Column("dataset_payload", sa.JSON(), nullable=False),
            sa.Column("analytics_version", sa.String(length=40), nullable=False),
            sa.Column("scoring_version", sa.String(length=40), nullable=False),
            sa.Column("version", sa.Integer(), server_default="1", nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("completed_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_replay_sessions_user_id", "replay_sessions", ["user_id"])
        op.create_index("ix_replay_sessions_status", "replay_sessions", ["status"])
        op.create_index("ix_replay_sessions_symbol", "replay_sessions", ["symbol"])
        op.create_index("ix_replay_sessions_dataset_fingerprint", "replay_sessions", ["dataset_fingerprint"])

    if not inspector.has_table("replay_session_events"):
        op.create_table(
            "replay_session_events",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("session_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("sequence_number", sa.Integer(), nullable=False),
            sa.Column("event_type", sa.String(length=60), nullable=False),
            sa.Column("replay_index", sa.Integer(), nullable=False),
            sa.Column("simulated_at", sa.DateTime(), nullable=False),
            sa.Column("occurred_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("decision_id", sa.Integer(), nullable=True),
            sa.Column("idempotency_key", sa.String(length=80), nullable=True),
            sa.Column("payload", sa.JSON(), nullable=False),
            sa.Column("evidence_snapshot_hash", sa.String(length=64), nullable=True),
            sa.Column("schema_version", sa.Integer(), server_default="1", nullable=False),
            sa.ForeignKeyConstraint(["session_id"], ["replay_sessions.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["decision_id"], ["decision_journal_entries.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("session_id", "sequence_number", name="uq_replay_event_sequence"),
            sa.UniqueConstraint("session_id", "idempotency_key", name="uq_replay_event_idempotency"),
        )
        op.create_index("ix_replay_session_events_session_id", "replay_session_events", ["session_id"])
        op.create_index("ix_replay_session_events_user_id", "replay_session_events", ["user_id"])
        op.create_index("ix_replay_session_events_event_type", "replay_session_events", ["event_type"])
        op.create_index("ix_replay_session_events_decision_id", "replay_session_events", ["decision_id"])

    if not inspector.has_table("replay_executions"):
        op.create_table(
            "replay_executions",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("session_id", sa.Integer(), nullable=False),
            sa.Column("decision_id", sa.Integer(), nullable=False),
            sa.Column("event_id", sa.Integer(), nullable=True),
            sa.Column("side", sa.String(length=12), nullable=False),
            sa.Column("quantity", sa.Numeric(18, 6), nullable=False),
            sa.Column("price", sa.Numeric(18, 4), nullable=False),
            sa.Column("replay_index", sa.Integer(), nullable=False),
            sa.Column("simulated_at", sa.DateTime(), nullable=False),
            sa.Column("reason", sa.String(length=40), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["session_id"], ["replay_sessions.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["decision_id"], ["decision_journal_entries.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["event_id"], ["replay_session_events.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_replay_executions_session_id", "replay_executions", ["session_id"])
        op.create_index("ix_replay_executions_decision_id", "replay_executions", ["decision_id"])

    if not inspector.has_table("replay_session_results"):
        op.create_table(
            "replay_session_results",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("session_id", sa.Integer(), nullable=False),
            sa.Column("process_score", sa.Numeric(7, 2), nullable=True),
            sa.Column("process_grade", sa.String(length=20), nullable=True),
            sa.Column("process_components", sa.JSON(), nullable=False),
            sa.Column("outcome_metrics", sa.JSON(), nullable=False),
            sa.Column("behaviour_observations", sa.JSON(), nullable=False),
            sa.Column("calculation_inputs_hash", sa.String(length=64), nullable=False),
            sa.Column("scoring_version", sa.String(length=40), nullable=False),
            sa.Column("calculated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["session_id"], ["replay_sessions.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("session_id"),
        )
        op.create_index("ix_replay_session_results_session_id", "replay_session_results", ["session_id"], unique=True)

    if not inspector.has_table("portfolio_snapshots"):
        op.create_table(
            "portfolio_snapshots",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("portfolio_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("as_of", sa.DateTime(), nullable=False),
            sa.Column("valuation_date", sa.Date(), nullable=False),
            sa.Column("snapshot_sequence", sa.Integer(), nullable=False),
            sa.Column("cash", sa.Numeric(18, 4), nullable=False),
            sa.Column("holdings_value", sa.Numeric(18, 4), nullable=False),
            sa.Column("total_value", sa.Numeric(18, 4), nullable=False),
            sa.Column("cost_basis", sa.Numeric(18, 4), nullable=False),
            sa.Column("realized_pnl_to_date", sa.Numeric(18, 4), nullable=False),
            sa.Column("unrealized_pnl", sa.Numeric(18, 4), nullable=False),
            sa.Column("benchmark_symbol", sa.String(length=30), nullable=False),
            sa.Column("benchmark_close", sa.Numeric(18, 4), nullable=True),
            sa.Column("open_decision_count", sa.Integer(), nullable=False),
            sa.Column("data_quality", sa.JSON(), nullable=False),
            sa.Column("source_fingerprint", sa.String(length=64), nullable=False),
            sa.Column("valuation_version", sa.String(length=40), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["portfolio_id"], ["portfolios.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "portfolio_id", "valuation_date", "snapshot_sequence", "valuation_version",
                name="uq_portfolio_snapshot_version",
            ),
        )
        op.create_index("ix_portfolio_snapshots_portfolio_id", "portfolio_snapshots", ["portfolio_id"])
        op.create_index("ix_portfolio_snapshots_user_id", "portfolio_snapshots", ["user_id"])
        op.create_index("ix_portfolio_snapshots_as_of", "portfolio_snapshots", ["as_of"])
        op.create_index("ix_portfolio_snapshots_valuation_date", "portfolio_snapshots", ["valuation_date"])
        op.create_index("ix_portfolio_snapshots_source_fingerprint", "portfolio_snapshots", ["source_fingerprint"])

    if not inspector.has_table("portfolio_snapshot_holdings"):
        op.create_table(
            "portfolio_snapshot_holdings",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("snapshot_id", sa.Integer(), nullable=False),
            sa.Column("symbol", sa.String(length=30), nullable=False),
            sa.Column("sector", sa.String(length=100), nullable=False),
            sa.Column("quantity", sa.Numeric(18, 6), nullable=False),
            sa.Column("average_price", sa.Numeric(18, 4), nullable=False),
            sa.Column("cost_basis", sa.Numeric(18, 4), nullable=False),
            sa.Column("market_price", sa.Numeric(18, 4), nullable=False),
            sa.Column("market_value", sa.Numeric(18, 4), nullable=False),
            sa.Column("unrealized_pnl", sa.Numeric(18, 4), nullable=False),
            sa.Column("portfolio_weight", sa.Numeric(10, 8), nullable=False),
            sa.Column("data_as_of", sa.DateTime(), nullable=True),
            sa.Column("is_stale", sa.Boolean(), nullable=False),
            sa.ForeignKeyConstraint(["snapshot_id"], ["portfolio_snapshots.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("snapshot_id", "symbol", name="uq_snapshot_holding_symbol"),
        )
        op.create_index("ix_portfolio_snapshot_holdings_snapshot_id", "portfolio_snapshot_holdings", ["snapshot_id"])
        op.create_index("ix_portfolio_snapshot_holdings_symbol", "portfolio_snapshot_holdings", ["symbol"])

    if not inspector.has_table("portfolio_risk_policies"):
        op.create_table(
            "portfolio_risk_policies",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("portfolio_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("max_single_stock_pct", sa.Numeric(7, 4), nullable=False),
            sa.Column("max_sector_pct", sa.Numeric(7, 4), nullable=False),
            sa.Column("max_planned_loss_pct", sa.Numeric(7, 4), nullable=False),
            sa.Column("max_total_open_risk_pct", sa.Numeric(7, 4), nullable=False),
            sa.Column("correlation_warning", sa.Numeric(7, 4), nullable=False),
            sa.Column("drawdown_review_pct", sa.Numeric(7, 4), nullable=False),
            sa.Column("minimum_observations", sa.Integer(), nullable=False),
            sa.Column("version", sa.Integer(), server_default="1", nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["portfolio_id"], ["portfolios.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("portfolio_id"),
        )
        op.create_index("ix_portfolio_risk_policies_portfolio_id", "portfolio_risk_policies", ["portfolio_id"], unique=True)
        op.create_index("ix_portfolio_risk_policies_user_id", "portfolio_risk_policies", ["user_id"])

    decision_columns = {column["name"] for column in inspector.get_columns("decision_journal_entries")}
    with op.batch_alter_table("decision_journal_entries") as batch_op:
        if "replay_session_id" not in decision_columns:
            batch_op.add_column(sa.Column("replay_session_id", sa.Integer(), nullable=True))
            batch_op.create_foreign_key(
                "fk_decision_replay_session_id", "replay_sessions", ["replay_session_id"], ["id"], ondelete="SET NULL"
            )
            batch_op.create_index("ix_decision_journal_entries_replay_session_id", ["replay_session_id"])
        if "replay_event_sequence" not in decision_columns:
            batch_op.add_column(sa.Column("replay_event_sequence", sa.Integer(), nullable=True))
        if "replay_index" not in decision_columns:
            batch_op.add_column(sa.Column("replay_index", sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("decision_journal_entries") as batch_op:
        batch_op.drop_index("ix_decision_journal_entries_replay_session_id")
        batch_op.drop_constraint("fk_decision_replay_session_id", type_="foreignkey")
        batch_op.drop_column("replay_index")
        batch_op.drop_column("replay_event_sequence")
        batch_op.drop_column("replay_session_id")

    op.drop_index("ix_portfolio_risk_policies_user_id", table_name="portfolio_risk_policies")
    op.drop_index("ix_portfolio_risk_policies_portfolio_id", table_name="portfolio_risk_policies")
    op.drop_table("portfolio_risk_policies")
    op.drop_index("ix_portfolio_snapshot_holdings_symbol", table_name="portfolio_snapshot_holdings")
    op.drop_index("ix_portfolio_snapshot_holdings_snapshot_id", table_name="portfolio_snapshot_holdings")
    op.drop_table("portfolio_snapshot_holdings")
    op.drop_index("ix_portfolio_snapshots_source_fingerprint", table_name="portfolio_snapshots")
    op.drop_index("ix_portfolio_snapshots_valuation_date", table_name="portfolio_snapshots")
    op.drop_index("ix_portfolio_snapshots_as_of", table_name="portfolio_snapshots")
    op.drop_index("ix_portfolio_snapshots_user_id", table_name="portfolio_snapshots")
    op.drop_index("ix_portfolio_snapshots_portfolio_id", table_name="portfolio_snapshots")
    op.drop_table("portfolio_snapshots")
    op.drop_index("ix_replay_session_results_session_id", table_name="replay_session_results")
    op.drop_table("replay_session_results")
    op.drop_index("ix_replay_executions_decision_id", table_name="replay_executions")
    op.drop_index("ix_replay_executions_session_id", table_name="replay_executions")
    op.drop_table("replay_executions")
    op.drop_index("ix_replay_session_events_decision_id", table_name="replay_session_events")
    op.drop_index("ix_replay_session_events_event_type", table_name="replay_session_events")
    op.drop_index("ix_replay_session_events_user_id", table_name="replay_session_events")
    op.drop_index("ix_replay_session_events_session_id", table_name="replay_session_events")
    op.drop_table("replay_session_events")
    op.drop_index("ix_replay_sessions_dataset_fingerprint", table_name="replay_sessions")
    op.drop_index("ix_replay_sessions_symbol", table_name="replay_sessions")
    op.drop_index("ix_replay_sessions_status", table_name="replay_sessions")
    op.drop_index("ix_replay_sessions_user_id", table_name="replay_sessions")
    op.drop_table("replay_sessions")

