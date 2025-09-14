// server.js
require('dotenv').config();

// Временный вывод для отладки
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
const fs = require('fs');
const axios = require('axios');
const bcrypt = require('bcryptjs'); // ✅ Только один раз
const multer = require('multer');


const app = express();
const PORT = process.env.PORT || 3000;

const { Pool } = require('pg');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
    console.log('Товары из БД:', products.length);
  } catch (err) {
    console.error('Ошибка при загрузке товаров в примере:', err);
  }
})();

// Экспорт для использования в других модулях
module.exports = { pool, getProducts };

// Установка часового пояса
process.env.TZ = 'Europe/Moscow';
// Настройка хранилища для multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Убедитесь, что папка существует
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
// ВАЖНО: Этот маршрут должен быть ДО ваших других app.use и app.get/app.post
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не был загружен' });
  }
  // Возвращаем путь, по которому файл будет доступен через статику
  // Предполагаем, что Nginx настроен отдавать /uploads из /public/uploads
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// === API: Получить товары ===
app.get('/api/products', async (req, res) => {
  try {
    // Проверяем, запрашивает ли админ-панель все товары
    const isAdmin = req.query.admin === 'true';
    
    let query = `
      SELECT 
        id, title, description, price, tag, available, category, brand, compatibility,
        images_json as images
      FROM products 
    `;
    
    // Только для обычных пользователей фильтруем по доступности
    // Для админа показываем все товары
    if (!isAdmin) {
      query += ' WHERE available = true ';
    }
    
    query += ' ORDER BY id';
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка загрузки товаров:', err);
    res.status(500).json({ error: 'Не удалось загрузить товары' });
  }
});
// === API: Оформить заказ ===
app.post('/api/order', async (req, res) => {
  console.log('=== НАЧАЛО ОБРАБОТКИ ЗАКАЗА ===');
  console.log('Полученные данные:', req.body);

  const { phone, comment, cart } = req.body;

  // 1. Базовые проверки
  if (!phone || !cart || cart.length === 0) {
    console.log('ОШИБКА: Недостаточно данных');
    return res.status(400).json({ success: false, error: 'Недостаточно данных' });
  }

  // 2. Проверка на дублирование запроса
  const requestHash = JSON.stringify({ phone, comment, cart });
  if (req.app.locals.lastOrderRequest === requestHash) {
    console.log('ПРЕДУПРЕЖДЕНИЕ: Повторный запрос с теми же данными обнаружен');
    return res.status(200).json({ 
      success: true, 
      message: 'Заказ уже обрабатывается',
      orderId: req.app.locals.lastOrderId || null
    });
  }
  
  // Сохраняем хэш последнего запроса
  req.app.locals.lastOrderRequest = requestHash;
  
  // Очищаем хэш через 30 секунд
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
    // 3. Рассчитываем общую сумму
    const total = cart.reduce((sum, item) => sum + (item.product?.price || 0) * item.qty, 0);
    console.log('Рассчитанная сумма:', total);

    // 4. Получаем московское время для сохранения в БД и Telegram
    const moscowTimeObj = new Date(new Date().toLocaleString("en-US", {timeZone: 'Europe/Moscow'}));
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

    // 5. Вставка основной информации о заказе в БД
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

    // 6. Вставка позиций заказа в БД
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
          return `($${start}, $${start+1}, $${start+2}, $${start+3}, $${start+4})`;
        }).join(', ');

        itemInserts.forEach(item => {
          queryValues.push(...item);
        });

        await pool.query(queryText + placeholders, queryValues);
        console.log('Позиции заказа сохранены в БД');
      }
    }
    const cleanPhone = phone.replace(/[^0-9+]/g, '');

    // 7. Подготавливаем сообщение для Telegram
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

    // 8. Отправка сообщения в Telegram
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
        // Не прерываем выполнение, если Telegram не работает
      }
    } else {
      console.warn('Токен Telegram бота или ID чата не настроены');
    }

    // 9. Отправка успешного ответа клиенту
    console.log('=== ЗАКАЗ УСПЕШНО ОБРАБОТАН ===');
    res.json({ 
      success: true, 
      orderId: orderId,
      savedToDB: orderSaved,
      sentToTelegram: telegramSent
    });

  } catch (error) {
    console.error('КРИТИЧЕСКАЯ ОШИБКА обработки заказа:', error);
    // Очищаем хэш при ошибке, чтобы можно было повторить попытку
    req.app.locals.lastOrderRequest = null;
    req.app.locals.lastOrderId = null;
    
    // Отправляем клиенту сообщение об ошибке
    res.status(500).json({ success: false, error: 'Ошибка обработки заказа на сервере' });
  }
});

