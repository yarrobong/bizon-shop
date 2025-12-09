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

// Инициализация для защиты от повторных заказов и обратной связи
app.locals.lastOrderRequest = null;
app.locals.lastOrderId = null;
app.locals.lastContactRequest = null;

// --- Routes ---
// Публичные маршруты (без аутентификации)
app.use('/api', require('./routes/public'));

// Аутентификация
app.use('/api', require('./routes/auth'));

// Загрузка файлов (требует аутентификации)
app.use('/api', require('./routes/upload'));

// Админские маршруты (требуют аутентификации)
app.use('/api/admin', require('./routes/admin'));

// Админские операции с товарами
app.use('/api/products', require('./routes/products'));

// Товары для КП (публичный доступ)
app.use('/api/products_for_proposal', require('./routes/productsForProposal'));

// Категории (требуют аутентификации)
app.use('/api/categories', require('./routes/categories'));

// Заказы (требуют аутентификации)
app.use('/api/orders', require('./routes/orders'));

// Аттракционы (публичные и админские)
app.use('/api/attractions', require('./routes/attractions'));

// Логистика (требуют аутентификации)
const logistics = require('./routes/logistics');
app.use('/api/purchase-orders', logistics.purchaseOrders);
app.use('/api/clients', logistics.clients);
app.use('/api/buyers', logistics.buyers);
app.use('/api/shipments', logistics.shipments);
app.use('/api/distribution', logistics.distribution);
app.use('/api/payments', logistics.payments);

// Коммерческие предложения (публичный доступ)
const proposals = require('./routes/proposals');
app.use('/generate_proposal', proposals.generateProposal);
app.use('/generate_proposal_pdf', proposals.generateProposalPdf);

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

