const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { parseImagesJson } = require('../utils/parseImages');
const { generateSlug } = require('../utils/slug');

// Все маршруты требуют аутентификации
router.use(requireAuth);

/**
 * PUT /api/products/:id/variants
 * Установить варианты товара
 */
router.put('/:id/variants', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const productId = parseInt(id, 10);
    const { variantIds } = req.body;

    if (isNaN(productId)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Некорректный ID товара' });
    }

    const productExists = await client.query('SELECT 1 FROM products WHERE id = $1', [productId]);
    if (productExists.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Основной товар не найден' });
    }

    let validatedVariantIds = [];
    if (Array.isArray(variantIds)) {
      validatedVariantIds = [...new Set(variantIds.map(vId => parseInt(vId, 10)).filter(vId => !isNaN(vId) && vId !== productId))];
    }

    const existingGroupRes = await client.query(
      'SELECT group_id FROM product_variants_link WHERE product_id = $1',
      [productId]
    );

    let groupIdToUse = null;

    if (validatedVariantIds.length > 0) {
      if (existingGroupRes.rows.length > 0) {
        groupIdToUse = existingGroupRes.rows[0].group_id;
      } else {
        groupIdToUse = productId;
      }

      await client.query('DELETE FROM product_variants_link WHERE group_id = $1', [groupIdToUse]);

      await client.query(
        'INSERT INTO product_variants_link (product_id, group_id) VALUES ($1, $2)',
        [productId, groupIdToUse]
      );

      if (validatedVariantIds.length > 0) {
        const placeholders = validatedVariantIds.map((_, i) => `$${i + 1}`).join(', ');
        const checkVariantsQuery = `SELECT id FROM products WHERE id IN (${placeholders})`;
        const checkResult = await client.query(checkVariantsQuery, validatedVariantIds);
        const existingVariantIds = checkResult.rows.map(r => r.id);

        for (const variantId of existingVariantIds) {
          await client.query(
            'INSERT INTO product_variants_link (product_id, group_id) VALUES ($1, $2)',
            [variantId, groupIdToUse]
          );
        }
      }
    } else {
      if (existingGroupRes.rows.length > 0) {
        const oldGroupId = existingGroupRes.rows[0].group_id;
        await client.query('DELETE FROM product_variants_link WHERE group_id = $1', [oldGroupId]);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Варианты товара обновлены', groupId: groupIdToUse });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Ошибка установки вариантов товара:', err);
    if (err.code === '23503' || err.code === '23505') {
      res.status(400).json({ error: 'Ошибка данных при обновлении вариантов' });
    } else {
      res.status(500).json({ error: 'Не удалось обновить варианты товара' });
    }
  } finally {
    client.release();
  }
});

/**
 * PUT /api/products/:id
 * Обновить товар
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, price, tag, available, category, brand, compatibility, supplier_link, supplier_notes, images } = req.body;
    
    // Валидация и нормализация данных
    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ error: 'Название товара обязательно' });
    }
    
    const normalizedPrice = typeof price === 'number' ? price : parseFloat(price) || 0;
    const normalizedAvailable = available === true || available === 'true' || available === 1 || available === '1';
    const normalizedTag = tag && tag.trim() !== '' ? tag.trim() : null;
    const normalizedBrand = brand && brand.trim() !== '' ? brand.trim() : null;
    // Передаем compatibility как строку (не массив)
    const normalizedCompatibility = compatibility ? compatibility.trim() : null;
    // Обрезаем supplier_link до 2000 символов, если он слишком длинный (обычно VARCHAR ограничен)
    let normalizedSupplierLink = supplier_link && supplier_link.trim() !== '' ? supplier_link.trim() : null;
    if (normalizedSupplierLink && normalizedSupplierLink.length > 2000) {
      normalizedSupplierLink = normalizedSupplierLink.substring(0, 2000);
    }
    const normalizedSupplierNotes = supplier_notes && supplier_notes.trim() !== '' ? supplier_notes.trim() : null;
    
    const images_json = images && Array.isArray(images) && images.length > 0 ? JSON.stringify(images) : null;
    
    const productId = parseInt(id, 10);
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Некорректный ID товара' });
    }
    
    // Убеждаемся, что description не undefined
    const normalizedDescription = description || '';
    
    // Проверяем существование колонки compatibility и создаем как TEXT, если не существует
    try {
      const checkColumn = await pool.query(`
        SELECT column_name
        FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'compatibility'
      `);
      
      if (checkColumn.rows.length === 0) {
        await pool.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS compatibility TEXT');
      }
    } catch (checkError) {
      console.error('Ошибка при проверке/создании колонки compatibility:', checkError);
      // Продолжаем выполнение, возможно колонка уже существует
    }
    
    // Передаем compatibility как строку (не массив)
    const compatibilityForDB = normalizedCompatibility;
    
    const queryParams = [
      title.trim(),
      normalizedDescription,
      normalizedPrice,
      normalizedTag,
      normalizedAvailable,
      category || '',
      normalizedBrand,
      compatibilityForDB,
      normalizedSupplierLink,
      normalizedSupplierNotes,
      images_json,
      productId
    ];
    
    let result;
    try {
      result = await pool.query(`
        UPDATE products
        SET title = $1, description = $2, price = $3, tag = $4, available = $5, category = $6, brand = $7, compatibility = $8, supplier_link = $9, supplier_notes = $10, images_json = $11
        WHERE id = $12
        RETURNING id, title, description, price, tag, available, category, brand, compatibility, supplier_link, supplier_notes, images_json
      `, queryParams);
    } catch (sqlError) {
      console.error('Ошибка SQL запроса при обновлении товара:', sqlError.message);
      throw sqlError; // Пробрасываем ошибку дальше
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    const updatedProductFromDB = result.rows[0];
    let processedImages = [];
    
    if (updatedProductFromDB.images_json != null) {
      if (Array.isArray(updatedProductFromDB.images_json)) {
        processedImages = updatedProductFromDB.images_json;
      } else if (typeof updatedProductFromDB.images_json === 'object') {
        processedImages = [updatedProductFromDB.images_json];
      } else {
        processedImages = [];
      }
    }

    const { images_json: _, ...productWithoutImagesJson } = updatedProductFromDB;
    
    res.json({
      ...productWithoutImagesJson,
      images: processedImages
    });
    
  } catch (err) {
    console.error('Ошибка обновления товара:', err);
    console.error('Тип ошибки:', typeof err);
    console.error('Конструктор ошибки:', err.constructor?.name);
    console.error('Детали ошибки:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      hint: err.hint,
      constraint: err.constraint,
      table: err.table,
      column: err.column,
      stack: err.stack ? err.stack.substring(0, 500) : 'нет stack trace'
    });
    
    // Отправляем детальную информацию об ошибке клиенту для отладки
    const errorResponse = {
      error: 'Не удалось обновить товар',
      details: err.message || 'Неизвестная ошибка',
      code: err.code || null,
      detail: err.detail || null,
      hint: err.hint || null,
      constraint: err.constraint || null,
      table: err.table || null,
      column: err.column || null,
      // Добавляем строковое представление ошибки для отладки
      errorString: String(err),
      errorName: err.name || null
    };
    
    console.error('Отправляемый ответ об ошибке:', JSON.stringify(errorResponse, null, 2));
    
    // Убеждаемся, что ответ еще не был отправлен
    if (!res.headersSent) {
      try {
        res.status(500).json(errorResponse);
        console.log('Ответ об ошибке успешно отправлен клиенту');
      } catch (sendError) {
        console.error('Ошибка при отправке ответа об ошибке:', sendError);
      }
    } else {
      console.error('Ответ уже был отправлен, не можем отправить детали ошибки. Headers sent:', res.headersSent);
    }
  }
});

/**
 * GET /api/products/:id
 * Получить товар по ID с вариантами
 */
