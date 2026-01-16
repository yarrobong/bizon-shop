# Миграция данных с локальной БД на сервер

Этот набор скриптов позволяет экспортировать все данные из локальной базы данных и импортировать их на сервер.

## Шаги для миграции:

### 1. Настройка переменных окружения

Убедитесь, что в вашем `.env` файле есть:
- `DATABASE_URL_LOCAL` - строка подключения к локальной БД (или используйте `DATABASE_URL` для локальной)
- `DATABASE_URL` - строка подключения к серверной БД (или отдельные переменные `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME`)

### 2. Экспорт данных из локальной БД

```bash
node migrations/export_data.js
```

Этот скрипт:
- Подключится к локальной БД
- Экспортирует все данные из следующих таблиц:
  - `categories`
  - `products`
  - `product_variants_link`
  - `attractions`
  - `attraction_images`
  - `attraction_videos`
  - `orders`
  - `order_items`
  - `sessions`
- Сохранит данные в `migrations/exported_data/` в формате JSON

### 3. Импорт данных на сервер

```bash
node migrations/import_data.js
```

Этот скрипт:
- Подключится к серверной БД
- Импортирует все данные из экспортированных файлов
- Если запись с таким `id` уже существует, она будет обновлена
- Если записи нет, она будет создана

## Важные замечания:

1. **Резервное копирование**: Перед импортом рекомендуется сделать резервную копию серверной БД
2. **Порядок импорта**: Скрипт автоматически импортирует данные в правильном порядке с учетом зависимостей
3. **Дубликаты**: Скрипт проверяет существование записей по `id` и обновляет их, если они уже существуют
4. **Ошибки**: Если таблица не существует на сервере, она будет пропущена с предупреждением

## Структура экспортированных данных:

```
migrations/exported_data/
  ├── all_data.json          # Все данные в одном файле
  ├── categories.json
  ├── products.json
  ├── product_variants_link.json
  ├── attractions.json
  ├── attraction_images.json
  ├── attraction_videos.json
  ├── orders.json
  ├── order_items.json
  └── sessions.json
```

## Пример использования:

```bash
# 1. Экспорт из локальной БД
DATABASE_URL_LOCAL="postgres://user:pass@localhost:5432/local_db" node migrations/export_data.js

# 2. Импорт на сервер
DATABASE_URL="postgres://user:pass@server:5432/server_db" node migrations/import_data.js
```
