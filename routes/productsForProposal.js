const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { parseImagesJson } = require('../utils/parseImages');

/**
 * GET /api/products_for_proposal
 * Получить товары для КП (все, включая недоступные)
 * Публичный доступ - не требует аутентификации
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, title, description, price, tag, available, category, brand, compatibility,
        images_json, supplier_link, supplier_notes, slug
      FROM products
      ORDER BY category, id
    `);

    const products = result.rows.map(row => {
      const images = parseImagesJson(row.images_json, row.id);
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        price: parseFloat(row.price),
        tag: row.tag,
        available: row.available,
        category: row.category,
        brand: row.brand,
        compatibility: row.compatibility,
        images: images,
        supplier_link: row.supplier_link,
        supplier_notes: row.supplier_notes,
        slug: row.slug
      };
    });

    res.json({ success: true, products: products });
  } catch (err) {
    console.error('Ошибка загрузки товаров для КП:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера при загрузке товаров для КП.' });
  }
});

module.exports = router;

