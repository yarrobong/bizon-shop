const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { generateAttractionSlug } = require('../utils/slug');
const { xmlEscape } = require('../utils/xmlEscape');
const cache = require('../utils/cache');

// ========== ПУБЛИЧНЫЕ РОУТЫ (без аутентификации) ==========

/**
 * GET /api/attractions/yml
 * Генерация YML-фида для аттракционов (публичный доступ)
 */
router.get('/yml', async (req, res) => {
  try {
    const attractionsQuery = `
      SELECT id, title, price, category, image_url AS image, description, slug,
        specs_places AS "specs.places", specs_power AS "specs.power",
        specs_games AS "specs.games", specs_area AS "specs.area",
        specs_dimensions AS "specs.dimensions"
      FROM attractions
      WHERE available = true
      ORDER BY id ASC;
    `;
    const attractionsResult = await pool.query(attractionsQuery);

    const BASE_URL = process.env.BASE_URL || 'https://bizon-business.ru';

    const makeAbsoluteUrl = (url) => {
      if (!url || typeof url !== 'string') return null;
      // Убираем пробелы
      url = url.trim();
      if (!url) return null;
      // Если уже абсолютный URL, возвращаем как есть
      if (/^https?:\/\//i.test(url)) return url;
      // Если начинается со слеша, добавляем BASE_URL
      if (url.startsWith('/')) return `${BASE_URL}${url}`;
      // Иначе добавляем BASE_URL и слеш
      return `${BASE_URL}/${url}`;
    };

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
      imagesMap[img.attraction_id].push(img.url);
    });

    let ymlContent = `<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog date="${new Date().toISOString().replace('T', ' ').substring(0, 19)}">
 <shop>
  <name>BIZON</name> 
  <company>BIZON</company> 
  <url>https://bizon-business.ru</url> 
  <currencies>
   <currency id="RUR" rate="1"/>
  </currencies>
  <categories>
`;

    const categoriesSet = new Set(attractionsResult.rows.map(row => row.category).filter(cat => cat));
    let categoryIdMap = new Map();
    let catIdCounter = 1;
    for (const catName of categoriesSet) {
      if (!categoryIdMap.has(catName)) {
        categoryIdMap.set(catName, catIdCounter);
        ymlContent += `   <category id="${catIdCounter}">${xmlEscape(catName)}</category>\n`;
        catIdCounter++;
      }
    }

    ymlContent += `  </categories>\n  <offers>\n`;

    attractionsResult.rows.forEach(row => {
      // Получаем все изображения и преобразуем в абсолютные URL
      const imagesForAttraction = (imagesMap[row.id] || []).map(makeAbsoluteUrl).filter(Boolean);
      const primaryImage = imagesForAttraction.length > 0 
        ? imagesForAttraction[0] 
        : (row.image ? makeAbsoluteUrl(row.image) : null);
      
      // Пропускаем офферы без изображений (picture обязателен)
      if (!primaryImage) {
        console.warn(`⚠️ Аттракцион ID ${row.id} не имеет изображений, пропускаем из фида`);
        return;
      }
      
      const category_id = categoryIdMap.get(row.category) || '';

      // vendor и typePrefix обязательны - всегда заполняем
      const vendor = (row.category && String(row.category).trim()) ? String(row.category).trim() : 'BIZON';
      const typePrefix = (row.category && String(row.category).trim()) ? String(row.category).trim() : 'VR-аттракцион';

      // Проверяем что vendor и typePrefix не пустые
      if (!vendor || !typePrefix) {
        console.warn(`⚠️ Аттракцион ID ${row.id} имеет пустые vendor/typePrefix, используем значения по умолчанию`);
      }

      ymlContent += `   <offer id="${row.id}" type="vendor.model">\n`;
      ymlContent += `    <name>${xmlEscape(row.title || '')}</name>\n`;
      ymlContent += `    <url>https://bizon-business.ru/attraction/${row.slug || row.id}</url>\n`;
      ymlContent += `    <price>${parseFloat(row.price) || 0}</price>\n`;
      ymlContent += `    <currencyId>RUR</currencyId>\n`;
      if (category_id) {
        ymlContent += `    <categoryId>${category_id}</categoryId>\n`;
      }
      // picture обязателен - всегда добавляем
      ymlContent += `    <picture>${xmlEscape(primaryImage)}</picture>\n`;
      
      // Дополнительные изображения
      if (imagesForAttraction.length > 1) {
        imagesForAttraction.slice(1).forEach(pic => {
          if (pic && pic.trim()) {
            ymlContent += `    <picture>${xmlEscape(pic)}</picture>\n`;
          }
        });
      }
      if (row.description) {
        ymlContent += `    <description>${xmlEscape(row.description)}</description>\n`;
      }
      // vendor и typePrefix всегда должны быть заполнены и не пустые
      ymlContent += `    <vendor>${xmlEscape(vendor || 'BIZON')}</vendor>\n`;
      ymlContent += `    <typePrefix>${xmlEscape(typePrefix || 'VR-аттракцион')}</typePrefix>\n`;
      ymlContent += `    <model>${xmlEscape(row.title || '')}</model>\n`;

      if (row["specs.places"]) ymlContent += `    <param name="Количество мест">${xmlEscape(row["specs.places"])}</param>\n`;
      if (row["specs.power"]) ymlContent += `    <param name="Потребляемая мощность">${xmlEscape(row["specs.power"])}</param>\n`;
      if (row["specs.area"]) ymlContent += `    <param name="Площадь">${xmlEscape(row["specs.area"])}</param>\n`;
      if (row["specs.dimensions"]) ymlContent += `    <param name="Габариты">${xmlEscape(row["specs.dimensions"])}</param>\n`;
      if (row["specs.games"]) ymlContent += `    <param name="Игры">${xmlEscape(row["specs.games"])}</param>\n`;

      ymlContent += `   </offer>\n`;
    });

    ymlContent += `  </offers>\n </shop>\n</yml_catalog>`;

    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.send(ymlContent);
  } catch (err) {
    console.error('❌ Ошибка при генерации YML-фида:', err);
    res.status(500).send('Ошибка сервера при генерации фида.');
  }
});

