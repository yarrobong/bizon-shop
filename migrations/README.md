# Миграции базы данных

## Применение миграций

### 1. Создание таблицы sessions

Выполните SQL скрипт для создания таблицы сессий:

```bash
psql -U your_user -d your_database -f migrations/create_sessions_table.sql
```

Или через psql интерактивно:

```sql
\i migrations/create_sessions_table.sql
```

Или скопируйте содержимое файла `create_sessions_table.sql` и выполните в вашем клиенте PostgreSQL.

### 2. Проверка

После применения миграции проверьте, что таблица создана:

```sql
SELECT * FROM information_schema.tables WHERE table_name = 'sessions';
```

Проверьте индексы:

```sql
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'sessions';
```

## Откат миграции (если нужно)

Если нужно удалить таблицу sessions:

```sql
DROP TABLE IF EXISTS sessions CASCADE;
```

**Внимание:** Это удалит все активные сессии!
