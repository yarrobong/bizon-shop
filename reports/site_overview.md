# Обзор работы сайта BIZON

## Архитектура
- Сервер Express из `server-new.js` отдает статику из `public/`, подключает PostgreSQL (`config/db.js`) и настраивает маршруты.
- Публичные маршруты `/api` для каталога, заказов, обратной связи; отдельные HTML-роуты для страниц товара и аттракциона, остальные идут в `404.html`.
- Админ-функции и загрузка файлов защищены сессиями в памяти (24 часа) через `x-session-id`.

## Ключевые маршруты
- Каталог: `GET /api/products` (публично доступные, либо все при `admin=true` и сессии), `GET /api/products/:id`, `GET /api/product-by-slug/:slug`.
- Заказы: `POST /api/order` — валидация телефона/корзины, запись заказа и позиций в БД, уведомление в Telegram, защита rate limit + антидубликат.
- Обратная связь: `POST /api/contact` — антидубликат, отправка в Telegram.
- Админ: CRUD для товаров (`/api/products`), категорий (`/api/categories`), заказов (`/api/orders`), аттракционов (`/api/attractions`), загрузка файлов (`/api/upload`), просмотр заказов (`/api/admin/orders`).
- Коммерческие предложения: `POST /generate_proposal` (HTML) и `POST /generate_proposal_pdf` (PDF via Puppeteer).
- Аттракционы: публичные списки, поиск по slug, YML-фид `/api/attractions/yml`; админские CRUD.

## Фронтенд (папка `public/`)
- Страницы: `index.html`, `catalog.html`, `product.html` (товар по slug), `cart.html`, `attractions.html`, `productAttractions.html`, `proposal_form.html`, `contact.html`, `admin.html` и др.
- `js/state.js` — хранение корзины в `localStorage`, функции `addToCart`, `getCart`, `clearCart`, `updateCartCount`.
- `js/product.js` — загружает товар по slug, выводит галерею и варианты, добавляет в корзину.
- `js/cart.js` — отображение корзины, изменение количества, отправка заказа на `/api/order` с валидацией и очисткой корзины после успеха.
- `js/proposal_form.js` — выбор товаров из `/api/products_for_proposal`, расчёт суммы, отправка на генерацию HTML/PDF.
- `js/main.js` — навигация, мобильное меню, FAQ-аккордеон, cookie-баннер, отложенная Яндекс.Метрика (только после согласия).
- Трекинг: Calltouch скрипты; цель Яндекс.Метрики `cart_order_submit` при оформлении заказа.

## Конфигурация и зависимости
- БД: PostgreSQL, DSN из `DATABASE_URL` или `DB_*`; SSL отключено для localhost.
- Нотификации: `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` для заказов и контактов.
- Часовой пояс сервера фиксирован на `Europe/Moscow`; rate limit и сессии в памяти (для продакшена лучше внешний стор).


