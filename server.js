require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Pool PostgreSQL ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL && process.env.DATABASE_URL !== 'undefined'
    ? process.env.DATABASE_URL
    : `postgres://${process.env.DB_USER}:${encodeURIComponent(process.env.DB_PASSWORD)}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: process.env.DB_HOST === 'localhost' || process.env.DB_HOST === '127.0.0.1' ? false : {
    rejectUnauthorized: false
  }
});

pool.on('error', (err) => {
  console.error('Неожиданная ошибка в пуле подключений PostgreSQL:', err);
  process.exit(-1);
});

// --- Middleware ---
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Multer ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'public', 'uploads')),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// --- Endpoint загрузки файлов ---
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не был загружен' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// --- Старт сервера ---
app.listen(PORT, async () => {
  console.log(`✅ Сервер запущен на http://localhost:${PORT}`);

  console.log('=== Environment Variables ===');
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
  console.log('DB_HOST:', process.env.DB_HOST);
  console.log('DB_PORT:', process.env.DB_PORT);
  console.log('DB_USER:', process.env.DB_USER);
  console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '[СКРЫТ]' : 'undefined');
  console.log('DB_NAME:', process.env.DB_NAME);
  console.log('============================');

  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Успешное подключение к БД. Текущее время на сервере:', res.rows[0].now);
  } catch (err) {
    console.error('❌ Ошибка подключения к БД при старте:', err);
  }
});

// Установка часового пояса (лучше делать на уровне ОС или БД, но можно и так)
process.env.TZ = 'Europe/Moscow';

