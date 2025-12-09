const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { parseImagesJson } = require('../utils/parseImages');
const { generateSlug, generateAttractionSlug } = require('../utils/slug');

// Все админские маршруты требуют аутентификации
router.use(requireAuth);

/**
 * GET /api/admin/products
 * Получить все товары (включая недоступные) - только для админов
 */
router.get('/products', async (req, res) => {
  try {
    const showAll = req.query.show_all === 'true';

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

    res.json(products);
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

