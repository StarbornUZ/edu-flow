"""seed_default_subjects

Revision ID: d3e5f7a9b1c2
Revises: b56d1c96980c
Create Date: 2026-04-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import uuid
from datetime import datetime, timezone


# revision identifiers, used by Alembic.
revision: str = 'd3e5f7a9b1c2'
down_revision: Union[str, None] = 'b56d1c96980c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_SUBJECTS = [
    ("Matematika", "📐"),
    ("Fizika", "⚡"),
    ("Kimyo", "🧪"),
    ("Biologiya", "🌿"),
    ("Informatika", "💻"),
    ("Ingliz tili", "🇬🇧"),
    ("Rus tili", "🇷🇺"),
    ("O'zbek tili va adabiyoti", "📖"),
    ("Tarix", "🏛️"),
    ("Geografiya", "🌍"),
    ("Musiqa", "🎵"),
]


def upgrade() -> None:
    now = datetime.now(timezone.utc)
    subjects_table = sa.table(
        "subjects",
        sa.column("id", sa.UUID),
        sa.column("name", sa.String),
        sa.column("icon", sa.String),
        sa.column("description", sa.String),
        sa.column("is_default", sa.Boolean),
        sa.column("org_id", sa.UUID),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    op.bulk_insert(
        subjects_table,
        [
            {
                "id": uuid.uuid4(),
                "name": name,
                "icon": icon,
                "description": None,
                "is_default": True,
                "org_id": None,
                "created_at": now,
                "updated_at": now,
            }
            for name, icon in DEFAULT_SUBJECTS
        ],
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM subjects WHERE is_default = TRUE AND org_id IS NULL"
    )
