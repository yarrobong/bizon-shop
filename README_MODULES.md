# Модульная структура сервера

## Быстрый старт

1. **Используйте новый сервер:**
   ```bash
   node server-new.js
   ```

2. **Или переименуйте (после тестирования):**
   ```bash
   mv server.js server-old.js
   mv server-new.js server.js
   node server.js
   ```

## Основные изменения

### ✅ Защита от SQL-инъекций
Все SQL-запросы используют параметризованные запросы:
```javascript
// ✅ Безопасно
await pool.query('SELECT * FROM products WHERE id = $1', [productId]);

// ❌ НЕ используйте конкатенацию строк
await pool.query(`SELECT * FROM products WHERE id = ${productId}`);
```

### ✅ Защита API
- **Публичные API** (`/api/products`, `/api/order`) - доступны всем, но только для чтения доступных товаров
- **Админские API** (`/api/admin/*`) - требуют аутентификации через `/api/login`

### ✅ Rate Limiting
- Публичные API: 100 запросов в 15 минут
- Логин: 5 попыток в 15 минут
- Заказы: 3 заказа в минуту

## Структура

```
config/
  ├── db.js          # Подключение к БД
  └── multer.js      # Загрузка файлов

middleware/
  ├── auth.js        # requireAuth() - проверка сессии
  └── rateLimit.js   # Ограничение запросов

routes/
  ├── public.js      # Публичные API (товары, заказы)
  ├── admin.js       # Админские API (требуют auth)
  ├── auth.js        # /api/login, /api/logout
  └── upload.js      # /api/upload (требует auth)

utils/
  ├── parseImages.js # Парсинг images_json
  └── slug.js        # Генерация slug
```

## Примеры использования

### Публичный доступ (товары)
```javascript
// Получить все доступные товары
GET /api/products

// Получить товар по ID
GET /api/products/123

// Получить товар по slug
GET /api/product-by-slug/my-product
```

### Админский доступ
```javascript
// 1. Войти
POST /api/login
Body: { "username": "admin", "password": "password" }
Response: { "sessionId": "abc123...", "user": {...} }

// 2. Использовать sessionId в заголовках
GET /api/admin/products?show_all=true
Headers: { "x-session-id": "abc123..." }

// 3. Выйти
POST /api/logout
Headers: { "x-session-id": "abc123..." }
```

## Что нужно перенести

Текущая версия включает только основные маршруты. Остальные нужно перенести из `server.js`:

- [x] `/api/attractions/*` → `routes/attractions.js`
- [x] `/api/categories/*` → `routes/categories.js`
- [x] `/generate_proposal*` → `routes/proposals.js`

## Безопасность

### ✅ Реализовано:
- Параметризованные SQL-запросы
- Аутентификация для админских API
- Rate limiting
- Валидация входных данных

### ⚠️ Для продакшена рекомендуется:
- Redis для сессий
- JWT токены
- HTTPS
- helmet.js
- CORS настройки