/**
 * GET /api/attractions
 * Получить доступные аттракционы (публичный доступ)
 */
router.get('/', async (req, res) => {
  try {
    const attractionsQuery = `
      SELECT id, title, price, category, image_url AS image, description, slug,
        specs_places AS "specs.places", specs_power AS "specs.power",
        specs_games AS "specs.games", specs_area AS "specs.area",
        specs_dimensions AS "specs.dimensions"
      FROM attractions
      WHERE available = true
      ORDER BY id ASC;
    `;
    const attractionsResult = await pool.query(attractionsQuery);

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
        title: row.title,
        price: parseFloat(row.price),
        category: row.category,
        images: imagesForAttraction,
        description: row.description,
        specs: {
          places: row["specs.places"] || null,
          power: row["specs.power"] || null,
          games: row["specs.games"] || null,
          area: row["specs.area"] || null,
          dimensions: row["specs.dimensions"] || null
        },
        slug: row.slug
      };
    });

    res.json(attractions);
  } catch (err) {
    console.error('❌ Ошибка при получении аттракционов:', err);
    res.status(500).json({ error: 'Не удалось загрузить аттракционы', details: err.message });
  }
});

/**
 * GET /api/attractions/categories
 * Получить уникальные категории аттракционов (публичный доступ)
 */
router.get('/categories', async (req, res) => {
  try {
    const query = 'SELECT DISTINCT category FROM attractions WHERE category IS NOT NULL ORDER BY category;';
    const result = await pool.query(query);
    const categories = result.rows.map(row => row.category);
    res.json(categories);
  } catch (err) {
    console.error('❌ Ошибка при получении категорий аттракционов:', err);
    res.status(500).json({ error: 'Не удалось загрузить категории аттракционов', details: err.message });
  }
});

/**
 * GET /api/attractions/slug/:slug
 * Получить аттракцион по slug (публичный доступ)
 */
