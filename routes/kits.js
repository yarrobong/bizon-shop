const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { parseImagesJson } = require('../utils/parseImages');
const cache = require('../utils/cache');

// Все маршруты требуют аутентификации
router.use(requireAuth);

/**
 * GET /api/kits/:id/items
 * Получить товары комплекта
 */
router.get('/:id/items', async (req, res) => {
  try {
    const kitId = parseInt(req.params.id, 10);
    if (isNaN(kitId)) {
      return res.status(400).json({ error: 'Некорректный ID комплекта' });
    }

    const result = await pool.query(`
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
      WHERE ki.kit_id = $1
      ORDER BY ki.display_order, ki.id
    `, [kitId]);

    const items = result.rows.map(row => {
      const images = parseImagesJson(row.images_json, row.product_id);
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
          images: images,
          supplier_link: row.supplier_link,
          supplier_notes: row.supplier_notes,
          slug: row.slug
        }
      };
    });

    res.json(items);
  } catch (err) {
    console.error('Ошибка загрузки товаров комплекта:', err);
    res.status(500).json({ error: 'Не удалось загрузить товары комплекта' });
  }
});

/**
 * PUT /api/kits/:id/items
 * Обновить товары комплекта
 */
router.put('/:id/items', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const kitId = parseInt(req.params.id, 10);
    const { items } = req.body; // массив {product_id, quantity, display_order}

    if (isNaN(kitId)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Некорректный ID комплекта' });
    }

    // Проверяем, что комплект существует и является комплектом
    const kitCheck = await client.query(
      'SELECT id, category FROM products WHERE id = $1',
      [kitId]
    );

    if (kitCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Комплект не найден' });
    }

    // Удаляем все существующие товары комплекта
    await client.query('DELETE FROM kit_items WHERE kit_id = $1', [kitId]);

    // Добавляем новые товары
    if (Array.isArray(items) && items.length > 0) {
      const validatedItems = items
        .map(item => ({
          product_id: parseInt(item.product_id, 10),
          quantity: parseInt(item.quantity, 10) || 1,
          display_order: parseInt(item.display_order, 10) || 0
        }))
        .filter(item => !isNaN(item.product_id) && item.product_id !== kitId);

      if (validatedItems.length > 0) {
        // Проверяем существование товаров
        const productIds = validatedItems.map(item => item.product_id);
        const placeholders = productIds.map((_, i) => `$${i + 1}`).join(', ');
        const checkProductsQuery = `SELECT id FROM products WHERE id IN (${placeholders})`;
        const checkResult = await client.query(checkProductsQuery, productIds);
        const existingProductIds = checkResult.rows.map(r => r.id);

        // Вставляем только существующие товары
        const validItems = validatedItems.filter(item => 
          existingProductIds.includes(item.product_id)
        );

        if (validItems.length > 0) {
          const insertValues = validItems.map((item, idx) => {
            const base = idx * 4;
            return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
          }).join(', ');

          const insertQuery = `
            INSERT INTO kit_items (kit_id, product_id, quantity, display_order)
            VALUES ${insertValues}
          `;

          const insertParams = validItems.flatMap(item => [
            kitId,
            item.product_id,
            item.quantity,
            item.display_order
          ]);

          await client.query(insertQuery, insertParams);
        }
      }
    }

    await client.query('COMMIT');
    cache.invalidateProducts();

    res.json({ success: true, message: 'Товары комплекта обновлены' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Ошибка обновления товаров комплекта:', err);
    res.status(500).json({ error: 'Не удалось обновить товары комплекта' });
  } finally {
    client.release();
  }
});

module.exports = router;
