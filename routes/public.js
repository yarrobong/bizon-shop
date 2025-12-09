const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { parseImagesJson } = require('../utils/parseImages');
const rateLimit = require('../middleware/rateLimit');
const axios = require('axios');

// Rate limiting для публичных API
const publicRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

/**
 * GET /api/products
 * Получить товары (публичный доступ, только доступные товары)
 */
router.get('/products', publicRateLimit, async (req, res) => {
  try {
    // Публичный доступ - только доступные товары
    const query = `
      SELECT
        id,
        title,
        description,
        price,
        tag,
        available,
        category,
        brand,
        compatibility,
        images_json,
        supplier_link,
        supplier_notes,
        slug
      FROM products
      WHERE available = true
      ORDER BY id
    `;

    const result = await pool.query(query);

    const products = result.rows.map(row => {
      const images = parseImagesJson(row.images_json, row.id);

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        price: parseFloat(row.price),
        tag: row.tag,
        available: row.available !== false,
        category: row.category,
        brand: row.brand,
        compatibility: row.compatibility,
        images: images,
        supplier_link: row.supplier_link,
        supplier_notes: row.supplier_notes,
        slug: row.slug
      };
    });

    res.json(products);
  } catch (err) {
    console.error('Ошибка загрузки товаров:', err);
    res.status(500).json({ error: 'Ошибка сервера при загрузке товаров.' });
  }
});

/**
 * GET /api/products/:id
 * Получить товар по ID (публичный доступ)
 */
router.get('/products/:id', publicRateLimit, async (req, res) => {
  try {
    const { validateId } = require('../middleware/validation');
    const productId = validateId(req.params.id);
    if (!productId) {
      return res.status(400).json({ error: 'Некорректный ID товара' });
    }

    // Используем параметризованный запрос
    const productResult = await pool.query(`
      SELECT
        id, title, description, price, tag, available, category,
        brand, compatibility, images_json, supplier_link, supplier_notes, slug
      FROM products
      WHERE id = $1 AND available = true
    `, [productId]);

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    const productRow = productResult.rows[0];
    const productImages = parseImagesJson(productRow.images_json, productId);

    const product = {
      id: productRow.id,
      title: productRow.title,
      description: productRow.description,
      price: parseFloat(productRow.price),
      tag: productRow.tag,
      available: productRow.available !== false,
      category: productRow.category,
      brand: productRow.brand,
      compatibility: productRow.compatibility,
      images: productImages,
      supplier_link: productRow.supplier_link,
      supplier_notes: productRow.supplier_notes,
      slug: productRow.slug
    };

    res.json(product);
  } catch (err) {
    console.error('Ошибка загрузки товара:', err);
    res.status(500).json({ error: 'Ошибка сервера при загрузке товара.' });
  }
});

/**
 * GET /api/product-by-slug/:slug
 * Получить товар по slug (публичный доступ)
 */
router.get('/product-by-slug/:slug', publicRateLimit, async (req, res) => {
  try {
    const { validateSlug } = require('../middleware/validation');
    const slug = validateSlug(decodeURIComponent(req.params.slug));
    if (!slug) {
      return res.status(400).json({ error: 'Некорректный slug' });
    }
    
    // Используем параметризованный запрос
    const productResult = await pool.query(`
      SELECT
        id, title, description, price, tag, available, category,
        brand, compatibility, images_json, supplier_link, supplier_notes, slug
      FROM products
      WHERE slug = $1 AND available = true
    `, [slug]);

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    const productRow = productResult.rows[0];
    const productImages = parseImagesJson(productRow.images_json, productRow.id);

    const product = {
      id: productRow.id,
      title: productRow.title,
      description: productRow.description,
      price: parseFloat(productRow.price),
      tag: productRow.tag,
      available: productRow.available !== false,
      category: productRow.category,
      brand: productRow.brand,
      compatibility: productRow.compatibility,
      images: productImages,
      supplier_link: productRow.supplier_link,
      supplier_notes: productRow.supplier_notes,
      slug: productRow.slug
    };

    res.json(product);
  } catch (err) {
    console.error('Ошибка загрузки товара по slug:', err);
    res.status(500).json({ error: 'Ошибка сервера при загрузке товара.' });
  }
});

/**
 * POST /api/order
 * Создать заказ (публичный доступ, но с защитой от спама)
 */
const orderRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 3, // максимум 3 заказа в минуту
  message: 'Слишком много заказов, попробуйте позже'
});

