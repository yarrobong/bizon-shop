require('dotenv').config();
const express = require('express');
const path = require('path');
const pool = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Установка часового пояса
process.env.TZ = 'Europe/Moscow';

// --- Middleware ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Статические файлы
app.use(express.static(path.join(__dirname, 'public')));

// Инициализация для защиты от повторных заказов
app.locals.lastOrderRequest = null;
app.locals.lastOrderId = null;

// --- Routes ---
// Публичные маршруты (без аутентификации)
app.use('/api', require('./routes/public'));

// Аутентификация
app.use('/api', require('./routes/auth'));

// Загрузка файлов (требует аутентификации)
app.use('/api', require('./routes/upload'));

// Админские маршруты (требуют аутентификации)
app.use('/api/admin', require('./routes/admin'));

// Здесь можно добавить другие маршруты:
// app.use('/api/attractions', require('./routes/attractions'));
// app.use('/api/categories', require('./routes/categories'));
// app.use('/api/logistics', require('./routes/logistics'));

// --- HTML маршруты ---
app.get('/product/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'product.html'));
});

app.get('/attraction/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'productAttractions.html'));
});

// Универсальный маршрут для HTML страниц
app.get('/:page', async (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }

  const filePath = path.join(__dirname, 'public', `${req.params.page}.html`);
  try {
    const fs = require('fs').promises;
    await fs.access(filePath);
    const stats = await fs.stat(filePath);
    if (stats.isFile()) {
      return res.sendFile(filePath);
    }
    next();
  } catch (err) {
    next();
  }
});

// Обработчик 404
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// --- Старт сервера ---
app.listen(PORT, async () => {
  console.log(`✅ Сервер запущен на http://localhost:${PORT}`);

  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Успешное подключение к БД. Текущее время на сервере:', res.rows[0].now);
  } catch (err) {
    console.error('❌ Ошибка подключения к БД при старте:', err);
  }
});

module.exports = app;