// === API: Обратный звонок (Контактная форма) ===
app.post('/api/contact', async (req, res) => {
  console.log('=== НАЧАЛО ОБРАБОТКИ ЗАЯВКИ НА ОБРАТНЫЙ ЗВОНОК ===');
  console.log('Полученные данные:', req.body);

  const { name, phone } = req.body; // Ожидаем name и phone из формы

  // 1. Базовые проверки
  if (!phone) { // Имя может быть опциональным, но телефон обязателен
    console.log('ОШИБКА: Не указан номер телефона');
    return res.status(400).json({ success: false, error: 'Не указан номер телефона' });
  }

  // 2. Проверка на дублирование запроса (по аналогии с заказом)
  const requestHash = JSON.stringify({ name, phone });
  if (req.app.locals.lastContactRequest === requestHash) {
    console.log('ПРЕДУПРЕЖДЕНИЕ: Повторный запрос с теми же данными обнаружен');
    return res.status(200).json({ 
      success: true, 
      message: 'Заявка уже обрабатывается'
    });
  }
  
  // Сохраняем хэш последнего запроса
  req.app.locals.lastContactRequest = requestHash;
  
  // Очищаем хэш через 30 секунд
  setTimeout(() => {
    if (req.app.locals.lastContactRequest === requestHash) {
      req.app.locals.lastContactRequest = null;
    }
  }, 30000);

  let dbSaved = false;
  let telegramSent = false;

  try {
    // 3. Получаем московское время
    const moscowTimeObj = new Date(new Date().toLocaleString("en-US", {timeZone: 'Europe/Moscow'}));
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

    // 4. (Опционально) Сохранение в БД
    // Если у вас есть таблица для заявок, например `callbacks`, раскомментируйте и адаптируйте:
    /*
    if (pool) {
      console.log('Сохранение заявки в БД...');
      const callbackResult = await pool.query(
        'INSERT INTO callbacks (name, phone, created_at) VALUES ($1, $2, $3) RETURNING id',
        [name || '', phone, moscowTimeObj] // name может быть пустым
      );
      dbSaved = true;
      console.log('Заявка сохранена в БД с ID:', callbackResult.rows[0].id);
    } else {
      console.warn('Подключение к БД отсутствует. Заявка не будет сохранена в БД.');
    }
    */
const cleanPhone = phone.replace(/[^0-9+]/g, '');
    // 5. Подготавливаем сообщение для Telegram
    const message = `
📞 *Новая заявка на обратный звонок BIZON!*
👤 *Имя:* ${name || 'не указано'}
📱 *Телефон:* \`${cleanPhone}\`
🕐 ${moscowTimeString}
`.trim();

    console.log('Подготовленное сообщение для Telegram:', message);

    // 6. Отправка сообщения в Telegram (используем те же переменные окружения)
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (BOT_TOKEN && CHAT_ID) {
      try {
        console.log('Отправка сообщения в Telegram...');
        // Исправлен URL (убран лишний пробел)
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
        // Не прерываем выполнение, если Telegram не работает
      }
    } else {
      console.warn('Токен Telegram бота или ID чата не настроены');
    }

    // 7. Отправка успешного ответа клиенту
    console.log('=== ЗАЯВКА УСПЕШНО ОБРАБОТАНА ===');
    res.json({ 
      success: true,
      savedToDB: dbSaved,
      sentToTelegram: telegramSent
    });

  } catch (error) {
    console.error('КРИТИЧЕСКАЯ ОШИБКА обработки заявки:', error);
    // Очищаем хэш при ошибке
    req.app.locals.lastContactRequest = null;
    
    // Отправляем клиенту сообщение об ошибке
    res.status(500).json({ success: false, error: 'Ошибка обработки заявки на сервере' });
  }
});

