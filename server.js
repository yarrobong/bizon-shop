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

// === API: Получить товары (все поля) ===
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query(`
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
    `);

    const products = result.rows.map(row => {
      let images = [];
      if (row.images_json) {
        try {
          const parsed = JSON.parse(row.images_json);
          images = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          console.error(`Ошибка парсинга images_json для товара ${row.id}:`, e);
          images = [];
        }
      }

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

// --- API endpoint для получения аттракционов из БД (для админки - все аттракционы) ---
app.get('/api/attractions/public', async (req, res) => {
    console.log('Получение списка аттракционов из БД (для админки)...');
    try {
        // Получаем основные данные аттракционов
        const attractionsQuery = `
            SELECT
                id, title, price, category, image_url AS image, description, available, -- <-- Добавлен available
                specs_places AS "specs.places", specs_power AS "specs.power",
                specs_games AS "specs.games", specs_area AS "specs.area",
                specs_dimensions AS "specs.dimensions"
            FROM attractions
            ORDER BY id ASC;
        `;
        const attractionsResult = await pool.query(attractionsQuery);
        
        // Получаем все изображения для всех аттракционов за один запрос
        const imagesQuery = `
            SELECT attraction_id, url, alt, sort_order
            FROM attraction_images
            ORDER BY attraction_id, sort_order ASC;
        `;
        const imagesResult = await pool.query(imagesQuery);

        // Преобразуем массив изображений в Map для быстрого поиска
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

        // Формируем финальный массив аттракционов с изображениями
        const attractions = attractionsResult.rows.map(row => {
            // Получаем изображения для текущего аттракциона или пустой массив
            const imagesForAttraction = imagesMap[row.id] || [];
            
            // Для обратной совместимости: если массив пуст, используем старое поле image
            if (imagesForAttraction.length === 0 && row.image) {
                 imagesForAttraction.push({ url: row.image, alt: row.title || 'Изображение' });
            }

            return {
                id: row.id,
                title: row.title,
                price: parseFloat(row.price),
                category: row.category,
                available: row.available, // <-- Добавлен available
                // image: row.image, // Можно убрать, если фронтенд полностью перешел на images
                images: imagesForAttraction, // Массив изображений
                description: row.description,
                specs: {
                    places: row["specs.places"] || null,
                    power: row["specs.power"] || null,
                    games: row["specs.games"] || null,
                    area: row["specs.area"] || null,
                    dimensions: row["specs.dimensions"] || null
                }
            };
        });

        console.log(`✅ Успешно получено ${attractions.length} аттракционов из БД (для админки)`);
        res.json(attractions);
    } catch (err) {
        console.error('❌ Ошибка при получении аттракционов из БД (для админки):', err);
        res.status(500).json({ error: 'Не удалось загрузить аттракционы', details: err.message });
    }
});

// --- API endpoint для получения ДОСТУПНЫХ аттракционов из БД (для пользовательской части) ---
app.get('/api/attractions', async (req, res) => {
    console.log('Получение списка ДОСТУПНЫХ аттракционов из БД (для пользовательской части)...');
    try {
        // Получаем только доступные аттракционы
        const attractionsQuery = `
            SELECT
                id, title, price, category, image_url AS image, description, -- available не нужен для публичного API
                specs_places AS "specs.places", specs_power AS "specs.power",
                specs_games AS "specs.games", specs_area AS "specs.area",
                specs_dimensions AS "specs.dimensions"
            FROM attractions
            WHERE available = true -- <-- Фильтр по доступности
            ORDER BY id ASC;
        `;
        const attractionsResult = await pool.query(attractionsQuery);
        
        // Получаем все изображения для доступных аттракционов за один запрос
        // Сначала получим ID доступных аттракционов
        const availableAttractionIds = attractionsResult.rows.map(r => r.id);
        let imagesQuery, imagesResult;
        if (availableAttractionIds.length > 0) {
            const placeholders = availableAttractionIds.map((_, i) => `$${i + 1}`).join(', ');
            imagesQuery = `
                SELECT attraction_id, url, alt, sort_order
                FROM attraction_images
                WHERE attraction_id IN (${placeholders})
                ORDER BY attraction_id, sort_order ASC;
            `;
            imagesResult = await pool.query(imagesQuery, availableAttractionIds);
        } else {
            imagesResult = { rows: [] }; // Пустой результат, если нет доступных аттракционов
        }

        // Преобразуем массив изображений в Map для быстрого поиска
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

        // Формируем финальный массив доступных аттракционов с изображениями
        const attractions = attractionsResult.rows.map(row => {
            // Получаем изображения для текущего аттракциона или пустой массив
            const imagesForAttraction = imagesMap[row.id] || [];
            
            // Для обратной совместимости: если массив пуст, используем старое поле image
            if (imagesForAttraction.length === 0 && row.image) {
                 imagesForAttraction.push({ url: row.image, alt: row.title || 'Изображение' });
            }

            return {
                id: row.id,
                title: row.title,
                price: parseFloat(row.price),
                category: row.category,
                // available: row.available, // Убираем из публичного API
                // image: row.image, // Можно убрать, если фронтенд полностью перешел на images
                images: imagesForAttraction, // Массив изображений
                description: row.description,
                specs: {
                    places: row["specs.places"] || null,
                    power: row["specs.power"] || null,
                    games: row["specs.games"] || null,
                    area: row["specs.area"] || null,
                    dimensions: row["specs.dimensions"] || null
                }
            };
        });

        console.log(`✅ Успешно получено ${attractions.length} ДОСТУПНЫХ аттракционов из БД (для пользовательской части)`);
        res.json(attractions);
    } catch (err) {
        console.error('❌ Ошибка при получении ДОСТУПНЫХ аттракционов из БД (для пользовательской части):', err);
        res.status(500).json({ error: 'Не удалось загрузить аттракционы', details: err.message });
    }
});

// --- API endpoint для создания аттракциона ---
app.post('/api/attractions', async (req, res) => {
    const { title, price, category, description, specs, images, available } = req.body; // <-- Добавлен available
    console.log('Создание нового аттракциона:', req.body);

    // URL первого изображения для поля image_url (для обратной совместимости)
    let primaryImageUrl = null;
    if (images && Array.isArray(images) && images.length > 0 && images[0].url) {
        primaryImageUrl = images[0].url;
    }

    // Значение по умолчанию для available - true
    const isAvailable = available !== false; // Если available undefined или true, будет true. Если false, будет false.

    try {
        const query = `
      INSERT INTO attractions (
        title, price, category, image_url, description, available, -- <-- Добавлен available
        specs_places, specs_power, specs_games, specs_area, specs_dimensions
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) -- <-- Добавлен $6
      RETURNING id;
    `;
        const values = [
            title,
            price,
            category,
            primaryImageUrl,
            description,
            isAvailable, // <-- Используем isAvailable
            specs?.places || null,
            specs?.power || null,
            specs?.games || null,
            specs?.area || null,
            specs?.dimensions || null
        ];
        const result = await pool.query(query, values);
        const newId = result.rows[0].id;
        console.log(`✅ Аттракцион с ID ${newId} успешно создан в БД`);
        res.status(201).json({ id: newId, message: 'Аттракцион создан' });
    } catch (err) {
        console.error('❌ Ошибка при создании аттракциона в БД:', err);
        res.status(500).json({ error: 'Не удалось создать аттракцион', details: err.message });
    }
});

// --- API endpoint для обновления аттракциона ---
app.put('/api/attractions/:id', async (req, res) => {
    const { id } = req.params;
    const { title, price, category, description, specs, images, available } = req.body; // <-- Добавлен available
    console.log(`Обновление аттракциона с ID ${id}:`, req.body);

    // URL первого изображения для поля image_url (для обратной совместимости)
    let primaryImageUrl = null;
    if (images && Array.isArray(images) && images.length > 0 && images[0].url) {
        primaryImageUrl = images[0].url;
    }

    // Значение по умолчанию для available - true (если не передано, считаем, что не меняется или true)
    // Лучше явно проверить, было ли поле передано
    const isAvailableProvided = 'available' in req.body;
    const isAvailable = isAvailableProvided ? available === true : undefined; // undefined означает "не обновлять"

    try {
        const attractionId = parseInt(id, 10);
        if (isNaN(attractionId)) {
            return res.status(400).json({ error: 'Некорректный ID аттракциона' });
        }
        
        // Динамически строим запрос UPDATE
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
        
        // Добавляем available только если оно было передано
        if (isAvailableProvided) {
             fieldsToUpdate.push({ field: 'available', value: isAvailable });
        }

        query += fieldsToUpdate.map(f => `${f.field} = $${paramCounter++}`).join(', ');
        values.push(...fieldsToUpdate.map(f => f.value));
        query += ` WHERE id = $${paramCounter} RETURNING id;`;
        values.push(attractionId);

        const result = await pool.query(query, values);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Аттракцион не найден для обновления' });
        }
        console.log(`✅ Аттракцион с ID ${id} успешно обновлен в БД`);
        res.json({ message: 'Аттракцион обновлен' });
    } catch (err) {
        console.error(`❌ Ошибка при обновлении аттракциона с ID ${id} в БД:`, err);
        res.status(500).json({ error: 'Не удалось обновить аттракцион', details: err.message });
    }
});

// --- API endpoint для удаления аттракциона ---
// Удаление уже работает корректно благодаря CASCADE, но оставим для полноты
app.delete('/api/attractions/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`Удаление аттракциона с ID ${id} из БД...`);
    
    try {
        const attractionId = parseInt(id, 10);
        if (isNaN(attractionId)) {
            return res.status(400).json({ error: 'Некорректный ID аттракциона' });
        }

        // Проверим, существует ли аттракцион
        const checkResult = await pool.query('SELECT 1 FROM attractions WHERE id = $1', [attractionId]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Аттракцион не найден для удаления' });
        }

        // Удаляем аттракцион. CASCADE автоматически удалит связанные изображения.
        await pool.query('DELETE FROM attractions WHERE id = $1', [attractionId]);
        
        console.log(`✅ Аттракцион с ID ${id} успешно удален из БД (включая изображения)`);
        res.json({ message: 'Аттракцион удален' });
    } catch (err) {
        console.error(`❌ Ошибка при удалении аттракциона с ID ${id} из БД:`, err);
        res.status(500).json({ error: 'Не удалось удалить аттракцион', details: err.message });
    }
});

