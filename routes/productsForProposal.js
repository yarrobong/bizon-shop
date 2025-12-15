const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { parseImagesJson } = require('../utils/parseImages');

/**
 * GET /api/products_for_proposal
 * Получить товары и аттракционы для КП (все, включая недоступные)
 * Публичный доступ - не требует аутентификации
 *
 * Изменения:
 * - Добавлена поддержка аттракционов из таблицы attractions
 * - Каждый элемент имеет поле type: 'product' | 'attraction'
 * - Структура данных унифицирована для совместимости с генерацией КП
 */
router.get('/', async (req, res) => {
  try {
    // Получаем товары
    const productsResult = await pool.query(`
      SELECT id, title, description, price, tag, available, category, brand, compatibility,
        images_json, supplier_link, supplier_notes, slug
      FROM products
      ORDER BY category, id
    `);

    const products = productsResult.rows.map(row => {
      const images = parseImagesJson(row.images_json, row.id);
      return {
        id: row.id,
        type: 'product', // Тип: товар
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

    // Получаем аттракционы
    const attractionsResult = await pool.query(`
      SELECT id, title, price, category, image_url AS image, description, available, slug,
        specs_places AS "specs.places", specs_power AS "specs.power",
        specs_games AS "specs.games", specs_area AS "specs.area",
        specs_dimensions AS "specs.dimensions"
      FROM attractions
      ORDER BY category, id
    `);

    // Получаем изображения для аттракционов
    const availableAttractionIds = attractionsResult.rows.map(r => r.id);
    let imagesResult;
    if (availableAttractionIds.length > 0) {
      const placeholders = availableAttractionIds.map((_, i) => `$${i + 1}`).join(', ');
      imagesResult = await pool.query(`
        SELECT attraction_id, url, alt, sort_order
        FROM attraction_images
        WHERE attraction_id IN (${placeholders})
        ORDER BY attraction_id, sort_order ASC;
      `, availableAttractionIds);
    } else {
      imagesResult = { rows: [] };
    }

    const imagesMap = {};
    imagesResult.rows.forEach(img => {
      if (!imagesMap[img.attraction_id]) {
        imagesMap[img.attraction_id] = [];
      }
      imagesMap[img.attraction_id].push({
        url: img.url,
        alt: img.alt || ''
      });
    });

    const attractions = attractionsResult.rows.map(row => {
      const imagesForAttraction = imagesMap[row.id] || [];
      if (imagesForAttraction.length === 0 && row.image) {
        imagesForAttraction.push({ url: row.image, alt: row.title || 'Изображение' });
      }

      return {
        id: row.id,
        type: 'attraction', // Тип: аттракцион
        title: row.title,
        description: row.description,
        price: parseFloat(row.price),
        available: row.available,
        category: row.category,
        images: imagesForAttraction,
        slug: row.slug,
        specs: {
          places: row["specs.places"] || null,
          power: row["specs.power"] || null,
          games: row["specs.games"] || null,
          area: row["specs.area"] || null,
          dimensions: row["specs.dimensions"] || null
        }
      };
    });

    // Объединяем товары и аттракционы в один массив
    const allItems = [...products, ...attractions];

    res.json({ success: true, products: allItems });
  } catch (err) {
    console.error('Ошибка загрузки товаров и аттракционов для КП:', err);
    res.status(500).json({ success: false, error: 'Ошибка сервера при загрузке товаров и аттракционов для КП.' });
  }
});

module.exports = router;

