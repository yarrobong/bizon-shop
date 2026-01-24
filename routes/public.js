const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { parseImagesJson } = require('../utils/parseImages');
const rateLimit = require('../middleware/rateLimit');
const { requireAuth } = require('../middleware/auth');
const { csrfProtection, generateToken } = require('../middleware/csrf');
const axios = require('axios');
const cache = require('../utils/cache');

// Rate limiting для публичных API
const publicRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

/**
 * GET /api/csrf-token
 * Получить CSRF токен для защищенных форм
 */
router.get('/csrf-token', (req, res) => {
  const token = generateToken();
  res.json({ csrfToken: token });
});

/**
 * GET /api/products
 * Получить товары (публичный доступ, только доступные товары)
 * Если передан параметр admin=true и пользователь аутентифицирован - возвращает все товары
 */
router.get('/products', publicRateLimit, async (req, res, next) => {
  try {
    const isAdminRequest = req.query.admin === 'true';
    
    // Если это запрос от админа, проверяем аутентификацию через middleware
    if (isAdminRequest) {
      // Используем requireAuth как middleware
      return requireAuth(req, res, () => {
        handleProductsRequest(req, res, true);
      });
    }
    
    // Для публичного доступа
    handleProductsRequest(req, res, false);
  } catch (err) {
    console.error('Ошибка загрузки товаров:', err);
    res.status(500).json({ error: 'Ошибка сервера при загрузке товаров.' });
  }
});

/**
 * Обработка запроса товаров с поддержкой пагинации
 */
