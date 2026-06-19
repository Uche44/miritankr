"""add driver bank columns

Revision ID: a1b2c3d4e5f6
Revises: d064f0eb630e
Create Date: 2026-06-18 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'd064f0eb630e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('drivers', sa.Column('bank_code', sa.String(length=50), nullable=True))
    op.add_column('drivers', sa.Column('bank_name', sa.String(length=100), nullable=True))
    op.add_column('drivers', sa.Column('account_number', sa.String(length=50), nullable=True))
    op.add_column('drivers', sa.Column('account_name', sa.String(length=200), nullable=True))


def downgrade() -> None:
    op.drop_column('drivers', 'account_name')
    op.drop_column('drivers', 'account_number')
    op.drop_column('drivers', 'bank_name')
    op.drop_column('drivers', 'bank_code')