// --- API endpoint для получения уникальных категорий аттракционов ---
// Этот обработчик не требует изменений
app.get('/api/attractions/categories', async (req, res) => {
    console.log('Получение уникальных категорий аттракционов из БД...');
    try {
        const query = 'SELECT DISTINCT category FROM attractions WHERE category IS NOT NULL ORDER BY category;';
        const result = await pool.query(query);
        const categories = result.rows.map(row => row.category);
        console.log(`✅ Успешно получено ${categories.length} уникальных категорий аттракционов из БД`);
        res.json(categories);
    } catch (err) {
        console.error('❌ Ошибка при получении категорий аттракционов из БД:', err);
        res.status(500).json({ error: 'Не удалось загрузить категории аттракционов', details: err.message });
    }
});

// --- API endpoint для получения аттракциона по ID ---
// Обновлен для загрузки массива изображений
app.get('/api/attractions/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`Получение аттракциона с ID ${id} из БД...`);
    
    try {
        const attractionId = parseInt(id, 10);
        if (isNaN(attractionId)) {
            return res.status(400).json({ error: 'Некорректный ID аттракциона' });
        }

        // Получаем основные данные аттракциона
        const attractionQuery = `
            SELECT
                id, title, price, category, image_url AS image, description,
                specs_places AS "specs.places", specs_power AS "specs.power",
                specs_games AS "specs.games", specs_area AS "specs.area",
                specs_dimensions AS "specs.dimensions"
            FROM attractions
            WHERE id = $1;
        `;
        const attractionResult = await pool.query(attractionQuery, [attractionId]);

        if (attractionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Аттракцион не найден' });
        }

        const row = attractionResult.rows[0];

        // Получаем изображения для этого аттракциона
        const imagesQuery = `
            SELECT url, alt
            FROM attraction_images
            WHERE attraction_id = $1
            ORDER BY sort_order ASC;
        `;
        const imagesResult = await pool.query(imagesQuery, [attractionId]);
        let imagesArray = imagesResult.rows.map(img => ({
            url: img.url,
            alt: img.alt || ''
        }));

        // Для обратной совместимости: если массив пуст, используем старое поле image
        if (imagesArray.length === 0 && row.image) {
             imagesArray.push({ url: row.image, alt: row.title || 'Изображение' });
        }

        const attraction = {
            id: row.id,
            title: row.title,
            price: parseFloat(row.price),
            category: row.category,
            // image: row.image, // Можно убрать, если фронтенд полностью перешел на images
            images: imagesArray, // Массив изображений
            description: row.description,
            specs: {
                places: row["specs.places"] || null,
                power: row["specs.power"] || null,
                games: row["specs.games"] || null,
                area: row["specs.area"] || null,
                dimensions: row["specs.dimensions"] || null
            }
        };

        console.log(`✅ Успешно получен аттракцион с ID ${id} из БД`);
        res.json(attraction);
    } catch (err) {
        console.error(`❌ Ошибка при получении аттракциона с ID ${id} из БД:`, err);
        res.status(500).json({ error: 'Не удалось загрузить аттракцион', details: err.message });
    }
});

