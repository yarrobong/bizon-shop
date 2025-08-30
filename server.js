// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const bcrypt = require('bcryptjs');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));




// === Подключение к БД (только на Render) ===
let pool;
if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
}

// === API: Получить товары ===
app.get('/api/products', async (req, res) => {
  try {
   
    if (pool) {
      // На Render — из БД
      
      // Предполагая, что таблица products имеет колонки: id, title, description, price, tag, available, category, brand, compatibility, images_json
      const result = await pool.query(`
        SELECT 
          id, title, description, price, tag, available, category, brand, compatibility,
          images_json as images -- Преобразуем images_json в images для фронтенда
        FROM products 
        WHERE available = true 
        ORDER BY id
      `);
      
      res.json(result.rows); // Теперь каждая строка имеет поле 'images'
    } else {
      console.warn('Подключение к БД не настроено или pool не инициализирован. Возвращается пустой список.');
      res.json([]);
    }
  } catch (err) {
    console.error('Ошибка загрузки товаров:', err);
    res.status(500).json({ error: 'Не удалось загрузить товары' });
  }
});

// === API: Оформить заказ ===
app.post('/api/order', async (req, res) => {
  const { phone, comment, cart } = req.body;

  // 1. Базовые проверки
  if (!phone || !cart || cart.length === 0) {
    return res.status(400).json({ success: false, error: 'Недостаточно данных' });
  }

  // 2. Рассчитываем общую сумму
  const total = cart.reduce((sum, item) => sum + (item.product?.price || 0) * item.qty, 0);

  // 3. Подготавливаем сообщение для Telegram (как у вас было)
  const message = `
📦 *Новый заказ на BIZON!*
📞 *Телефон:* \`${phone}\`
💬 *Комментарий:* ${comment || 'не указан'}
🛒 *Товары:*
${cart.map(item => `• ${item.product?.title || 'Неизвестный товар'} ×${item.qty} — ${(item.product?.price || 0) * item.qty} ₽`).join('\n')}
💰 *Итого:* ${total} ₽
🕐 ${new Date().toLocaleString('ru-RU')}
  `.trim();

  // 4. Начинаем транзакцию (если возможно) или просто последовательные запросы
  // Важно: обработка ошибок должна откатывать изменения, если часть операций прошла успешно
  try {
    let orderId = null;

    // 5. Вставка основной информации о заказе в БД
    if (pool) { // Проверяем, есть ли подключение к БД
     
        const orderResult = await pool.query(
          'INSERT INTO orders (phone, comment, total_amount) VALUES ($1, $2, $3) RETURNING id',
          [phone, comment || '', total]
        );
        orderId = orderResult.rows[0].id;
       
    } else {
        console.warn('Подключение к БД отсутствует. Заказ не будет сохранен в БД.');
    }

    // 6. Вставка позиций заказа в БД
    if (pool && orderId) {
       
        // Подготавливаем данные для batch insert
        const itemInserts = cart.map(item => [
            orderId,
            item.product?.id,
            item.product?.title || 'Неизвестный товар',
            item.qty,
            item.product?.price || 0
        ]);

        // Используем pg-format или строим SQL вручную для batch insert
        // Пример с построением SQL (подходит для небольших объемов):
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
            
        }
    }

    // 7. Отправка сообщения в Telegram
   
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    // Исправленный URL (убран лишний пробел)
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      }
    );


    // 8. Отправка успешного ответа клиенту
    res.json({ success: true });

  } catch (error) {
    console.error('Ошибка обработки заказа:', error);
    // Отправляем клиенту сообщение об ошибке
    res.status(500).json({ success: false, error: 'Ошибка обработки заказа на сервере' });
    // Важно: в production среде не стоит показывать клиенту детали внутренней ошибки сервера
  }
});
// server.js
// ... (всё, что у тебя уже есть вверху файла)

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
    const { title, description, price, tag, available, category, brand, compatibility, images } = req.body;
    
    // Преобразуем images обратно в JSON для хранения в БД
    const images_json = images ? JSON.stringify(images) : null;

    if (pool) {
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
    res.status(500).json({ error: 'Не удалось создать товар' });
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
      // Обновленный запрос с корректной обработкой NULL значений
      const result = await pool.query(`
        SELECT 
          o.id, 
          o.phone, 
          o.comment, 
          o.total_amount, 
          o.created_at, 
          o.status,
          COALESCE((
            SELECT json_agg(
              json_build_object(
                'product', json_build_object(
                  'id', oi.product_id, 
                  'title', oi.product_title, 
                  'price', oi.price_per_unit
                ), 
                'qty', oi.quantity
              )
            )
            FROM order_items oi 
            WHERE oi.order_id = o.id
          ), '[]') as cart
        FROM orders o
        ORDER BY o.created_at DESC
      `);
      
      // Обрабатываем результаты, чтобы корректно отобразить NULL значения
      const orders = result.rows.map(order => ({
        ...order,
        phone: order.phone || '',
        comment: order.comment || '',
        status: order.status || 'новый',
        cart: order.cart || []
      }));
      
      res.json(orders);
    } else {
      res.status(500).json({ error: 'База данных не настроена' });
    }
  } catch (err) {
    console.error('Ошибка загрузки заказов:', err);
    console.error('Stack trace:', err.stack);
    res.status(500).json({ error: 'Не удалось загрузить заказы: ' + err.message });
  }
});

// ... (всё, что у тебя уже есть внизу файла)


app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
});