router.post('/order', orderRateLimit, async (req, res) => {
  const { validatePhone, sanitizeString } = require('../middleware/validation');
  let { phone, comment, cart } = req.body;

  if (!phone || !cart || cart.length === 0) {
    return res.status(400).json({ success: false, error: 'Недостаточно данных' });
  }

  // Валидация и санитизация
  phone = validatePhone(phone);
  if (!phone) {
    return res.status(400).json({ success: false, error: 'Некорректный номер телефона' });
  }
  comment = sanitizeString(comment || '', 500);
  
  // Валидация корзины
  if (!Array.isArray(cart)) {
    return res.status(400).json({ success: false, error: 'Некорректный формат корзины' });
  }

  // Защита от повторных запросов
  const requestHash = JSON.stringify({ phone, comment, cart });
  if (req.app.locals.lastOrderRequest === requestHash) {
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
    const moscowTimeObj = new Date(new Date().toLocaleString("en-US", { timeZone: 'Europe/Moscow' }));

    // Сохранение заказа с параметризованным запросом
    const orderResult = await pool.query(
      'INSERT INTO orders (phone, comment, total_amount, created_at) VALUES ($1, $2, $3, $4) RETURNING id',
      [phone, comment || '', total, moscowTimeObj]
    );
    orderId = orderResult.rows[0].id;
    orderSaved = true;
    req.app.locals.lastOrderId = orderId;

    // Сохранение позиций заказа
    if (orderId && cart.length > 0) {
      const queryText = 'INSERT INTO order_items (order_id, product_id, product_title, quantity, price_per_unit) VALUES ';
      const queryValues = [];
      const placeholders = cart.map((item, index) => {
        const start = index * 5 + 1;
        return `($${start}, $${start + 1}, $${start + 2}, $${start + 3}, $${start + 4})`;
      }).join(', ');

      cart.forEach(item => {
        queryValues.push(
          orderId,
          item.product?.id || null,
          item.product?.title || 'Неизвестный товар',
          item.qty,
          item.product?.price || 0
        );
      });

      await pool.query(queryText + placeholders, queryValues);
    }

    // Отправка в Telegram
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (BOT_TOKEN && CHAT_ID) {
      try {
        const cleanPhone = phone.replace(/[^0-9+]/g, '');
        const message = `
📦 *Новый заказ на BIZON!*
📞 *Телефон:* \`${cleanPhone}\`
💬 *Комментарий:* ${comment || 'не указан'}
🛒 *Товары:*
${cart.map(item => `• ${item.product?.title || 'Неизвестный товар'} ×${item.qty} — ${(item.product?.price || 0) * item.qty} ₽`).join('\n')}
💰 *Итого:* ${total} ₽
`.trim();

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
      } catch (telegramError) {
        console.error('Ошибка отправки в Telegram:', telegramError.message);
      }
    }

    res.json({
      success: true,
      orderId: orderId,
      savedToDB: orderSaved,
      sentToTelegram: telegramSent
    });
  } catch (error) {
    console.error('Ошибка обработки заказа:', error);
    req.app.locals.lastOrderRequest = null;
    req.app.locals.lastOrderId = null;
    res.status(500).json({ success: false, error: 'Ошибка обработки заказа на сервере' });
  }
});

/**
 * POST /api/contact
 * Обратная связь (публичный доступ)
 */
router.post('/contact', publicRateLimit, async (req, res) => {
  const { name, phone } = req.body;

  if (!phone) {
    return res.status(400).json({ success: false, error: 'Не указан номер телефона' });
  }

  const requestHash = JSON.stringify({ name, phone });
  if (req.app.locals.lastContactRequest === requestHash) {
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

    const cleanPhone = phone.replace(/[^0-9+]/g, '');

    const message = `
📞 *Новая заявка на обратный звонок BIZON!*
👤 *Имя:* ${name || 'не указано'}
📱 *Телефон:* \`${cleanPhone}\`
🕐 ${moscowTimeString}
`.trim();

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (BOT_TOKEN && CHAT_ID) {
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
        telegramSent = true;
      } catch (telegramError) {
        console.error('Ошибка отправки в Telegram:', telegramError.message);
      }
    }

    res.json({
      success: true,
      savedToDB: false,
      sentToTelegram: telegramSent
    });
  } catch (error) {
    console.error('Ошибка обработки заявки:', error);
    req.app.locals.lastContactRequest = null;
    res.status(500).json({ success: false, error: 'Ошибка обработки заявки на сервере' });
  }
});

module.exports = router;

