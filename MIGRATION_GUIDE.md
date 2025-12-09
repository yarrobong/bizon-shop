# Руководство по миграции на модульную структуру

## Что было сделано

1. **Разделение server.js на модули:**
   - `config/` - конфигурация (БД, multer)
   - `middleware/` - middleware (аутентификация, rate limiting)
   - `routes/` - маршруты (public, admin, auth, upload)
   - `utils/` - утилиты (парсинг изображений, генерация slug)

2. **Защита от SQL-инъекций:**
   - Все SQL-запросы используют параметризованные запросы ($1, $2, ...)
   - Валидация входных данных
   - Проверка типов параметров

3. **Защита API:**
   - Публичные API доступны без аутентификации (только чтение доступных товаров)
   - Админские API требуют аутентификации через `/api/login`
   - Rate limiting для защиты от злоупотреблений
   - Защита от повторных запросов заказов

## Структура файлов

```
bizon-server/
├── config/
│   ├── db.js          # Подключение к PostgreSQL
│   └── multer.js      # Настройка загрузки файлов
├── middleware/
│   ├── auth.js        # Аутентификация и авторизация
│   └── rateLimit.js   # Ограничение количества запросов
├── routes/
│   ├── public.js      # Публичные API (товары, заказы)
│   ├── admin.js       # Админские API (требуют аутентификации)
│   ├── auth.js        # Аутентификация (login, logout)
│   └── upload.js      # Загрузка файлов
├── utils/
│   ├── parseImages.js # Парсинг изображений
│   └── slug.js        # Генерация slug
├── server-new.js      # Новый главный файл сервера
└── server.js          # Старый файл (можно удалить после миграции)
```

## Как использовать

### Вариант 1: Постепенная миграция

1. Запустите новый сервер параллельно:
   ```bash
   node server-new.js
   ```

2. Протестируйте все функции

3. После проверки переименуйте:
   ```bash
   mv server.js server-old.js
   mv server-new.js server.js
   ```

### Вариант 2: Полная замена

1. Создайте резервную копию:
   ```bash
   cp server.js server-backup.js
   ```

2. Замените файл:
   ```bash
   mv server-new.js server.js
   ```

3. Запустите:
   ```bash
   node server.js
   ```

## Что нужно добавить

Текущая версия включает только основные маршруты. Нужно перенести остальные:

- `/api/attractions/*` - аттракционы
- `/api/categories/*` - категории
- `/generate_proposal*` - генерация коммерческих предложений

## Защита API

### Публичные эндпоинты (без аутентификации):
- `GET /api/products` - только доступные товары
- `GET /api/products/:id` - только доступные товары
- `GET /api/product-by-slug/:slug` - только доступные товары
- `POST /api/order` - создание заказа (с rate limiting)
- `POST /api/contact` - обратная связь

### Защищенные эндпоинты (требуют аутентификации):
- `GET /api/admin/*` - все админские операции
- `POST /api/upload` - загрузка файлов

### Аутентификация:
1. Отправьте POST запрос на `/api/login` с `username` и `password`
2. Получите `sessionId` в ответе
3. Добавьте заголовок `x-session-id: <sessionId>` ко всем защищенным запросам

## Пример использования

```javascript
// Логин
const loginResponse = await fetch('/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'password' })
});
const { sessionId } = await loginResponse.json();

// Защищенный запрос
const productsResponse = await fetch('/api/admin/products?show_all=true', {
  headers: { 'x-session-id': sessionId }
});
```

## Безопасность

✅ **Реализовано:**
- Параметризованные SQL-запросы (защита от SQL-инъекций)
- Аутентификация для админских API
- Rate limiting
- Валидация входных данных
- Защита от повторных запросов

⚠️ **Рекомендации для продакшена:**
- Использовать Redis для сессий вместо памяти
- Использовать JWT токены вместо простых sessionId
- Добавить HTTPS
- Использовать helmet.js для безопасности заголовков
- Добавить CORS настройки
- Логирование подозрительной активности