async function handleProductsRequest(req, res, isAdmin) {
  try {
    const showAll = req.query.show_all === 'true' && isAdmin;
    
    // Параметры пагинации
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 20;
    let offset = (page - 1) * limit;
    
    // Валидация параметров (если не show_all)
    if (!showAll) {
      if (page < 1) {
        return res.status(400).json({ error: 'Номер страницы должен быть больше 0' });
      }
      if (limit < 1 || limit > 5000) {
        return res.status(400).json({ error: 'Лимит должен быть от 1 до 5000' });
      }
    } else {
      // Для show_all сбрасываем лимиты
      limit = null;
      offset = 0;
    }
    
    // Формируем WHERE условие
    let whereConditions = [];
    let whereParams = [];

    if (!isAdmin) {
      // Для публичного доступа - только доступные товары
      whereConditions.push('available = true');
    }
    
    // Фильтрация по категории
    if (req.query.category) {
      whereParams.push(req.query.category);
      whereConditions.push(`category = $${whereParams.length}`);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    // Запрос для получения общего количества товаров
    const countQuery = `
      SELECT COUNT(*) as total
      FROM products
      ${whereClause}
    `;
    
    // Запрос для получения товаров
    let query;
    let queryParams = [...whereParams];
    
    if (showAll) {
      query = `
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
        ${whereClause}
        ORDER BY id
      `;
    } else {
      query = `
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
        ${whereClause}
        ORDER BY id
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `;
      queryParams.push(limit, offset);
    }

    // Выполняем оба запроса параллельно
    const [countResult, productsResult] = await Promise.all([
      pool.query(countQuery, whereParams),
      pool.query(query, queryParams)
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    const products = productsResult.rows.map(row => {
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

    // Возвращаем данные с метаинформацией о пагинации
    res.json({
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    console.error('Ошибка загрузки товаров:', err);
    res.status(500).json({ error: 'Ошибка сервера при загрузке товаров.' });
  }
}

/**
 * Вспомогательная функция для проверки валидности сессии без отправки ответа
 */
function checkSession(sessionId) {
  if (!sessionId) return false;
  
  // Используем тот же механизм что и в requireAuth, но без отправки ответа
  // Для этого нужно получить доступ к sessions из auth модуля
  // Но sessions не экспортируется, поэтому используем другой подход
  // Просто проверяем наличие sessionId - если он есть и запрос идет через fetchWithAuth,
  // значит это админский запрос
  return !!sessionId;
}

/**
 * GET /api/products/:id
 * Получить товар по ID (публичный доступ)
 * Если запрос идет с заголовком x-session-id - проверяем через requireAuth и возвращаем все товары
 */
router.get('/products/:id', publicRateLimit, async (req, res, next) => {
  try {
    const { validateId } = require('../middleware/validation');
    const productId = validateId(req.params.id);
    if (!productId) {
      return res.status(400).json({ error: 'Некорректный ID товара' });
    }

    // Проверяем, есть ли заголовок сессии
    const sessionId = req.headers['x-session-id'];
    
    // Если есть sessionId, используем requireAuth для проверки
    // requireAuth сам отправит ответ при ошибке, поэтому просто вызываем его
    if (sessionId) {
      return requireAuth(req, res, () => {
        // Если дошли сюда - сессия валидна, значит это админ
        handleProductByIdRequest(req, res, productId, true);
      });
    }

    // Для публичного доступа
    handleProductByIdRequest(req, res, productId, false);
  } catch (err) {
    console.error('Ошибка загрузки товара:', err);
    res.status(500).json({ error: 'Ошибка сервера при загрузке товара.' });
  }
});

/**
 * Обработка запроса товара по ID
 */
async function handleProductByIdRequest(req, res, productId, isAdmin) {
  try {
    // Формируем WHERE условие
    let whereClause = 'WHERE id = $1';
    if (!isAdmin) {
      whereClause = 'WHERE id = $1 AND available = true';
    }

    // Используем параметризованный запрос
    const productResult = await pool.query(`
      SELECT
        id, title, description, price, tag, available, category,
        brand, compatibility, images_json, supplier_link, supplier_notes, slug
      FROM products
      ${whereClause}
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
}

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

    // Если это комплект, загружаем товары комплекта
    if (productRow.category === 'Готовые комплекты') {
      try {
        const kitItemsResult = await pool.query(`
          SELECT 
            ki.id,
            ki.kit_id,
            ki.product_id,
            ki.quantity,
            ki.display_order,
            p.id as product_id,
            p.title,
            p.description,
            p.price,
            p.tag,
            p.available,
            p.category,
            p.brand,
            p.compatibility,
            p.images_json,
            p.supplier_link,
            p.supplier_notes,
            p.slug
          FROM kit_items ki
          JOIN products p ON ki.product_id = p.id
          WHERE ki.kit_id = $1 AND p.available = true
          ORDER BY ki.display_order, ki.id
        `, [productRow.id]);

        product.items = kitItemsResult.rows.map(row => {
          const itemImages = parseImagesJson(row.images_json, row.product_id);
          return {
            id: row.id,
            kit_id: row.kit_id,
            product_id: row.product_id,
            quantity: row.quantity,
            display_order: row.display_order,
            product: {
              id: row.product_id,
              title: row.title,
              description: row.description,
              price: parseFloat(row.price),
              tag: row.tag,
              available: row.available !== false,
              category: row.category,
              brand: row.brand,
              compatibility: row.compatibility,
              images: itemImages,
              supplier_link: row.supplier_link,
              supplier_notes: row.supplier_notes,
              slug: row.slug
            }
          };
        });
      } catch (kitErr) {
        console.error('Ошибка загрузки товаров комплекта:', kitErr);
        product.items = [];
      }
    }

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
  windowMs: 2 * 60 * 1000, // 2 минуты
  max: 5, // максимум 5 заказов за 2 минуты
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

        console.log('Отправка в Telegram. CHAT_ID:', CHAT_ID);
        
        await axios.post(
          `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
          {
            chat_id: String(CHAT_ID), // Убеждаемся, что это строка
            text: message,
            parse_mode: 'Markdown',
            disable_web_page_preview: true
          }
        );
        telegramSent = true;
        console.log('Сообщение успешно отправлено в Telegram');
      } catch (telegramError) {
        console.error('Ошибка отправки в Telegram:', telegramError.message);
        if (telegramError.response) {
          console.error('Детали ошибки:', telegramError.response.data);
        }
      }
    } else {
      console.error('TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не установлены');
      console.log('BOT_TOKEN:', BOT_TOKEN ? 'установлен' : 'не установлен');
      console.log('CHAT_ID:', CHAT_ID || 'не установлен');
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
 * Обратная связь (публичный доступ, с CSRF защитой)
 */
router.post('/contact', publicRateLimit, csrfProtection, async (req, res) => {
  const { name, phone, message } = req.body;

  if (!phone) {
    return res.status(400).json({ success: false, error: 'Не указан номер телефона' });
  }

  // Для проверки дубликатов используем только имя и телефон (без сообщения)
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

    let telegramMessage = `
📞 *Новая заявка на обратный звонок BIZON!*
👤 *Имя:* ${name || 'не указано'}
📱 *Телефон:* \`${cleanPhone}\`
`.trim();

    if (message && message.trim()) {
      telegramMessage += `\n💬 *Сообщение:*\n${message.trim()}`;
    }

    telegramMessage += `\n🕐 ${moscowTimeString}`;

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (BOT_TOKEN && CHAT_ID) {
      try {
        console.log('Отправка заявки в Telegram. CHAT_ID:', CHAT_ID);
        
        await axios.post(
          `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
          {
            chat_id: String(CHAT_ID), // Убеждаемся, что это строка
            text: telegramMessage,
            parse_mode: 'Markdown',
            disable_web_page_preview: true
          }
        );
        telegramSent = true;
        console.log('Заявка успешно отправлена в Telegram');
      } catch (telegramError) {
        console.error('Ошибка отправки в Telegram:', telegramError.message);
        if (telegramError.response) {
          console.error('Детали ошибки:', telegramError.response.data);
        }
      }
    } else {
      console.error('TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не установлены');
      console.log('BOT_TOKEN:', BOT_TOKEN ? 'установлен' : 'не установлен');
      console.log('CHAT_ID:', CHAT_ID || 'не установлен');
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