router.get('/slug/:slug', async (req, res) => {
  const { slug } = req.params;
  try {
    const decodedSlug = decodeURIComponent(slug);
    if (!decodedSlug) {
      return res.status(400).json({ error: 'Slug аттракциона не указан' });
    }

    const attractionResult = await pool.query(`
      SELECT id, title, price, category, image_url AS image, description, available,
        specs_places AS "specs.places", specs_power AS "specs.power",
        specs_games AS "specs.games", specs_area AS "specs.area",
        specs_dimensions AS "specs.dimensions", slug
      FROM attractions
      WHERE slug = $1;
    `, [decodedSlug]);

    if (attractionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Аттракцион не найден' });
    }
    const row = attractionResult.rows[0];

    const imagesResult = await pool.query(`
      SELECT url, alt, sort_order
      FROM attraction_images
      WHERE attraction_id = $1
      ORDER BY sort_order ASC;
    `, [row.id]);

    let imagesArray = imagesResult.rows.map(img => ({
      url: img.url,
      alt: img.alt || ''
    }));

    if (imagesArray.length === 0 && row.image) {
      imagesArray.push({ url: row.image, alt: row.title || 'Изображение' });
    }

    const videosResult = await pool.query(`
      SELECT url, alt, sort_order, is_primary
      FROM attraction_videos
      WHERE attraction_id = $1
      ORDER BY sort_order ASC;
    `, [row.id]);

    const videosArray = videosResult.rows.map(vid => ({
      url: vid.url,
      alt: vid.alt || '',
      sort_order: vid.sort_order,
      is_primary: vid.is_primary
    }));

    const attraction = {
      id: row.id,
      title: row.title,
      price: parseFloat(row.price),
      category: row.category,
      available: row.available !== false,
      images: imagesArray,
      videos: videosArray,
      description: row.description,
      specs: {
        places: row["specs.places"] || null,
        power: row["specs.power"] || null,
        games: row["specs.games"] || null,
        area: row["specs.area"] || null,
        dimensions: row["specs.dimensions"] || null
      },
      slug: row.slug
    };

    res.json(attraction);
  } catch (err) {
    console.error(`❌ Ошибка при получении аттракциона по slug ${slug}:`, err);
    res.status(500).json({ error: 'Не удалось загрузить аттракцион', details: err.message });
  }
});

// ========== АДМИНСКИЕ РОУТЫ (требуют аутентификации) ==========

/**
 * GET /api/attractions/public
 * Получить все аттракционы для админки (требует аутентификации)
 */
router.get('/public', requireAuth, async (req, res) => {
  try {
    const attractionsQuery = `
      SELECT id, title, price, category, image_url AS image, description, available, slug,
        specs_places AS "specs.places", specs_power AS "specs.power",
        specs_games AS "specs.games", specs_area AS "specs.area",
        specs_dimensions AS "specs.dimensions"
      FROM attractions
      ORDER BY id ASC;
    `;
    const attractionsResult = await pool.query(attractionsQuery);

    const imagesResult = await pool.query(`
      SELECT attraction_id, url, alt, sort_order
      FROM attraction_images
      ORDER BY attraction_id, sort_order ASC;
    `);

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
        title: row.title,
        price: parseFloat(row.price),
        category: row.category,
        available: row.available,
        images: imagesForAttraction,
        description: row.description,
        specs: {
          places: row["specs.places"] || null,
          power: row["specs.power"] || null,
          games: row["specs.games"] || null,
          area: row["specs.area"] || null,
          dimensions: row["specs.dimensions"] || null
        },
        slug: row.slug
      };
    });

    res.json(attractions);
  } catch (err) {
    console.error('❌ Ошибка при получении аттракционов для админки:', err);
    res.status(500).json({ error: 'Не удалось загрузить аттракционы', details: err.message });
  }
});

/**
 * POST /api/attractions
 * Создать аттракцион (требует аутентификации)
 */