// На сервере (например, в вашем app.js или routes/products.js)
app.post('/api/products/bulk', async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Неверный формат данных. Ожидается массив ID.' });
    }

    // Очищаем и фильтруем ID
    const validIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));

    if (validIds.length === 0) {
        return res.status(400).json({ error: 'Не переданы валидные ID товаров.' });
    }

    try {
        // Используем параметризованный запрос для безопасности и эффективности
        // Предполагается, что у вас есть pool для подключения к БД (например, pg)
        const placeholders = validIds.map((_, i) => `$${i + 1}`).join(',');
        // Можно добавить AND available = true, если хотите фильтровать по доступности
        const query = `
            SELECT id, title, description, price, category, available, images_json
            FROM products
            WHERE id = ANY($1) -- Используем ANY для массива
        `;
        // const query = `SELECT ... WHERE id IN (${placeholders})`; // Альтернатива с IN

        const result = await pool.query(query, [validIds]); // pool - ваш пул соединений к БД
        const products = result.rows.map(row => ({
            id: row.id,
            title: row.title,
            description: row.description,
            price: parseFloat(row.price),
            category: row.category,
            available: row.available,
            images: row.images_json ? JSON.parse(row.images_json) : []
            // Добавьте другие поля, если нужно для отображения вариантов
        }));

        res.json(products);
    } catch (err) {
        console.error('Ошибка при загрузке товаров по ID (bulk):', err);
        res.status(500).json({ error: 'Ошибка сервера при загрузке товаров.' });
    }
});

