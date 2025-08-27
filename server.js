
const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const products = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'products.json'), 'utf-8')
);

app.get('/api/products', (req, res) => {
  res.json(products);
});

// Функция экранирования для MarkdownV2
function escapeMarkdown(text) {
  if (!text) return 'не указан';
  return text
    .toString()
    .replace(/[\\_*[\]()~`>#+-=|{}.!]/g, '\\$&');
}

app.post('/api/order', async (req, res) => {
  const { phone, comment, cart } = req.body;

  if (!phone || !cart || cart.length === 0) {
    return res.status(400).json({ success: false, error: 'Недостаточно данных' });
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID?.trim();

  console.log('BOT_TOKEN:', BOT_TOKEN);
  console.log('CHAT_ID:', CHAT_ID);

  if (!BOT_TOKEN) return res.status(500).json({ success: false, error: 'BOT_TOKEN не загружен' });
  if (!CHAT_ID) return res.status(500).json({ success: false, error: 'CHAT_ID не загружен' });

  const total = cart.reduce((sum, item) => sum + item.product.price * item.qty, 0);
  const message = `
📦 *Новый заказ на BIZON!*
📞 *Телефон:* \`${phone}\`
💬 *Комментарий:* ${comment || 'не указан'}
🛒 *Товары:*
${cart.map(item => `• ${item.product.title} ×${item.qty}`).join('\n')}
💰 *Итого:* ${total} ₽
  `.trim();

  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      }
    );

    console.log('Telegram response:', response.data); // 🔥 Логируем ответ

    if (response.data.ok) {
      res.json({ success: true });
    } else {
      throw new Error(response.data.description);
    }
  } catch (error) {
    console.error('Telegram error:', error.message || error);
    res.status(500).json({ success: false, error: 'Не удалось отправить в Telegram' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
});