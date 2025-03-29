# Alembic
// 新增 migration
alembic revision --autogenerate -m "Add group_id to events"
// 升級 migration
alembic upgrade head
// 降級 migration
alembic downgrade -1
// 查看 migration 歷史
alembic history