router.get('/:id', async (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Некорректный ID товара' });
    }

    const productResult = await pool.query(`
      SELECT id, title, description, price, tag, available, category,
        brand, compatibility, images_json, supplier_link, supplier_notes, slug
      FROM products
      WHERE id = $1`, [productId]);

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

    let variants = [];
    const groupResult = await pool.query(
      'SELECT group_id FROM product_variants_link WHERE product_id = $1',
      [product.id]
    );

    if (groupResult.rows.length > 0) {
      const groupId = groupResult.rows[0].group_id;
      const variantsResult = await pool.query(`
        SELECT p.id, p.title, p.description, p.price, p.tag, p.available,
          p.category, p.brand, p.compatibility, p.images_json,
          p.supplier_link, p.supplier_notes, p.slug
        FROM product_variants_link pvl
        JOIN products p ON pvl.product_id = p.id
        WHERE pvl.group_id = $1 AND p.id != $2
        ORDER BY p.id`,
        [groupId, product.id]
      );

      variants = variantsResult.rows.map(row => {
        const variantImages = parseImagesJson(row.images_json, row.id);
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
          images: variantImages,
          supplier_link: row.supplier_link,
          supplier_notes: row.supplier_notes,
          slug: row.slug
        };
      });
    }

    product.variants = variants;
    res.json(product);

  } catch (err) {
    console.error(`Ошибка при получении товара с ID ${req.params.id}:`, err);
    res.status(500).json({ error: 'Не удалось загрузить товар', details: err.message });
  }
});

/**
 * POST /api/products
 * Создать товар
 */
router.post('/', async (req, res) => {
  try {
    const { title, description, price, tag, available, category, brand, compatibility, supplier_link, supplier_notes, images_json } = req.body;

    let slug = generateSlug(title);
    let counter = 1;
    let uniqueSlug = slug;
    while (true) {
      const existing = await pool.query('SELECT id FROM products WHERE slug = $1', [uniqueSlug]);
      if (existing.rows.length === 0) {
        break;
      }
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    const result = await pool.query(
      `INSERT INTO products (
        title, description, price, tag, available, category, brand, compatibility,
        supplier_link, supplier_notes, images_json, slug
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id`,
      [title, description, price, tag, available, category, brand, compatibility, supplier_link, supplier_notes, images_json, uniqueSlug]
    );

    res.status(201).json({ id: result.rows[0].id, message: 'Товар создан', slug: uniqueSlug });
  } catch (err) {
    console.error('Ошибка создания товара:', err);
    res.status(500).json({ error: 'Не удалось создать товар' });
  }
});

/**
 * DELETE /api/products/:id
 * Удалить товар
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('Ошибка удаления товара:', err);
    res.status(500).json({ error: 'Не удалось удалить товар' });
  }
});

/**
 * POST /api/products/bulk
 * Получить товары по массиву ID
 */
router.post('/bulk', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Неверный формат данных. Ожидается массив ID.' });
  }

  const validIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
  if (validIds.length === 0) {
    return res.status(400).json({ error: 'Не переданы валидные ID товаров.' });
  }

  try {
    const query = `
      SELECT id, title, description, price, tag, available, category,
        brand, compatibility, images_json, supplier_link, supplier_notes, slug
      FROM products
      WHERE id = ANY($1)
    `;

    const result = await pool.query(query, [validIds]);
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
    console.error('Ошибка при загрузке товаров по ID (bulk):', err);
    res.status(500).json({ error: 'Ошибка сервера при загрузке товаров.' });
  }
});

module.exports = router;

