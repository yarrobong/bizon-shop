// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

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
    console.log('Запрос /api/products. process.env.DATABASE_URL задана?', !!process.env.DATABASE_URL);
    console.log('Pool создан?', !!pool);
    if (pool) {
      // На Render — из БД
      console.log('Выполняется запрос к БД...');
      // Предполагая, что таблица products имеет колонки: id, title, description, price, tag, available, category, brand, compatibility, images_json
      const result = await pool.query(`
        SELECT 
          id, title, description, price, tag, available, category, brand, compatibility,
          images_json as images -- Преобразуем images_json в images для фронтенда
        FROM products 
        WHERE available = true 
        ORDER BY id
      `);
      console.log('Запрос выполнен. Найдено строк:', result.rows.length);
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
        console.log('Сохранение заказа в БД...');
        const orderResult = await pool.query(
          'INSERT INTO orders (phone, comment, total_amount) VALUES ($1, $2, $3) RETURNING id',
          [phone, comment || '', total]
        );
        orderId = orderResult.rows[0].id;
        console.log(`Заказ сохранен в БД с ID: ${orderId}`);
    } else {
        console.warn('Подключение к БД отсутствует. Заказ не будет сохранен в БД.');
    }

    // 6. Вставка позиций заказа в БД
    if (pool && orderId) {
        console.log('Сохранение позиций заказа в БД...');
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
            console.log(`Позиции заказа ${orderId} сохранены в БД.`);
        }
    }

    // 7. Отправка сообщения в Telegram
    console.log('Отправка заказа в Telegram...');
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
    console.log('Заказ успешно отправлен в Telegram.');

    // 8. Отправка успешного ответа клиенту
    res.json({ success: true });

  } catch (error) {
    console.error('Ошибка обработки заказа:', error);
    // Отправляем клиенту сообщение об ошибке
    res.status(500).json({ success: false, error: 'Ошибка обработки заказа на сервере' });
    // Важно: в production среде не стоит показывать клиенту детали внутренней ошибки сервера
  }
});

app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
});