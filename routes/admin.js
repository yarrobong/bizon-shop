const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { parseImagesJson } = require('../utils/parseImages');
const { generateSlug, generateAttractionSlug } = require('../utils/slug');
const cache = require('../utils/cache');

// Все админские маршруты требуют аутентификации
router.use(requireAuth);

/**
 * GET /api/admin/products
 * Получить все товары (включая недоступные) - только для админов
 * Поддерживает пагинацию через параметры ?page=1&limit=20
 * Если параметры не указаны - возвращает все товары (для обратной совместимости)
 */
router.get('/products', async (req, res) => {
  try {
    const showAll = req.query.show_all === 'true';
    const page = req.query.page ? parseInt(req.query.page) : null;
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    
    // Если пагинация не запрошена - возвращаем все товары (обратная совместимость)
    if (!page && !limit) {
      const cacheKey = `admin:products:${showAll ? 'all' : 'available'}`;
      const cachedProducts = cache.get(cacheKey);
      if (cachedProducts) {
        console.log(`[Cache] Админские товары загружены из кэша (showAll: ${showAll})`);
        return res.json(cachedProducts);
      }

      let whereClause = '';
      if (!showAll) {
        whereClause = 'WHERE available = true';
      }

      const query = `
        SELECT
          id, title, description, price, tag, available, category,
          brand, compatibility, images_json, supplier_link, supplier_notes, slug
        FROM products
        ${whereClause}
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

      cache.set(cacheKey, products);
      console.log(`[Cache] Админские товары сохранены в кэш (showAll: ${showAll})`);
      return res.json(products);
    }
    
    // Пагинация запрошена
    const pageNum = page || 1;
    const limitNum = limit || 20;
    const offset = (pageNum - 1) * limitNum;
    
    // Валидация параметров
    if (pageNum < 1) {
      return res.status(400).json({ error: 'Номер страницы должен быть больше 0' });
    }
    if (limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ error: 'Лимит должен быть от 1 до 100' });
    }

    let whereClause = '';
    if (!showAll) {
      whereClause = 'WHERE available = true';
    }

    // Запрос для получения общего количества товаров
    const countQuery = `
      SELECT COUNT(*) as total
      FROM products
      ${whereClause}
    `;
    
    // Запрос для получения товаров с пагинацией
    const query = `
      SELECT
        id, title, description, price, tag, available, category,
        brand, compatibility, images_json, supplier_link, supplier_notes, slug
      FROM products
      ${whereClause}
      ORDER BY id
      LIMIT $1 OFFSET $2
    `;

    // Выполняем оба запроса параллельно
    const [countResult, productsResult] = await Promise.all([
      pool.query(countQuery),
      pool.query(query, [limitNum, offset])
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limitNum);

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
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (err) {
    console.error('Ошибка загрузки товаров:', err);
    res.status(500).json({ error: 'Ошибка сервера при загрузке товаров.' });
  }
});

/**
 * GET /api/admin/orders
 * Получить все заказы - только для админов
 */
router.get('/orders', async (req, res) => {
  try {
    const ordersWithItemsResult = await pool.query(`
      SELECT 
        o.id, o.phone, o.comment, o.total_amount, o.created_at,
        COALESCE(o.status, 'новый') as status,
        oi.product_id, oi.product_title, oi.quantity,
        oi.price_per_unit, (oi.quantity * oi.price_per_unit) as total_price,
        oi.id as item_id
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      ORDER BY o.created_at DESC, oi.id
    `);

    const ordersMap = new Map();
    ordersWithItemsResult.rows.forEach(row => {
      const orderId = row.id;
      if (!ordersMap.has(orderId)) {
        ordersMap.set(orderId, {
          id: row.id,
          phone: row.phone,
          comment: row.comment,
          total_amount: row.total_amount,
          created_at: row.created_at,
          status: row.status,
          items: []
        });
      }
      if (row.product_id) {
        ordersMap.get(orderId).items.push({
          product_id: row.product_id,
          product_title: row.product_title,
          quantity: row.quantity,
          price_per_unit: row.price_per_unit,
          total_price: row.total_price
        });
      }
    });

    res.json(Array.from(ordersMap.values()));
  } catch (err) {
    console.error('Ошибка загрузки заказов:', err);
    res.status(500).json({ error: 'Не удалось загрузить заказы: ' + err.message });
  }
});

// Здесь можно добавить другие админские маршруты
// POST /api/admin/products - создать товар
// PUT /api/admin/products/:id - обновить товар
// DELETE /api/admin/products/:id - удалить товар
// и т.д.

module.exports = router;

