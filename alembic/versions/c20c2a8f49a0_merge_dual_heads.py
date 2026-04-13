"""merge_dual_heads

Revision ID: c20c2a8f49a0
Revises: 4135dc685f0c, d3e5f7a9b1c2
Create Date: 2026-04-13 11:50:50.022547

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c20c2a8f49a0'
down_revision: Union[str, Sequence[str], None] = ('4135dc685f0c', 'd3e5f7a9b1c2')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