// === API: Получить товар по ID ===
app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (pool) {
      const result = await pool.query(`
        SELECT 
          id, title, description, price, tag, available, category, brand, compatibility,
          images_json as images
        FROM products 
        WHERE id = $1
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Товар не найден' });
      }
      res.json(result.rows[0]);
    } else {
      res.status(500).json({ error: 'База данных не настроена' });
    }
  } catch (err) {
    console.error('Ошибка загрузки товара:', err);
    res.status(500).json({ error: 'Не удалось загрузить товар' });
  }
});

// === API: Создать товар ===
app.post('/api/products', async (req, res) => {
  try {
    // req.body может содержать поле 'id'
    const { id, title, description, price, tag, available, category, brand, compatibility, images } = req.body;

    // Преобразуем images обратно в JSON для хранения в БД
    const images_json = images ? JSON.stringify(images) : null;

    // ПРОБЛЕМА ЧАСТО ЗДЕСЬ: если 'id' передается из req.body и используется в INSERT,
    // а в БД уже есть запись с таким id, будет ошибка.
    // Лучше НЕ передавать 'id' из клиента при создании нового товара.

    if (pool) {
      // ТЕКУЩИЙ КОД (возможно проблемный):
      // const result = await pool.query(`
      //   INSERT INTO products (id, title, description, ...) -- Явное указание id
      //   VALUES ($1, $2, $3, ...)                           -- Передача id из req.body
      //   RETURNING ...
      // `, [id, title, description, ...]);                   -- id в списке

      // ИСПРАВЛЕННЫЙ КОД:
      // Не включаем 'id' в список полей для INSERT и в VALUES, если хотим,
      // чтобы PostgreSQL сам сгенерировал его.
      const result = await pool.query(`
        INSERT INTO products (title, description, price, tag, available, category, brand, compatibility, images_json)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, title, description, price, tag, available, category, brand, compatibility, images_json as images
      `, [title, description, price, tag, available, category, brand, compatibility, images_json]);

      res.status(201).json(result.rows[0]);
    } else {
      res.status(500).json({ error: 'База данных не настроена' });
    }
  } catch (err) {
    console.error('Ошибка создания товара:', err);
    // ... логика обработки ошибки
  }
});

// === API: Обновить товар ===
app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, price, tag, available, category, brand, compatibility, images } = req.body;
    
    // Преобразуем images обратно в JSON для хранения в БД
    const images_json = images ? JSON.stringify(images) : null;

    if (pool) {
      const result = await pool.query(`
        UPDATE products 
        SET title = $1, description = $2, price = $3, tag = $4, available = $5, category = $6, brand = $7, compatibility = $8, images_json = $9
        WHERE id = $10
        RETURNING id, title, description, price, tag, available, category, brand, compatibility, images_json as images
      `, [title, description, price, tag, available, category, brand, compatibility, images_json, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Товар не найден' });
      }
      res.json(result.rows[0]);
    } else {
      res.status(500).json({ error: 'База данных не настроена' });
    }
  } catch (err) {
    console.error('Ошибка обновления товара:', err);
    res.status(500).json({ error: 'Не удалось обновить товар' });
  }
});

// === API: Удалить товар ===
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (pool) {
      const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Товар не найден' });
      }
      res.status(204).send(); // 204 No Content - успешно удалено
    } else {
      res.status(500).json({ error: 'База данных не настроена' });
    }
  } catch (err) {
    console.error('Ошибка удаления товара:', err);
    res.status(500).json({ error: 'Не удалось удалить товар' });
  }
});