// --- API: Товары ---
// === API: Получить товары ===
// Объединенный и исправленный маршрут получения товаров с вариантами
app.get('/api/products', async (req, res) => {
  try {
    // 1. Получаем все товары из таблицы products
    const productsResult = await pool.query('SELECT * FROM products');
    const products = productsResult.rows;
    // 2. Для каждого товара проверяем, есть ли у него варианты
    const productsWithVariants = await Promise.all(products.map(async (product) => {
      // --- Варианты ---
      let formattedVariants = [];
      const groupResult = await pool.query(
        `SELECT group_id FROM product_variants_link WHERE product_id = $1`,
        [product.id]
      );
      if (groupResult.rows.length > 0) {
        const groupId = groupResult.rows[0].group_id;
        const variantsResult = await pool.query(
  `SELECT p.*
   FROM product_variants_link pvl
   JOIN products p ON pvl.product_id = p.id
   WHERE pvl.group_id = $1
   ORDER BY p.id`, // <-- Здесь раньше было AND p.id != $2, чтобы исключить сам товар
  [groupId]
);
        formattedVariants = variantsResult.rows.map((variant) => {
          let images = [];
          if (variant.images_json != null) {
            if (Array.isArray(variant.images_json)) {
              images = variant.images_json;
            } else if (typeof variant.images_json === 'object') {
              images = [variant.images_json];
            } else {
              images = [variant.images_json];
            }
          }
          return {
            ...variant,
            images
          };
        });
      }
      // --- Основной товар ---
      let productImages = [];
      if (product.images_json != null) {
        if (Array.isArray(product.images_json)) {
          productImages = product.images_json;
        } else if (typeof product.images_json === 'object') {
          productImages = [product.images_json];
        } else {
          productImages = [product.images_json];
        }
      }
      return {
        ...product,
        images: productImages,
        variants: formattedVariants
      };
    }));
    res.json(productsWithVariants);
  } catch (err) {
    console.error('Ошибка в /api/products:', err);
    res.status(500).json({ error: 'Ошибка сервера при получении товаров' });
  }
});
// === API: Установить варианты товара ===
app.put('/api/products/:id/variants', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const productId = parseInt(id, 10); // Убедимся, что ID - это число
    const { variantIds } = req.body; // Ожидаем массив ID

    // --- Валидация входных данных ---
    if (isNaN(productId)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Некорректный ID товара' });
    }

    // Проверяем, существует ли основной товар
    const productExists = await client.query('SELECT 1 FROM products WHERE id = $1', [productId]);
    if (productExists.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Основной товар не найден' });
    }

    // Проверяем и нормализуем массив variantIds
    let validatedVariantIds = [];
    if (Array.isArray(variantIds)) {
        // Фильтруем, оставляя только уникальные числовые ID, отличные от productId
        validatedVariantIds = [...new Set(variantIds.map(vId => parseInt(vId, 10)).filter(vId => !isNaN(vId) && vId !== productId))];
    }
    console.log(`Установка вариантов для товара ID ${productId}. Валидные варианты:`, validatedVariantIds);

    // --- Логика управления группой вариантов ---
    // 1. Найти существующую группу для этого товара
    const existingGroupRes = await client.query(
      'SELECT group_id FROM product_variants_link WHERE product_id = $1',
      [productId]
    );

    let groupIdToUse = null;

    if (validatedVariantIds.length > 0) {
        // --- Сценарий: Нужно создать или обновить группу ---
        if (existingGroupRes.rows.length > 0) {
            // Товар уже в группе, используем её ID
            groupIdToUse = existingGroupRes.rows[0].group_id;
            console.log(`Товар ID ${productId} уже в группе ${groupIdToUse}. Обновляем состав.`);
        } else {
            // Товар не в группе, создаем новую, используя ID основного товара как group_id
            groupIdToUse = productId;
            console.log(`Товар ID ${productId} не в группе. Создаем новую группу ${groupIdToUse}.`);
        }

        // 2. Удаляем все связи *для этой группы* (это очистит старые связи и подготовит к новым)
        await client.query('DELETE FROM product_variants_link WHERE group_id = $1', [groupIdToUse]);
        console.log(`Удалены все старые связи для группы ID ${groupIdToUse}.`);

        // 3. Создаем новые связи для обновленной конфигурации группы
        // Связываем основной товар с группой
        await client.query(
            'INSERT INTO product_variants_link (product_id, group_id) VALUES ($1, $2)',
            [productId, groupIdToUse]
        );
        console.log(`Связь основного товара ID ${productId} с группой ID ${groupIdToUse} создана.`);

        // Связываем варианты с группой
        // Сначала проверим, существуют ли все указанные варианты
        if (validatedVariantIds.length > 0) {
            const placeholders = validatedVariantIds.map((_, i) => `$${i + 1}`).join(', ');
            const checkVariantsQuery = `SELECT id FROM products WHERE id IN (${placeholders})`;
            const checkResult = await client.query(checkVariantsQuery, validatedVariantIds);
            const existingVariantIds = checkResult.rows.map(r => r.id);
            const notFoundIds = validatedVariantIds.filter(id => !existingVariantIds.includes(id));
            
            if (notFoundIds.length > 0) {
                console.warn(`Некоторые варианты не найдены и будут проигнорированы:`, notFoundIds);
            }

            // Вставляем связи только для существующих вариантов
            for (const variantId of existingVariantIds) {
                await client.query(
                    'INSERT INTO product_variants_link (product_id, group_id) VALUES ($1, $2)',
                    [variantId, groupIdToUse]
                );
                console.log(`Связь варианта ID ${variantId} с группой ID ${groupIdToUse} создана.`);
            }
        }

    } else {
        // --- Сценарий: Нужно удалить все варианты (очистить группу) ---
        if (existingGroupRes.rows.length > 0) {
            const oldGroupId = existingGroupRes.rows[0].group_id;
            // Удаляем все связи *для этой группы*
            await client.query('DELETE FROM product_variants_link WHERE group_id = $1', [oldGroupId]);
            console.log(`Группа ID ${oldGroupId} (содержавшая товар ID ${productId}) была очищена и удалена.`);
        } else {
            console.log(`У товара ID ${productId} нет группы для очистки.`);
        }
        // Если validatedVariantIds пуст, то на этом шаге все старые связи уже удалены или их не было.
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Варианты товара обновлены', groupId: groupIdToUse });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Ошибка установки вариантов товара:', err);
    // Возвращаем более конкретную ошибку, если это ошибка клиента
    if (err.code === '23503' || err.code === '23505') { //_foreign_key_violation или unique_violation
         res.status(400).json({ error: 'Ошибка данных при обновлении вариантов' });
    } else {
         res.status(500).json({ error: 'Не удалось обновить варианты товара' });
    }
  } finally {
    client.release();
  }
});

