# Быстрая проверка работы сессий

## Автоматический тест

Запустите тестовый скрипт:

```bash
node migrations/test_sessions.js
```

Скрипт проверит:
- ✅ Структуру таблицы sessions
- ✅ Создание сессий
- ✅ Валидацию сессий
- ✅ Обновление last_activity
- ✅ Удаление сессий
- ✅ Очистку истекших сессий
- ✅ Foreign keys

## Ручная проверка

### 1. Проверка структуры БД

```sql
-- Проверка таблицы
SELECT * FROM information_schema.tables WHERE table_name = 'sessions';

-- Проверка колонок
\d sessions

-- Проверка индексов
SELECT indexname FROM pg_indexes WHERE tablename = 'sessions';
```

### 2. Проверка создания сессии

1. Войдите в админ панель через браузер
2. Проверьте в БД:

```sql
SELECT session_id, username, created_at, expires_at 
FROM sessions 
ORDER BY created_at DESC 
LIMIT 5;
```

Должна появиться новая запись с вашим username.

### 3. Проверка обновления last_activity

1. Выполните любой запрос в админ панели (например, загрузите список товаров)
2. Проверьте в БД:

```sql
SELECT session_id, last_activity, created_at 
FROM sessions 
WHERE username = 'ваш_username'
ORDER BY last_activity DESC 
LIMIT 1;
```

`last_activity` должен обновиться.

### 4. Проверка удаления сессии

1. Выйдите из админ панели (кнопка "Выход")
2. Проверьте в БД:

```sql
SELECT COUNT(*) FROM sessions WHERE username = 'ваш_username';
```

Сессия должна быть удалена (COUNT = 0).

### 5. Проверка очистки истекших сессий

Создайте истекшую сессию вручную:

```sql
-- Получите user_id
SELECT id FROM admin_users WHERE username = 'ваш_username';

-- Создайте истекшую сессию (замените YOUR_USER_ID)
INSERT INTO sessions (session_id, user_id, username, created_at, last_activity, expires_at)
VALUES (
  'test_expired_' || md5(random()::text),
  YOUR_USER_ID,
  'ваш_username',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '1 day'
);
```

Подождите 30 минут или перезапустите сервер. Сессия должна быть удалена автоматически.

## Проверка через API

### Тест логина

```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"ваш_username","password":"ваш_пароль"}'
```

Должен вернуться `sessionId`. Проверьте в БД:

```sql
SELECT * FROM sessions WHERE session_id = 'полученный_sessionId';
```

### Тест защищенного эндпоинта

```bash
curl -X GET http://localhost:3000/api/admin/products \
  -H "x-session-id: ваш_sessionId"
```

Должен вернуться список товаров. Проверьте обновление `last_activity`:

```sql
SELECT last_activity FROM sessions WHERE session_id = 'ваш_sessionId';
```

### Тест выхода

```bash
curl -X POST http://localhost:3000/api/logout \
  -H "x-session-id: ваш_sessionId"
```

Проверьте, что сессия удалена:

```sql
SELECT * FROM sessions WHERE session_id = 'ваш_sessionId';
```

Должно вернуть 0 строк.

## Ожидаемое поведение

✅ **При логине:**
- Создается запись в таблице `sessions`
- `expires_at` = текущее время + 24 часа

✅ **При каждом запросе:**
- `last_activity` обновляется на текущее время
- Сессия проверяется на валидность (не истекла)

✅ **При выходе:**
- Запись удаляется из таблицы `sessions`

✅ **Автоматическая очистка:**
- Истекшие сессии удаляются каждые 30 минут
- Очистка происходит при старте сервера

## Проблемы?

Если что-то не работает:

1. **Проверьте, что миграция применена:**
   ```sql
   SELECT * FROM information_schema.tables WHERE table_name = 'sessions';
   ```

2. **Проверьте логи сервера** на наличие ошибок

3. **Проверьте права доступа** к БД

4. **Проверьте, что таблица `admin_users` существует** (сессии ссылаются на неё)
