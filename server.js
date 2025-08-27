
const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE available = true ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось загрузить товары' });
  }
});

// Функция экранирования для MarkdownV2
function escapeMarkdown(text) {
  if (!text) return 'не указан';
  return text
    .toString()
    .replace(/[\\_*[\]()~`>#+-=|{}.!]/g, '\\$&');
}
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // нужно для Render
  }
});
app.post('/api/order', async (req, res) => {
  const { phone, comment, cart } = req.body;
  const total = cart.reduce((sum, item) => sum + item.product.price * item.qty, 0);

  try {
    // Начинаем транзакцию
    await pool.query('BEGIN');

    // Создаём заказ
    const orderResult = await pool.query(
      `INSERT INTO orders (phone, comment, total) VALUES ($1, $2, $3) RETURNING id`,
      [phone, comment, total]
    );
    const orderId = orderResult.rows[0].id;

    // Добавляем позиции
    for (const item of cart) {
      await pool.query(
        `INSERT INTO order_items (order_id, product_id, product_title, product_price, qty)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, item.product.id, item.product.title, item.product.price, item.qty]
      );
    }

    await pool.query('COMMIT');

    // Отправляем в Telegram
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: `📦 Новый заказ: ${total} ₽\n📞 ${phone}`,
      parse_mode: 'Markdown'
    });

    res.json({ success: true });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Ошибка:', error);
    res.status(500).json({ success: false, error: 'Не удалось обработать заказ' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
});