// === API: Обновить товар ===
app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Добавлены новые поля supplier_link, supplier_notes
    const { title, description, price, tag, available, category, brand, compatibility, supplier_link, supplier_notes, images } = req.body;
    const images_json = images ? JSON.stringify(images) : null;

    // 1. Обновляем основные данные товара
    const result = await pool.query(`
      UPDATE products
      SET title = $1, description = $2, price = $3, tag = $4, available = $5, category = $6, brand = $7, compatibility = $8, supplier_link = $9, supplier_notes = $10, images_json = $11
      WHERE id = $12
      RETURNING id, title, description, price, tag, available, category, brand, compatibility, supplier_link, supplier_notes, images_json -- images_json будет обработано ниже
    `, [title, description, price, tag, available, category, brand, compatibility, supplier_link, supplier_notes, images_json, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    // 2. Обрабатываем images_json для ответа, как в GET /api/products/:id
    const updatedProductFromDB = result.rows[0]; // <-- Используем корректное имя переменной
    let processedImages = [];
    
    // Проверяем и обрабатываем images_json из результата БД
    if (updatedProductFromDB.images_json != null) { 
      if (Array.isArray(updatedProductFromDB.images_json)) {
        processedImages = updatedProductFromDB.images_json;
      } else if (typeof updatedProductFromDB.images_json === 'object') {
        processedImages = [updatedProductFromDB.images_json];
      } else {
        // Если это строка или другой тип, можно попробовать парсить или оставить пустой массив
        // processedImages = []; // или попытка JSON.parse, если ожидается строка JSON
         console.warn(`Неожиданный тип images_json для обновленного товара ID ${id}:`, typeof updatedProductFromDB.images_json);
         processedImages = [];
      }
    }
    // Если images_json null или undefined, processedImages остается []

    // 3. Формируем финальный объект товара для ответа
    const { images_json: _, ...productWithoutImagesJson } = updatedProductFromDB; // Убираем images_json из результата БД
    
    res.json({
      ...productWithoutImagesJson, // Все поля, кроме images_json
      images: processedImages       // Добавляем обработанное поле images
    });
    
  } catch (err) {
    console.error('Ошибка обновления товара:', err);
    res.status(500).json({ error: 'Не удалось обновить товар' });
  }
});
// === API: Получить товар по ID ===
app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT
        id, title, description, price, tag, available, category, brand, compatibility,
        supplier_link, supplier_notes,
        images_json -- Поле будет обработано ниже
      FROM products
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    const product = result.rows[0];
    // --- Исправленная обработка images_json для товара по ID ---
    let productImages = [];
    // Ожидаем, что драйвер pg уже преобразовал JSON из БД в JS объект/массив
    // Проверяем, является ли результат допустимым массивом или объектом
    if (Array.isArray(product.images_json)) {
      productImages = product.images_json;
    } else if (product.images_json !== null && typeof product.images_json === 'object') {
      // Если это объект (не null), оборачиваем его в массив
      productImages = [product.images_json];
    } else if (product.images_json === null || product.images_json === undefined) {
      // Если null/undefined, оставляем пустой массив
      productImages = [];
    } else {
      // Если это что-то другое (например, неправильно сохраненная строка),
      // можно попробовать парсить или залогировать ошибку
      console.warn(`Неожиданный тип или значение images_json для товара ID ${product.id}:`, typeof product.images_json, product.images_json);
      productImages = []; // Или попытаться парсить: try { productImages = JSON.parse(product.images_json); } catch(e) { productImages = []; }
    }
    // --- Конец исправленной обработки ---

    res.json({
       ...product,
       images: productImages // Теперь images - это массив
    });
  } catch (err) {
    console.error('Ошибка загрузки товара по ID:', err);
    res.status(500).json({ error: 'Не удалось загрузить товар' });
  }
});

