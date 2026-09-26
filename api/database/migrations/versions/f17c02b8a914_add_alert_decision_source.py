"""Allow alert-originated decisions.

Revision ID: f17c02b8a914
Revises: d62f1a7b4e90
"""

from typing import Sequence, Union
from alembic import op

revision: str = "f17c02b8a914"
down_revision: Union[str, None] = "d62f1a7b4e90"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        with op.get_context().autocommit_block():
            op.execute("ALTER TYPE decisionsource ADD VALUE IF NOT EXISTS 'ALERT'")


def downgrade() -> None:
    # PostgreSQL enum values cannot be dropped safely without rebuilding the type.
    pass
