"""Fix permission_id type

Revision ID: c838d976042a
Revises: cf4cd4207336
Create Date: 2025-04-03 21:56:37.466032
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers
revision: str = 'c838d976042a'
down_revision: Union[str, None] = 'cf4cd4207336'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    
    # 將 permissions.id 改為 Integer（確保與 permission_id 一致）
    op.alter_column(
        'permissions', 'id',
        existing_type=mysql.BIGINT(),
        type_=sa.Integer(),
        existing_nullable=False,
        autoincrement=True
    )

    # 將 role_permissions.permission_id 改為 Integer
    op.alter_column(
        'role_permissions', 'permission_id',
        existing_type=mysql.BIGINT(),
        type_=sa.Integer(),
        existing_nullable=True
    )

    # 補上正確的外鍵 constraint
    op.create_foreign_key(
        'role_permissions_ibfk_2',
        'role_permissions',
        'permissions',
        ['permission_id'],
        ['id'],
        ondelete='CASCADE'
    )

    # candidate 改成 JSON 型別（可選）
    op.alter_column(
        'votes', 'candidate',
        existing_type=mysql.VARCHAR(length=255),
        type_=sa.JSON(),
        existing_nullable=False
    )

    # created_at 改成 DateTime（這段 OK）
    op.alter_column(
        'tickets', 'created_at',
        existing_type=mysql.TIMESTAMP(),
        type_=sa.DateTime(),
        existing_nullable=True,
        existing_server_default=sa.text('CURRENT_TIMESTAMP')
    )


def downgrade() -> None:
     # 1. 先移除 index（不是 FK constraint）
    op.drop_index('role_permissions_ibfk_2', table_name='role_permissions')

    # 2. 確保 permission_id 是 Integer
    op.alter_column(
        'role_permissions',
        'permission_id',
        existing_type=sa.Integer(),  # 如果之前是 String 就改 sa.String(length=36)
        type_=sa.Integer(),
        existing_nullable=True
    )

    # 3. 補上正確的 FK
    op.create_foreign_key(
        'fk_role_permissions_permission_id',
        'role_permissions',
        'permissions',
        ['permission_id'],
        ['id'],
        ondelete='CASCADE'
    )
    # 還原 created_at
    op.alter_column(
        'tickets', 'created_at',
        existing_type=sa.DateTime(),
        type_=mysql.TIMESTAMP(),
        existing_nullable=True,
        existing_server_default=sa.text('CURRENT_TIMESTAMP')
    )

    # 還原 candidate 欄位型別
    op.alter_column(
        'votes', 'candidate',
        existing_type=sa.JSON(),
        type_=mysql.VARCHAR(length=255),
        existing_nullable=False
    )

    # 移除新的 FK
    op.drop_constraint('role_permissions_ibfk_2', 'role_permissions', type_='foreignkey')

    # 還原欄位型別
    op.alter_column(
        'role_permissions', 'permission_id',
        existing_type=sa.Integer(),
        type_=mysql.BIGINT(),
        existing_nullable=True
    )

    op.alter_column(
        'permissions', 'id',
        existing_type=sa.Integer(),
        type_=mysql.BIGINT(),
        existing_nullable=False,
        autoincrement=True
    )

    # 補回外鍵（可選）
    op.create_foreign_key(
        'role_permissions_ibfk_2',
        'role_permissions',
        'permissions',
        ['permission_id'],
        ['id']
    )