router.post('/', requireAuth, async (req, res) => {
  const { title, price, category, description, specs, images, videos, available, slug: providedSlug } = req.body;

  let primaryImageUrl = null;
  if (images && Array.isArray(images) && images.length > 0 && images[0].url) {
    primaryImageUrl = images[0].url;
  }

  const isAvailable = available !== false;
  const finalSlug = providedSlug || generateAttractionSlug(title);

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const query = `
        INSERT INTO attractions (
          title, price, category, image_url, description, available, specs_places, specs_power, specs_games, specs_area, specs_dimensions, slug
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id;
      `;
      const values = [
        title, price, category, primaryImageUrl, description, isAvailable,
        specs?.places || null, specs?.power || null, specs?.games || null,
        specs?.area || null, specs?.dimensions || null, finalSlug
      ];

      const result = await client.query(query, values);
      const newId = result.rows[0].id;

      // Batch insert для изображений (оптимизация вместо N запросов)
      if (images && Array.isArray(images) && images.length > 0) {
        const validImages = images.filter(img => img.url);
        if (validImages.length > 0) {
          const imageValues = validImages.map((img, i) => [newId, img.url, img.alt || '', i]);
          const imagePlaceholders = imageValues.map((_, idx) => {
            const base = idx * 4;
            return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
          }).join(', ');
          
          const imageInsertQuery = `
            INSERT INTO attraction_images (attraction_id, url, alt, sort_order)
            VALUES ${imagePlaceholders};
          `;
          
          await client.query(imageInsertQuery, imageValues.flat());
        }
      }

      // Batch insert для видео (оптимизация вместо N запросов)
      if (videos && Array.isArray(videos) && videos.length > 0) {
        const validVideos = videos.filter(vid => vid.url);
        if (validVideos.length > 0) {
          const videoValues = validVideos.map((vid, i) => [newId, vid.url, vid.alt || '', i, vid.is_primary || false]);
          const videoPlaceholders = videoValues.map((_, idx) => {
            const base = idx * 5;
            return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
          }).join(', ');
          
          const videoInsertQuery = `
            INSERT INTO attraction_videos (attraction_id, url, alt, sort_order, is_primary)
            VALUES ${videoPlaceholders};
          `;
          
          await client.query(videoInsertQuery, videoValues.flat());
        }
      }

      await client.query('COMMIT');
      client.release();

      // Инвалидируем кэш аттракционов после создания
      cache.invalidateAttractions();

      res.status(201).json({ id: newId, message: 'Аттракцион создан' });
    } catch (err) {
      await client.query('ROLLBACK');
      client.release();
      throw err;
    }
  } catch (err) {
    console.error('❌ Ошибка при создании аттракциона:', err);
    res.status(500).json({ error: 'Не удалось создать аттракцион', details: err.message });
  }
});

/**
 * PUT /api/attractions/:id
 * Обновить аттракцион (требует аутентификации)
 */
router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { title, price, category, description, specs, images, videos, available } = req.body;
  const { slug: providedSlug } = req.body;

  let primaryImageUrl = null;
  if (images && Array.isArray(images) && images.length > 0 && images[0].url) {
    primaryImageUrl = images[0].url;
  }

  const isAvailableProvided = 'available' in req.body;
  const isAvailable = isAvailableProvided ? available === true : undefined;
  const slugProvided = 'slug' in req.body && providedSlug !== undefined && providedSlug !== null;

  try {
    const attractionId = parseInt(id, 10);
    if (isNaN(attractionId)) {
      return res.status(400).json({ error: 'Некорректный ID аттракциона' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let query = `UPDATE attractions SET `;
      const values = [];
      let paramCounter = 1;

      const fieldsToUpdate = [
        { field: 'title', value: title },
        { field: 'price', value: price },
        { field: 'category', value: category },
        { field: 'image_url', value: primaryImageUrl },
        { field: 'description', value: description },
        { field: 'specs_places', value: specs?.places || null },
        { field: 'specs_power', value: specs?.power || null },
        { field: 'specs_games', value: specs?.games || null },
        { field: 'specs_area', value: specs?.area || null },
        { field: 'specs_dimensions', value: specs?.dimensions || null }
      ];

      fieldsToUpdate.forEach(({ field, value }) => {
        if (value !== undefined) {
          if (values.length > 0) query += ', ';
          query += `${field} = $${paramCounter}`;
          values.push(value);
          paramCounter++;
        }
      });

      if (isAvailableProvided) {
        if (values.length > 0) query += ', ';
        query += `available = $${paramCounter}`;
        values.push(isAvailable);
        paramCounter++;
      }

      if (slugProvided) {
        if (values.length > 0) query += ', ';
        query += `slug = $${paramCounter}`;
        values.push(providedSlug);
        paramCounter++;
      }

      query += ` WHERE id = $${paramCounter}`;
      values.push(attractionId);

      await client.query(query, values);

      await client.query('DELETE FROM attraction_images WHERE attraction_id = $1', [attractionId]);

      // Batch insert для изображений (оптимизация вместо N запросов)
      if (images && Array.isArray(images) && images.length > 0) {
        const validImages = images.filter(img => img.url);
        if (validImages.length > 0) {
          const imageValues = validImages.map((img, i) => [attractionId, img.url, img.alt || '', i]);
          const imagePlaceholders = imageValues.map((_, idx) => {
            const base = idx * 4;
            return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
          }).join(', ');
          
          const imageInsertQuery = `
            INSERT INTO attraction_images (attraction_id, url, alt, sort_order)
            VALUES ${imagePlaceholders};
          `;
          
          await client.query(imageInsertQuery, imageValues.flat());
        }
      }

      await client.query('DELETE FROM attraction_videos WHERE attraction_id = $1', [attractionId]);

      // Batch insert для видео (оптимизация вместо N запросов)
      if (videos && Array.isArray(videos) && videos.length > 0) {
        const validVideos = videos.filter(vid => vid.url);
        if (validVideos.length > 0) {
          const videoValues = validVideos.map((vid, i) => [attractionId, vid.url, vid.alt || '', i, vid.is_primary || false]);
          const videoPlaceholders = videoValues.map((_, idx) => {
            const base = idx * 5;
            return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
          }).join(', ');
          
          const videoInsertQuery = `
            INSERT INTO attraction_videos (attraction_id, url, alt, sort_order, is_primary)
            VALUES ${videoPlaceholders};
          `;
          
          await client.query(videoInsertQuery, videoValues.flat());
        }
      }

      await client.query('COMMIT');
      client.release();

      // Инвалидируем кэш аттракционов после обновления
      cache.invalidateAttractions();
      
      res.json({ message: 'Аттракцион обновлен' });
    } catch (err) {
      await client.query('ROLLBACK');
      client.release();
      throw err;
    }
  } catch (err) {
    console.error(`❌ Ошибка при обновлении аттракциона с ID ${id}:`, err);
    res.status(500).json({ error: 'Не удалось обновить аттракцион', details: err.message });
  }
});

