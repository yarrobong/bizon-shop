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

// === Локальные данные (для разработки) ===
const localProducts = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'products.json'), 'utf-8')
);

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
      const result = await pool.query('SELECT * FROM products WHERE available = true ORDER BY id');
      res.json(result.rows);
    } 
  } catch (err) {
    console.error('Ошибка загрузки товаров:', err);
    res.status(500).json({ error: 'Не удалось загрузить товары' });
  }
});

// === API: Оформить заказ ===
app.post('/api/order', async (req, res) => {
  const { phone, comment, cart } = req.body;

  if (!phone || !cart || cart.length === 0) {
    return res.status(400).json({ success: false, error: 'Недостаточно данных' });
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  const total = cart.reduce((sum, item) => sum + item.product.price * item.qty, 0);
  const message = `
📦 *Новый заказ на BIZON!*
📞 *Телефон:* \`${phone}\`
💬 *Комментарий:* ${comment || 'не указан'}
🛒 *Товары:*
${cart.map(item => `• ${item.product.title} ×${item.qty} — ${item.product.price * item.qty} ₽`).join('\n')}
💰 *Итого:* ${total} ₽
🕐 ${new Date().toLocaleString('ru-RU')}
  `.trim();

  try {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Telegram error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: 'Не удалось отправить в Telegram' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
});