// === API: Получить категории ===
app.get('/api/categories', async (req, res) => {
  try {
    if (pool) {
      // Предполагаем, что у вас есть таблица categories с полями id и name
      const result = await pool.query('SELECT id, name FROM categories ORDER BY name');
      res.json(result.rows);
    } else {
      // Если таблицы нет, возвращаем пустой массив или стандартные категории
      console.warn('Таблица категорий не найдена или pool не инициализирован.');
      res.json([]); // Или res.json([{id: 1, name: 'электроника'}, ...]);
    }
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

        if (pool) {
            const result = await pool.query(
                'INSERT INTO categories (name) VALUES ($1) RETURNING id, name',
                [name]
            );
            res.status(201).json(result.rows[0]);
        } else {
            res.status(500).json({ error: 'База данных не настроена' });
        }
    } catch (err) {
        console.error('Ошибка создания категории:', err);
        res.status(500).json({ error: 'Не удалось создать категорию' });
    }
});

// === API: Логин администратора ===
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Базовая валидация
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Логин и пароль обязательны' });
    }

    // 2. Проверяем, есть ли подключение к БД
    if (!pool) {
      console.error('Подключение к БД не настроено');
      return res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }

    // 3. Ищем пользователя в БД
    const result = await pool.query(
      'SELECT id, username, password_hash FROM admin_users WHERE username = $1',
      [username]
    );

    // 4. Проверяем, найден ли пользователь
    if (result.rows.length === 0) {
      // В целях безопасности не раскрываем, что пользователь не существует
      return res.status(401).json({ success: false, message: 'Неверный логин или пароль' });
    }

    const user = result.rows[0];

    // 5. Сравниваем хэш пароля
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Неверный логин или пароль' });
    }

    // 6. Если всё верно, возвращаем успех
    // В реальном приложении здесь бы создавался JWT токен
    res.json({ success: true, message: 'Авторизация успешна' });

  } catch (err) {
    console.error('Ошибка авторизации:', err);
    res.status(500).json({ success: false, message: 'Ошибка сервера при авторизации' });
  }
});

// === API: Удалить категорию ===
app.delete('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (pool) {
      const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING id', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Категория не найдена' });
      }
      res.status(204).send(); // 204 No Content - успешно удалено
    } else {
      res.status(500).json({ error: 'База данных не настроена' });
    }
  } catch (err) {
    console.error('Ошибка удаления категории:', err);
    res.status(500).json({ error: 'Не удалось удалить категорию' });
  }
});

// === API: Получить заказы ===
app.get('/api/orders', async (req, res) => {
  try {
    if (pool) {
      // Сначала получаем все заказы
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

      // Для каждого заказа получаем его позиции
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
          items: itemsResult.rows || [] // Передаем позиции с price_per_unit
        };
      }));

      res.json(ordersWithItems);
    } else {
      res.status(500).json({ error: 'База данных не настроена' });
    }
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

    // Базовая валидация статуса
    const validStatuses = ['новый', 'в обработке', 'отправлен', 'доставлен', 'отменен'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Недопустимый статус' });
    }

    if (pool) {
      const result = await pool.query(
        'UPDATE orders SET status = $1 WHERE id = $2 RETURNING id',
        [status, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Заказ не найден' });
      }

      res.json({ success: true, message: 'Статус обновлен' });
    } else {
      res.status(500).json({ error: 'База данных не настроена' });
    }
  } catch (err) {
    console.error('Ошибка обновления статуса заказа:', err);
    res.status(500).json({ error: 'Не удалось обновить статус заказа' });
  }
});

// === API: Удалить заказ ===
app.delete('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (pool) {
      // Сначала удаляем все позиции заказа
      await pool.query('DELETE FROM order_items WHERE order_id = $1', [id]);
      
      // Потом удаляем сам заказ
      const result = await pool.query('DELETE FROM orders WHERE id = $1 RETURNING id', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Заказ не найден' });
      }

      res.json({ success: true, message: 'Заказ удален успешно' });
    } else {
      res.status(500).json({ error: 'База данных не настроена' });
    }
  } catch (err) {
    console.error('Ошибка удаления заказа:', err);
    res.status(500).json({ error: 'Не удалось удалить заказ: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
});