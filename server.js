// server.js
require('dotenv').config();

// Временный вывод для отладки (можете удалить в production)
console.log('=== Environment Variables ===');
console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '[СКРЫТ]' : 'undefined');
console.log('DB_NAME:', process.env.DB_NAME);
console.log('============================');

const express = require('express');
const path = require('path');
const fs = require('fs').promises; // Используем промисы для fs
const axios = require('axios');
const bcrypt = require('bcryptjs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

const { Pool } = require('pg');

// --- MIDDLEWARE ---
// 1. Парсинг JSON тела запроса
app.use(express.json());

// 2. Статические файлы (CSS, JS, изображения, HTML-страницы типа index.html)
// Должно идти до кастомных маршрутов, чтобы обслуживать статику напрямую
app.use(express.static(path.join(__dirname, 'public')));

// --- API МАРШРУТЫ ---
// Все API маршруты должны идти ДО универсального маршрута :page и обработчика 404

// Настройка хранилища для multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Убедитесь, что папка public/uploads существует
    cb(null, path.join(__dirname, 'public', 'uploads'));
  },
  filename: function (req, file, cb) {
    // Генерируем уникальное имя файла
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Endpoint для загрузки файлов
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не был загружен' });
  }
  // Возвращаем путь, по которому файл будет доступен через статику
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// === Подключение к БД ===
const pool = new Pool({
  connectionString: process.env.DATABASE_URL && process.env.DATABASE_URL !== 'undefined'
    ? process.env.DATABASE_URL
    : `postgres://${process.env.DB_USER}:${encodeURIComponent(process.env.DB_PASSWORD)}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  // Отключаем SSL для локального подключения
  ssl: process.env.DB_HOST === 'localhost' || process.env.DB_HOST === '127.0.0.1' ? false : {
    rejectUnauthorized: false
  }
});

// Обработчики ошибок пула
pool.on('error', (err) => {
  console.error('Неожиданная ошибка в пуле подключений PostgreSQL:', err);
  process.exit(-1);
});

// Проверка подключения при запуске приложения
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Ошибка подключения к БД при запуске:', err.message);
    console.error('Код ошибки:', err.code);
  } else {
    console.log('✅ Успешное подключение к БД. Текущее время на сервере:', res.rows[0].now);
  }
});

// Установка часового пояса (лучше делать на уровне ОС или БД, но можно и так)
process.env.TZ = 'Europe/Moscow';

// --- API: Товары ---
async function getProducts() {
  try {
    const res = await pool.query('SELECT * FROM products');
    return res.rows;
  } catch (err) {
    console.error('Ошибка загрузки товаров:', err);
    return [];
  }
}

// Пример использования (можно удалить в production)
(async () => {
  try {
    const products = await getProducts();
    console.log('Товары из БД (при запуске):', products.length);
  } catch (err) {
    console.error('Ошибка при загрузке товаров в примере:', err);
  }
})();

// Экспорт для использования в других модулях
module.exports = { pool, getProducts };


// === API: Получить товары ===
app.get('/api/products', async (req, res) => {
  try {
    // 1. Получите все товары из таблицы products
    const productsResult = await pool.query('SELECT * FROM products');
    let products = productsResult.rows;

    // 2. Для каждого товара проверьте, есть ли у него варианты
    const productsWithVariants = await Promise.all(products.map(async (product) => {
      // Найдем все product_id из той же группы, что и product.id
      const variantsResult = await pool.query(
        `SELECT p.* 
         FROM product_variants_link pvl1
         JOIN product_variants_link pvl2 ON pvl1.group_id = pvl2.group_id
         JOIN products p ON pvl2.product_id = p.id
         WHERE pvl1.product_id = $1 AND p.id != $1`, // Исключаем сам товар
        [product.id]
      );

      // Если варианты найдены, добавим их к товару
      if (variantsResult.rows.length > 0) {
        // Форматируем изображения из JSON
        const formattedVariants = variantsResult.rows.map(variant => ({
          ...variant,
          images: variant.images_json ? JSON.parse(variant.images_json) : []
        }));

        return {
          ...product,
          images: product.images_json ? JSON.parse(product.images_json) : [],
          variants: formattedVariants // Добавляем массив вариантов
        };
      } else {
        // Если вариантов нет, просто форматируем изображения
        return {
          ...product,
          images: product.images_json ? JSON.parse(product.images_json) : [],
          variants: [] // Пустой массив вариантов
        };
      }
    }));

    res.json(productsWithVariants);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// === API: Получить товар по ID ===
app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT
        id, title, description, price, tag, available, category, brand, compatibility,
        supplier_link, supplier_notes, -- Добавлены новые поля
        images_json as images
      FROM products
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка загрузки товара:', err);
    res.status(500).json({ error: 'Не удалось загрузить товар' });
  }
});

// === API: Создать товар ===
app.post('/api/products', async (req, res) => {
  try {
    // Добавлены новые поля supplier_link, supplier_notes
    const { title, description, price, tag, available, category, brand, compatibility, supplier_link, supplier_notes, images } = req.body;

    const images_json = images ? JSON.stringify(images) : null;

    const result = await pool.query(`
      INSERT INTO products (title, description, price, tag, available, category, brand, compatibility, supplier_link, supplier_notes, images_json) -- Добавлены новые поля
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) -- Добавлены $9, $10, $11
      RETURNING id, title, description, price, tag, available, category, brand, compatibility, supplier_link, supplier_notes, images_json as images -- Добавлены новые поля
    `, [title, description, price, tag, available, category, brand, compatibility, supplier_link, supplier_notes, images_json]); // Добавлены новые параметры

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка создания товара:', err);
    res.status(500).json({ error: 'Не удалось создать товар' });
  }
});

// === API: Обновить товар ===
app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Добавлены новые поля supplier_link, supplier_notes
    const { title, description, price, tag, available, category, brand, compatibility, supplier_link, supplier_notes, images } = req.body;

    const images_json = images ? JSON.stringify(images) : null;

    const result = await pool.query(`
      UPDATE products
      SET title = $1, description = $2, price = $3, tag = $4, available = $5, category = $6, brand = $7, compatibility = $8, supplier_link = $9, supplier_notes = $10, images_json = $11 -- Добавлены новые поля
      WHERE id = $12 -- ID теперь $12
      RETURNING id, title, description, price, tag, available, category, brand, compatibility, supplier_link, supplier_notes, images_json as images -- Добавлены новые поля
    `, [title, description, price, tag, available, category, brand, compatibility, supplier_link, supplier_notes, images_json, id]); // Добавлены новые параметры, ID стал последним

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка обновления товара:', err);
    res.status(500).json({ error: 'Не удалось обновить товар' });
  }
});


// === API: Удалить товар ===
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }
    res.status(204).send(); // 204 No Content - успешно удалено
  } catch (err) {
    console.error('Ошибка удаления товара:', err);
    res.status(500).json({ error: 'Не удалось удалить товар' });
  }
});

// --- API: Категории ---
// === API: Получить категории ===
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM categories ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка загрузки категорий:', err);
    res.status(500).json({ error: 'Не удалось загрузить категории' });
  }
});

// === API: Создать категорию ===
app.post('/api/categories', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Название категории обязательно' });
    }

    const result = await pool.query(
      'INSERT INTO categories (name) VALUES ($1) RETURNING id, name',
      [name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка создания категории:', err);
    res.status(500).json({ error: 'Не удалось создать категорию' });
  }
});

// === API: Удалить категорию ===
app.delete('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Категория не найдена' });
    }
    res.status(204).send(); // 204 No Content - успешно удалено
  } catch (err) {
    console.error('Ошибка удаления категории:', err);
    res.status(500).json({ error: 'Не удалось удалить категорию' });
  }
});

// --- API: Заказы ---
// === API: Оформить заказ ===
app.post('/api/order', async (req, res) => {
  console.log('=== НАЧАЛО ОБРАБОТКИ ЗАКАЗА ===');
  console.log('Полученные данные:', req.body);

  const { phone, comment, cart } = req.body;

  if (!phone || !cart || cart.length === 0) {
    console.log('ОШИБКА: Недостаточно данных');
    return res.status(400).json({ success: false, error: 'Недостаточно данных' });
  }

  const requestHash = JSON.stringify({ phone, comment, cart });
  if (req.app.locals.lastOrderRequest === requestHash) {
    console.log('ПРЕДУПРЕЖДЕНИЕ: Повторный запрос с теми же данными обнаружен');
    return res.status(200).json({
      success: true,
      message: 'Заказ уже обрабатывается',
      orderId: req.app.locals.lastOrderId || null
    });
  }

  req.app.locals.lastOrderRequest = requestHash;
  setTimeout(() => {
    if (req.app.locals.lastOrderRequest === requestHash) {
      req.app.locals.lastOrderRequest = null;
      req.app.locals.lastOrderId = null;
    }
  }, 30000);

  let orderId = null;
  let orderSaved = false;
  let telegramSent = false;

  try {
    const total = cart.reduce((sum, item) => sum + (item.product?.price || 0) * item.qty, 0);
    console.log('Рассчитанная сумма:', total);

    const moscowTimeObj = new Date(new Date().toLocaleString("en-US", { timeZone: 'Europe/Moscow' }));
    const moscowTimeString = moscowTimeObj.toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    console.log('Время заказа (Москва):', moscowTimeString);

    if (pool) {
      console.log('Сохранение заказа в БД...');
      const orderResult = await pool.query(
        'INSERT INTO orders (phone, comment, total_amount, created_at) VALUES ($1, $2, $3, $4) RETURNING id',
        [phone, comment || '', total, moscowTimeObj]
      );
      orderId = orderResult.rows[0].id;
      orderSaved = true;
      req.app.locals.lastOrderId = orderId;
      console.log('Заказ сохранен в БД с ID:', orderId);
    } else {
      console.warn('Подключение к БД отсутствует. Заказ не будет сохранен в БД.');
    }

    if (pool && orderId) {
      console.log('Сохранение позиций заказа в БД...');
      const itemInserts = cart.map(item => [
        orderId,
        item.product?.id,
        item.product?.title || 'Неизвестный товар',
        item.qty,
        item.product?.price || 0
      ]);

      if (itemInserts.length > 0) {
        const queryText = 'INSERT INTO order_items (order_id, product_id, product_title, quantity, price_per_unit) VALUES ';
        const queryValues = [];
        const placeholders = itemInserts.map((_, index) => {
          const start = index * 5 + 1;
          return `($${start}, $${start + 1}, $${start + 2}, $${start + 3}, $${start + 4})`;
        }).join(', ');

        itemInserts.forEach(item => {
          queryValues.push(...item);
        });

        await pool.query(queryText + placeholders, queryValues);
        console.log('Позиции заказа сохранены в БД');
      }
    }

    const cleanPhone = phone.replace(/[^0-9+]/g, '');

    const message = `
📦 *Новый заказ на BIZON!*
📞 *Телефон:* \`${cleanPhone}\`
💬 *Комментарий:* ${comment || 'не указан'}
🛒 *Товары:*
${cart.map(item => `• ${item.product?.title || 'Неизвестный товар'} ×${item.qty} — ${(item.product?.price || 0) * item.qty} ₽`).join('\n')}
💰 *Итого:* ${total} ₽
🕐 ${moscowTimeString}
`.trim();

    console.log('Подготовленное сообщение для Telegram:', message);

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (BOT_TOKEN && CHAT_ID) {
      try {
        console.log('Отправка сообщения в Telegram...');
        await axios.post(
          `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
          {
            chat_id: CHAT_ID,
            text: message,
            parse_mode: 'Markdown',
            disable_web_page_preview: true
          }
        );
        telegramSent = true;
        console.log('Сообщение успешно отправлено в Telegram');
      } catch (telegramError) {
        console.error('Ошибка отправки в Telegram:', telegramError.message);
      }
    } else {
      console.warn('Токен Telegram бота или ID чата не настроены');
    }

    console.log('=== ЗАКАЗ УСПЕШНО ОБРАБОТАН ===');
    res.json({
      success: true,
      orderId: orderId,
      savedToDB: orderSaved,
      sentToTelegram: telegramSent
    });

  } catch (error) {
    console.error('КРИТИЧЕСКАЯ ОШИБКА обработки заказа:', error);
    req.app.locals.lastOrderRequest = null;
    req.app.locals.lastOrderId = null;
    res.status(500).json({ success: false, error: 'Ошибка обработки заказа на сервере' });
  }
});

// === API: Получить заказы ===
app.get('/api/orders', async (req, res) => {
  try {
    const ordersResult = await pool.query(`
      SELECT
        id,
        phone,
        comment,
        total_amount,
        created_at,
        COALESCE(status, 'новый') as status
      FROM orders
      ORDER BY created_at DESC
    `);

    const ordersWithItems = await Promise.all(ordersResult.rows.map(async (order) => {
      const itemsResult = await pool.query(`
        SELECT
          product_id,
          product_title,
          quantity,
          price_per_unit,
          (quantity * price_per_unit) as total_price
        FROM order_items
        WHERE order_id = $1
        ORDER BY id
      `, [order.id]);

      return {
        ...order,
        items: itemsResult.rows || []
      };
    }));

    res.json(ordersWithItems);
  } catch (err) {
    console.error('Ошибка загрузки заказов:', err);
    res.status(500).json({ error: 'Не удалось загрузить заказы: ' + err.message });
  }
});

// === API: Обновить статус заказа ===
app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['новый', 'в обработке', 'отправлен', 'доставлен', 'отменен'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Недопустимый статус' });
    }

    const result = await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING id',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Заказ не найден' });
    }

    res.json({ success: true, message: 'Статус обновлен' });
  } catch (err) {
    console.error('Ошибка обновления статуса заказа:', err);
    res.status(500).json({ error: 'Не удалось обновить статус заказа' });
  }
});

// === API: Удалить заказ ===
app.delete('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Сначала удаляем все позиции заказа
    await pool.query('DELETE FROM order_items WHERE order_id = $1', [id]);

    // Потом удаляем сам заказ
    const result = await pool.query('DELETE FROM orders WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Заказ не найден' });
    }

    res.json({ success: true, message: 'Заказ удален успешно' });
  } catch (err) {
    console.error('Ошибка удаления заказа:', err);
    res.status(500).json({ error: 'Не удалось удалить заказ: ' + err.message });
  }
});

// --- API: Аутентификация ---
// === API: Логин администратора ===
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Логин и пароль обязательны' });
    }

    if (!pool) {
      console.error('Подключение к БД не настроено');
      return res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }

    const result = await pool.query(
      'SELECT id, username, password_hash FROM admin_users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Неверный логин или пароль' });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Неверный логин или пароль' });
    }

    res.json({ success: true, message: 'Авторизация успешна' });

  } catch (err) {
    console.error('Ошибка авторизации:', err);
    res.status(500).json({ success: false, message: 'Ошибка сервера при авторизации' });
  }
});

// --- API: Обратная связь ---
// === API: Обратный звонок (Контактная форма) ===
app.post('/api/contact', async (req, res) => {
  console.log('=== НАЧАЛО ОБРАБОТКИ ЗАЯВКИ НА ОБРАТНЫЙ ЗВОНОК ===');
  console.log('Полученные данные:', req.body);

  const { name, phone } = req.body;

  if (!phone) {
    console.log('ОШИБКА: Не указан номер телефона');
    return res.status(400).json({ success: false, error: 'Не указан номер телефона' });
  }

  const requestHash = JSON.stringify({ name, phone });
  if (req.app.locals.lastContactRequest === requestHash) {
    console.log('ПРЕДУПРЕЖДЕНИЕ: Повторный запрос с теми же данными обнаружен');
    return res.status(200).json({
      success: true,
      message: 'Заявка уже обрабатывается'
    });
  }

  req.app.locals.lastContactRequest = requestHash;
  setTimeout(() => {
    if (req.app.locals.lastContactRequest === requestHash) {
      req.app.locals.lastContactRequest = null;
    }
  }, 30000);

  let dbSaved = false;
  let telegramSent = false;

  try {
    const moscowTimeObj = new Date(new Date().toLocaleString("en-US", { timeZone: 'Europe/Moscow' }));
    const moscowTimeString = moscowTimeObj.toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    console.log('Время заявки (Москва):', moscowTimeString);

    const cleanPhone = phone.replace(/[^0-9+]/g, '');

    const message = `
📞 *Новая заявка на обратный звонок BIZON!*
👤 *Имя:* ${name || 'не указано'}
📱 *Телефон:* \`${cleanPhone}\`
🕐 ${moscowTimeString}
`.trim();

    console.log('Подготовленное сообщение для Telegram:', message);

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (BOT_TOKEN && CHAT_ID) {
      try {
        console.log('Отправка сообщения в Telegram...');
        await axios.post(
          `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
          {
            chat_id: CHAT_ID,
            text: message,
            parse_mode: 'Markdown',
            disable_web_page_preview: true
          }
        );
        telegramSent = true;
        console.log('Сообщение успешно отправлено в Telegram');
      } catch (telegramError) {
        console.error('Ошибка отправки в Telegram:', telegramError.message);
      }
    } else {
      console.warn('Токен Telegram бота или ID чата не настроены');
    }

    console.log('=== ЗАЯВКА УСПЕШНО ОБРАБОТАНА ===');
    res.json({
      success: true,
      savedToDB: dbSaved,
      sentToTelegram: telegramSent
    });

  } catch (error) {
    console.error('КРИТИЧЕСКАЯ ОШИБКА обработки заявки:', error);
    req.app.locals.lastContactRequest = null;
    res.status(500).json({ success: false, error: 'Ошибка обработки заявки на сервере' });
  }
});


// --- КАСТОМНЫЕ МАРШРУТЫ ДЛЯ HTML СТРАНИЦ ---
// Универсальный маршрут для отдачи .html страниц (например, /catalog -> public/catalog.html)
// Должен идти ПОСЛЕ API, но ДО обработчика 404
app.get('/:page', async (req, res, next) => {
  // Исключаем API из этого маршрута, чтобы не перехватывать запросы к /api/...
  if (req.path.startsWith('/api/')) {
    // Если путь начинается с /api/, пропускаем этот маршрут
    return next();
  }

  const filePath = path.join(__dirname, 'public', `${req.params.page}.html`);

  try {
    // Используем fs.promises для асинхронной проверки
    await fs.access(filePath); // Проверяет существование файла
    const stats = await fs.stat(filePath);
    if (stats.isFile()) {
      return res.sendFile(filePath);
    }
    // Если это не файл (например, директория), передаем дальше
    next();
  } catch (err) {
    // Файл не найден, передаем управление дальше
    next();
  }
});


// --- ОБРАБОТЧИК 404 ---
// Должен быть ПОСЛЕДНИМ
app.use((req, res, next) => {
  console.log(`404 Not Found: ${req.originalUrl}`); // Для отладки
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// --- ЗАПУСК СЕРВЕРА ---
app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
});