// server.js (или в файле маршрутов, например, routes/products.js)

// === API: Получить товар по ID с вариантами (все поля) ===
app.get('/api/products/:id', async (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Некорректный ID товара' });
    }

    // 1. Загружаем основной товар
    const productResult = await pool.query(`
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
      WHERE id = $1`, [productId]);

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }
    const productRow = productResult.rows[0];

    // 2. Обработка изображений
    let productImages = [];
    if (productRow.images_json) {
      try {
        const parsed = JSON.parse(productRow.images_json);
        productImages = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error(`Ошибка парсинга images_json для товара ${productId}:`, e);
        productImages = [];
      }
    }

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

    // 3. Загружаем связанные варианты
    let variants = [];
    const groupResult = await pool.query(
      'SELECT group_id FROM product_variants_link WHERE product_id = $1',
      [product.id]
    );

    if (groupResult.rows.length > 0) {
      const groupId = groupResult.rows[0].group_id;
      const variantsResult = await pool.query(`
        SELECT
          p.id,
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
        FROM product_variants_link pvl
        JOIN products p ON pvl.product_id = p.id
        WHERE pvl.group_id = $1 AND p.id != $2
        ORDER BY p.id`,
        [groupId, product.id]
      );

      variants = variantsResult.rows.map(row => {
        let variantImages = [];
        if (row.images_json) {
          try {
            const parsed = JSON.parse(row.images_json);
            variantImages = Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            console.error(`Ошибка парсинга images_json для варианта ${row.id}:`, e);
            variantImages = [];
          }
        }

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
    console.error(`❌ Ошибка при получении товара с ID ${req.params.id} из БД:`, err);
    res.status(500).json({ error: 'Не удалось загрузить товар', details: err.message });
  }
});

// === API: Получить товар по slug (все поля) ===
app.get('/api/product-by-slug/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;

    const productResult = await pool.query(`
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
      WHERE slug = $1`, [slug]);

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    const productRow = productResult.rows[0];

    // Обработка изображений
    let productImages = [];
    if (productRow.images_json) {
      try {
        const parsed = JSON.parse(productRow.images_json);
        productImages = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error(`Ошибка парсинга images_json для товара ${productRow.id}:`, e);
        productImages = [];
      }
    }

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

    // Загрузка вариантов
    let variants = [];
    const groupResult = await pool.query(
      'SELECT group_id FROM product_variants_link WHERE product_id = $1',
      [product.id]
    );

    if (groupResult.rows.length > 0) {
      const groupId = groupResult.rows[0].group_id;
      const variantsResult = await pool.query(`
        SELECT
          p.id,
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
        FROM product_variants_link pvl
        JOIN products p ON pvl.product_id = p.id
        WHERE pvl.group_id = $1 AND p.id != $2
        ORDER BY p.id`,
        [groupId, product.id]
      );

      variants = variantsResult.rows.map(row => {
        let variantImages = [];
        if (row.images_json) {
          try {
            const parsed = JSON.parse(row.images_json);
            variantImages = Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            console.error(`Ошибка парсинга images_json для варианта ${row.id}:`, e);
            variantImages = [];
          }
        }

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
    console.error(`❌ Ошибка при получении товара по slug ${req.params.slug} из БД:`, err);
    res.status(500).json({ error: 'Не удалось загрузить товар', details: err.message });
  }
});

// === API: Получить товары по массиву ID (все поля) ===
app.post('/api/products/bulk', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Неверный формат данных. Ожидается массив ID.' });
  }

  const validIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
  if (validIds.length === 0) {
    return res.status(400).json({ error: 'Не переданы валидные ID товаров.' });
  }

  try {
    const placeholders = validIds.map((_, i) => `$${i + 1}`).join(',');
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
      WHERE id = ANY($1)
    `;

    const result = await pool.query(query, [validIds]);
    const products = result.rows.map(row => {
      let images = [];
      if (row.images_json) {
        try {
          const parsed = JSON.parse(row.images_json);
          images = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          console.error(`Ошибка парсинга images_json для товара ${row.id}:`, e);
          images = [];
        }
      }

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