/**
 * DELETE /api/attractions/:id
 * Удалить аттракцион (требует аутентификации)
 */
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const attractionId = parseInt(id, 10);
    if (isNaN(attractionId)) {
      return res.status(400).json({ error: 'Некорректный ID аттракциона' });
    }

    const checkResult = await pool.query('SELECT 1 FROM attractions WHERE id = $1', [attractionId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Аттракцион не найден для удаления' });
    }

    await pool.query('DELETE FROM attractions WHERE id = $1', [attractionId]);
    // Инвалидируем кэш аттракционов после удаления
    cache.invalidateAttractions();
    
    res.json({ message: 'Аттракцион удален' });
  } catch (err) {
    console.error(`❌ Ошибка при удалении аттракциона с ID ${id}:`, err);
    res.status(500).json({ error: 'Не удалось удалить аттракцион', details: err.message });
  }
});

/**
 * GET /api/attractions/:id
 * Получить аттракцион по ID (требует аутентификации)
 */
router.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const attractionId = parseInt(id, 10);
    if (isNaN(attractionId)) {
      return res.status(400).json({ error: 'Некорректный ID аттракциона' });
    }

    const attractionResult = await pool.query(`
      SELECT id, title, price, category, image_url AS image, description,
        specs_places AS "specs.places", specs_power AS "specs.power",
        specs_games AS "specs.games", specs_area AS "specs.area",
        specs_dimensions AS "specs.dimensions"
      FROM attractions
      WHERE id = $1;
    `, [attractionId]);

    if (attractionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Аттракцион не найден' });
    }

    const row = attractionResult.rows[0];

    const imagesResult = await pool.query(`
      SELECT url, alt
      FROM attraction_images
      WHERE attraction_id = $1
      ORDER BY sort_order ASC;
    `, [attractionId]);

    let imagesArray = imagesResult.rows.map(img => ({
      url: img.url,
      alt: img.alt || ''
    }));

    if (imagesArray.length === 0 && row.image) {
      imagesArray.push({ url: row.image, alt: row.title || 'Изображение' });
    }

    const attraction = {
      id: row.id,
      title: row.title,
      price: parseFloat(row.price),
      category: row.category,
      images: imagesArray,
      description: row.description,
      specs: {
        places: row["specs.places"] || null,
        power: row["specs.power"] || null,
        games: row["specs.games"] || null,
        area: row["specs.area"] || null,
        dimensions: row["specs.dimensions"] || null
      }
    };

    res.json(attraction);
  } catch (err) {
    console.error(`❌ Ошибка при получении аттракциона с ID ${id}:`, err);
    res.status(500).json({ error: 'Не удалось загрузить аттракцион', details: err.message });
  }
});

module.exports = router;