// === API: Создать товар ===
app.post('/api/products', async (req, res) => {
  try {
    // Добавлены новые поля supplier_link, supplier_notes
    const { title, description, price, tag, available, category, brand, compatibility, supplier_link, supplier_notes, images } = req.body;

    const images_json = images ? JSON.stringify(images) : null;

    // Возвращаем все поля, кроме images_json. images будет обработано отдельно.
    const result = await pool.query(`
      INSERT INTO products (title, description, price, tag, available, category, brand, compatibility, supplier_link, supplier_notes, images_json)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, title, description, price, tag, available, category, brand, compatibility, supplier_link, supplier_notes -- images_json исключен
    `, [title, description, price, tag, available, category, brand, compatibility, supplier_link, supplier_notes, images_json]);

    // Обрабатываем images_json для ответа, как в GET
    const insertedProduct = result.rows[0];
    let processedImages = [];
    if (Array.isArray(images)) {
      processedImages = images; // Возвращаем то, что клиент отправил
    } else if (images !== null && typeof images === 'object') {
      processedImages = [images];
    }
    // Если images было null/undefined/строкой, processedImages останется []

    res.status(201).json({
      ...insertedProduct,
      images: processedImages // Добавляем корректно обработанное поле images
    });
  } catch (err) {
    console.error('Ошибка создания товара:', err);
    res.status(500).json({ error: 'Не удалось создать товар' });
  }
});


// === API: Удалить товар ===
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }
    res.status(204).send(); // 204 No Content - успешно удалено
  } catch (err) {
    console.error('Ошибка удаления товара:', err);
    res.status(500).json({ error: 'Не удалось удалить товар' });
  }
});

// --- API: Категории ---
// === API: Получить категории ===
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM categories ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка загрузки категорий:', err);
    res.status(500).json({ error: 'Не удалось загрузить категории' });
  }
});

// === API: Создать категорию ===
app.post('/api/categories', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Название категории обязательно' });
    }

    const result = await pool.query(
      'INSERT INTO categories (name) VALUES ($1) RETURNING id, name',
      [name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка создания категории:', err);
    res.status(500).json({ error: 'Не удалось создать категорию' });
  }
});

// === API: Удалить категорию ===
app.delete('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Категория не найдена' });
    }
    res.status(204).send(); // 204 No Content - успешно удалено
  } catch (err) {
    console.error('Ошибка удаления категории:', err);
    res.status(500).json({ error: 'Не удалось удалить категорию' });
  }
});

// --- API: Заказы ---
// === API: Оформить заказ ===
app.post('/api/order', async (req, res) => {
  console.log('=== НАЧАЛО ОБРАБОТКИ ЗАКАЗА ===');
  console.log('Полученные данные:', req.body);

  const { phone, comment, cart } = req.body;

  if (!phone || !cart || cart.length === 0) {
    console.log('ОШИБКА: Недостаточно данных');
    return res.status(400).json({ success: false, error: 'Недостаточно данных' });
  }

  const requestHash = JSON.stringify({ phone, comment, cart });
  if (req.app.locals.lastOrderRequest === requestHash) {
    console.log('ПРЕДУПРЕЖДЕНИЕ: Повторный запрос с теми же данными обнаружен');
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

  // --- Исправление: Объявление orderId в нужной области видимости ---
  let orderId = null; // Объявляем здесь, чтобы было доступно в блоке catch
  // --- Конец исправления ---
  let orderSaved = false;
  let telegramSent = false;

  try {
    const total = cart.reduce((sum, item) => sum + (item.product?.price || 0) * item.qty, 0);
    console.log('Рассчитанная сумма:', total);

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
    console.log('Время заказа (Москва):', moscowTimeString);

    if (pool) {
      console.log('Сохранение заказа в БД...');
      const orderResult = await pool.query(
        'INSERT INTO orders (phone, comment, total_amount, created_at) VALUES ($1, $2, $3, $4) RETURNING id',
        [phone, comment || '', total, moscowTimeObj]
      );
      orderId = orderResult.rows[0].id; // Присваиваем значение
      orderSaved = true;
      req.app.locals.lastOrderId = orderId;
      console.log('Заказ сохранен в БД с ID:', orderId);
    } else {
      console.warn('Подключение к БД отсутствует. Заказ не будет сохранен в БД.');
    }

    if (pool && orderId) {
      console.log('Сохранение позиций заказа в БД...');
      const itemInserts = cart.map(item => [
        orderId,
        item.product?.id,
        item.product?.title || 'Неизвестный товар',
        item.qty,
        item.product?.price || 0
      ]);

      if (itemInserts.length > 0) {
        const queryText = 'INSERT INTO order_items (order_id, product_id, product_title, quantity, price_per_unit) VALUES ';
        const queryValues = [];
        const placeholders = itemInserts.map((_, index) => {
          const start = index * 5 + 1;
          return `($${start}, $${start + 1}, $${start + 2}, $${start + 3}, $${start + 4})`;
        }).join(', ');

        itemInserts.forEach(item => {
          queryValues.push(...item);
        });

        await pool.query(queryText + placeholders, queryValues);
        console.log('Позиции заказа сохранены в БД');
      }
    }

    const cleanPhone = phone.replace(/[^0-9+]/g, '');

    const message = `
📦 *Новый заказ на BIZON!*
📞 *Телефон:* \`${cleanPhone}\`
💬 *Комментарий:* ${comment || 'не указан'}
🛒 *Товары:*
${cart.map(item => `• ${item.product?.title || 'Неизвестный товар'} ×${item.qty} — ${(item.product?.price || 0) * item.qty} ₽`).join('\n')}
💰 *Итого:* ${total} ₽
🕐 ${moscowTimeString}
`.trim();

    console.log('Подготовленное сообщение для Telegram:', message);

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (BOT_TOKEN && CHAT_ID) {
      try {
        console.log('Отправка сообщения в Telegram...');
        // --- Исправление: Удален лишний пробел в URL ---
        await axios.post(
          `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, // Исправлен URL
          {
            chat_id: CHAT_ID,
            text: message,
            parse_mode: 'Markdown',
            disable_web_page_preview: true
          }
        );
        // --- Конец исправления ---
        telegramSent = true;
        console.log('Сообщение успешно отправлено в Telegram');
      } catch (telegramError) {
        console.error('Ошибка отправки в Telegram:', telegramError.message);
        // Не возвращаем ошибку клиенту из-за Telegram, заказ уже сохранен
      }
    } else {
      console.warn('Токен Telegram бота или ID чата не настроены');
    }

    console.log('=== ЗАКАЗ УСПЕШНО ОБРАБОТАН ===');
    res.json({
      success: true,
      orderId: orderId,
      savedToDB: orderSaved,
      sentToTelegram: telegramSent
    });

  } catch (error) {
    console.error('КРИТИЧЕСКАЯ ОШИБКА обработки заказа:', error);
    // --- Исправление: orderId теперь доступен здесь ---
    req.app.locals.lastOrderRequest = null;
    req.app.locals.lastOrderId = null;
    // --- Конец исправления ---
    res.status(500).json({ success: false, error: 'Ошибка обработки заказа на сервере' });
  }
});

// === API: Получить заказы ===
app.get('/api/orders', async (req, res) => {
  try {
    const ordersResult = await pool.query(`
      SELECT
        id,
        phone,
        comment,
        total_amount,
        created_at,
        COALESCE(status, 'новый') as status
      FROM orders
      ORDER BY created_at DESC
    `);

    const ordersWithItems = await Promise.all(ordersResult.rows.map(async (order) => {
      const itemsResult = await pool.query(`
        SELECT
          product_id,
          product_title,
          quantity,
          price_per_unit,
          (quantity * price_per_unit) as total_price
        FROM order_items
        WHERE order_id = $1
        ORDER BY id
      `, [order.id]);

      return {
        ...order,
        items: itemsResult.rows || []
      };
    }));

    res.json(ordersWithItems);
  } catch (err) {
    console.error('Ошибка загрузки заказов:', err);
    res.status(500).json({ error: 'Не удалось загрузить заказы: ' + err.message });
  }
});

// === API: Обновить статус заказа ===
app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['новый', 'в обработке', 'отправлен', 'доставлен', 'отменен'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Недопустимый статус' });
    }

    const result = await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING id',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Заказ не найден' });
    }

    res.json({ success: true, message: 'Статус обновлен' });
  } catch (err) {
    console.error('Ошибка обновления статуса заказа:', err);
    res.status(500).json({ error: 'Не удалось обновить статус заказа' });
  }
});

// === API: Удалить заказ ===
app.delete('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Сначала удаляем все позиции заказа
    await pool.query('DELETE FROM order_items WHERE order_id = $1', [id]);

    // Потом удаляем сам заказ
    const result = await pool.query('DELETE FROM orders WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Заказ не найден' });
    }

    res.json({ success: true, message: 'Заказ удален успешно' });
  } catch (err) {
    console.error('Ошибка удаления заказа:', err);
    res.status(500).json({ error: 'Не удалось удалить заказ: ' + err.message });
  }
});

// --- API: Аутентификация ---
// === API: Логин администратора ===
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Логин и пароль обязательны' });
    }

    if (!pool) {
      console.error('Подключение к БД не настроено');
      return res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }

    const result = await pool.query(
      'SELECT id, username, password_hash FROM admin_users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Неверный логин или пароль' });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Неверный логин или пароль' });
    }

    res.json({ success: true, message: 'Авторизация успешна' });

  } catch (err) {
    console.error('Ошибка авторизации:', err);
    res.status(500).json({ success: false, message: 'Ошибка сервера при авторизации' });
  }
});

// --- API: Обратная связь ---
// === API: Обратный звонок (Контактная форма) ===
app.post('/api/contact', async (req, res) => {
  console.log('=== НАЧАЛО ОБРАБОТКИ ЗАЯВКИ НА ОБРАТНЫЙ ЗВОНОК ===');
  console.log('Полученные данные:', req.body);

  const { name, phone } = req.body;

  if (!phone) {
    console.log('ОШИБКА: Не указан номер телефона');
    return res.status(400).json({ success: false, error: 'Не указан номер телефона' });
  }

  const requestHash = JSON.stringify({ name, phone });
  if (req.app.locals.lastContactRequest === requestHash) {
    console.log('ПРЕДУПРЕЖДЕНИЕ: Повторный запрос с теми же данными обнаружен');
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

  let dbSaved = false;
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
    console.log('Время заявки (Москва):', moscowTimeString);

    const cleanPhone = phone.replace(/[^0-9+]/g, '');

    const message = `
📞 *Новая заявка на обратный звонок BIZON!*
👤 *Имя:* ${name || 'не указано'}
📱 *Телефон:* \`${cleanPhone}\`
🕐 ${moscowTimeString}
`.trim();

    console.log('Подготовленное сообщение для Telegram:', message);

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (BOT_TOKEN && CHAT_ID) {
      try {
        console.log('Отправка сообщения в Telegram...');
        // --- Исправление: Удален лишний пробел в URL ---
        await axios.post(
          `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, // Исправлен URL
          {
            chat_id: CHAT_ID,
            text: message,
            parse_mode: 'Markdown',
            disable_web_page_preview: true
          }
        );
        // --- Конец исправления ---
        telegramSent = true;
        console.log('Сообщение успешно отправлено в Telegram');
      } catch (telegramError) {
        console.error('Ошибка отправки в Telegram:', telegramError.message);
        // Не возвращаем ошибку клиенту из-за Telegram
      }
    } else {
      console.warn('Токен Telegram бота или ID чата не настроены');
    }

    console.log('=== ЗАЯВКА УСПЕШНО ОБРАБОТАНА ===');
    res.json({
      success: true,
      savedToDB: dbSaved,
      sentToTelegram: telegramSent
    });

  } catch (error) {
    console.error('КРИТИЧЕСКАЯ ОШИБКА обработки заявки:', error);
    req.app.locals.lastContactRequest = null;
    res.status(500).json({ success: false, error: 'Ошибка обработки заявки на сервере' });
  }
});

// --- API endpoint для получения аттракционов из БД ---
app.get('/api/attractions', async (req, res) => {
  console.log('Получение списка аттракционов из БД...');
  try {
    // Выполняем запрос к БД
    // Предполагается, что таблица называется 'attractions'
    const query = `
      SELECT 
        id, 
        title, 
        price, 
        category, 
        image_url AS image, 
        description,
        specs_places AS "specs.places",
        specs_power AS "specs.power",
        specs_games AS "specs.games",
        specs_area AS "specs.area",
        specs_dimensions AS "specs.dimensions"
      FROM attractions
      ORDER BY id ASC; -- или другой порядок, например, по названию или категории
    `;
    const result = await pool.query(query);

    // Преобразуем результат из БД в формат, ожидаемый frontend'ом
    // Особенно важно правильно сформировать объект `specs`
    const attractions = result.rows.map(row => {
      // Создаем объект аттракциона
      const attraction = {
        id: row.id,
        title: row.title,
        price: parseFloat(row.price), // Убедимся, что цена - число
        category: row.category,
        image: row.image, // URL изображения
        description: row.description,
        // Формируем объект specs из отдельных полей
        specs: {
          places: row["specs.places"] || "N/A",
          power: row["specs.power"] || "N/A",
          games: row["specs.games"] || "N/A",
          area: row["specs.area"] || "N/A",
          dimensions: row["specs.dimensions"] || "N/A"
        }
      };
      return attraction;
    });

    console.log(`✅ Успешно получено ${attractions.length} аттракционов из БД`);
    // Отправляем JSON-массив аттракционов клиенту
    res.json(attractions);
  } catch (err) {
    console.error('❌ Ошибка при получении аттракционов из БД:', err);
    // Отправляем клиенту ошибку
    res.status(500).json({ error: 'Не удалось загрузить аттракционы', details: err.message });
  }
});

// --- КАСТОМНЫЕ МАРШРУТЫ ДЛЯ HTML СТРАНИЦ ---
// Универсальный маршрут для отдачи .html страниц (например, /catalog -> public/catalog.html)
// Должен идти ПОСЛЕ API, но ДО обработчика 404
app.get('/:page', async (req, res, next) => {
  // Исключаем API из этого маршрута, чтобы не перехватывать запросы к /api/...
  if (req.path.startsWith('/api/')) {
    // Если путь начинается с /api/, пропускаем этот маршрут
    return next();
  }

  const filePath = path.join(__dirname, 'public', `${req.params.page}.html`);

  try {
    // Используем fs.promises для асинхронной проверки
    await fs.access(filePath); // Проверяет существование файла
    const stats = await fs.stat(filePath);
    if (stats.isFile()) {
      return res.sendFile(filePath);
    }
    // Если это не файл (например, директория), передаем дальше
    next();
  } catch (err) {
    // Файл не найден, передаем управление дальше
    next();
  }
});

// --- ОБРАБОТЧИК 404 ---
// Должен быть ПОСЛЕДНИМ
app.use((req, res, next) => {
  console.log(`404 Not Found: ${req.originalUrl}`); // Для отладки
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});
