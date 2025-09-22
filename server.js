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

// === API: Получить варианты товара ===
app.get('/api/products/:id/variants', async (req, res) => {
  try {
    const { id } = req.params;

    // Находим группу, к которой принадлежит товар
    const groupResult = await pool.query(
      'SELECT group_id FROM product_variants_link WHERE product_id = $1',
      [id]
    );

    if (groupResult.rows.length === 0) {
      return res.json([]); // Нет группы - нет вариантов
    }

    const groupId = groupResult.rows[0].group_id;

    // Получаем все товары из этой группы
    const variantsResult = await pool.query(
      `SELECT p.*
       FROM product_variants_link pvl
       JOIN products p ON pvl.product_id = p.id
       WHERE pvl.group_id = $1 AND p.id != $2
       ORDER BY p.id`,
      [groupId, id] // Исключаем сам товар
    );

    // Форматируем изображения для каждого варианта
    const formattedVariants = variantsResult.rows.map((variant) => {
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

    res.json(formattedVariants);
  } catch (err) {
    console.error('Ошибка загрузки вариантов товара:', err);
    res.status(500).json({ error: 'Не удалось загрузить варианты товара' });
  }
});

// === API: Установить варианты товара ===
app.put('/api/products/:id/variants', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { variantIds } = req.body; // Ожидаем массив ID

    // Проверяем, существует ли основной товар
    const productExists = await client.query('SELECT 1 FROM products WHERE id = $1', [id]);
    if (productExists.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Основной товар не найден' });
    }

    console.log(`Установка вариантов для товара ID ${id}. Варианты:`, variantIds);

    // Удаляем все существующие связи для этого товара
    await client.query('DELETE FROM product_variants_link WHERE product_id = $1', [id]);
    console.log(`Удалены старые связи вариантов для товара ID ${id}.`);

    if (Array.isArray(variantIds) && variantIds.length > 0) {
      const groupId = id; // Используем ID основного товара как group_id

      // Добавляем связь "основной товар -> группа"
      await client.query(
        'INSERT INTO product_variants_link (product_id, group_id) VALUES ($1, $2) ON CONFLICT (product_id) DO UPDATE SET group_id = $2',
        [id, groupId]
      );

      // Добавляем связи "вариант -> группа"
      for (const variantId of variantIds) {
        if (variantId != id) { // Исключаем основной товар
          const variantExists = await client.query('SELECT 1 FROM products WHERE id = $1', [variantId]);
          if (variantExists.rows.length > 0) {
            await client.query(
              'INSERT INTO product_variants_link (product_id, group_id) VALUES ($1, $2) ON CONFLICT (product_id) DO UPDATE SET group_id = $2',
              [variantId, groupId]
            );
          } else {
              console.warn(`Вариант с ID ${variantId} не найден.`);
          }
        }
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Варианты товара обновлены' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Ошибка установки вариантов товара:', err);
    res.status(500).json({ error: 'Не удалось обновить варианты товара' });
  } finally {
    client.release();
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
    let productImages = [];
  // --- Исправленная обработка images_json для товара по ID ---
  if (product.images_json != null) {
      if (typeof product.images_json === 'string') {
          try {
              productImages = product.images_json;
          } catch (parseErr) {
              console.error(`Ошибка парсинга images_json для товара ID ${product.id}:`, parseErr);
          }
      } else if (Array.isArray(product.images_json) || (typeof product.images_json === 'object' && product.images_json !== null)) {
          productImages = product.images_json;
      }
    }
    // --- Конец исправленной обработки ---

    res.json({
       ...product,
       images: productImages
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

    const result = await pool.query(`
      INSERT INTO products (title, description, price, tag, available, category, brand, compatibility, supplier_link, supplier_notes, images_json)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, title, description, price, tag, available, category, brand, compatibility, supplier_link, supplier_notes, images_json as images
    `, [title, description, price, tag, available, category, brand, compatibility, supplier_link, supplier_notes, images_json]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка создания товара:', err);
    res.status(500).json({ error: 'Не удалось создать товар' });
  }
});

// === API: Обновить товар (с поддержкой вариантов) ===
app.put('/api/products/:id', async (req, res) => {
  const client = await pool.connect(); // Используем клиент из пула для транзакции
  try {
    await client.query('BEGIN'); // Начинаем транзакцию

    const { id } = req.params;
    // Добавлены новые поля supplier_link, supplier_notes
    // Добавлено поле variantIds для вариантов
    const { title, description, price, tag, available, category, brand, compatibility, supplier_link, supplier_notes, images, variantIds } = req.body;
    const images_json = images ? JSON.stringify(images) : null;

    // 1. Обновляем основные данные товара
    const result = await client.query(`
      UPDATE products
      SET title = $1, description = $2, price = $3, tag = $4, available = $5, category = $6, brand = $7, compatibility = $8, supplier_link = $9, supplier_notes = $10, images_json = $11
      WHERE id = $12
      RETURNING id
    `, [title, description, price, tag, available, category, brand, compatibility, supplier_link, supplier_notes, images_json, id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Товар не найден' });
    }

    const updatedProductId = result.rows[0].id;

    // 2. Обработка вариантов (если передан массив variantIds)
    if (Array.isArray(variantIds)) {
      console.log(`Обновление вариантов для товара ID ${updatedProductId}. Новые варианты:`, variantIds);

      // Удаляем все существующие связи для этого товара
      await client.query('DELETE FROM product_variants_link WHERE product_id = $1', [updatedProductId]);
      console.log(`Удалены старые связи вариантов для товара ID ${updatedProductId}.`);

      // Создаем новую группу вариантов
      // Все товары (основной + варианты) будут принадлежать одной группе.
      // Группа идентифицируется по group_id.

      if (variantIds.length > 0) {
        // Генерируем новый group_id (например, используя текущее время или UUID)
        // Для простоты используем ID основного товара как базу, но это не обязательно.
        // Лучше генерировать уникальный ID для группы.
        // const newGroupId = `group_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        // Или используем ID основного товара, если он уникально идентифицирует группу.
        // Проблема: если товар был в одной группе, а потом в другой, старая группа остается.
        // Решение: всегда создавать новую группу или использовать ID основного товара.
        // Выберем ID основного товара как group_id для простоты и уникальности в рамках этого товара.
        const groupId = updatedProductId;

        // Добавляем связь "основной товар -> группа"
        await client.query(
          'INSERT INTO product_variants_link (product_id, group_id) VALUES ($1, $2) ON CONFLICT (product_id) DO UPDATE SET group_id = $2',
          [updatedProductId, groupId]
        );
        console.log(`Связь основного товара ID ${updatedProductId} с группой ID ${groupId} создана/обновлена.`);

        // Добавляем связи "вариант -> группа" для каждого варианта
        for (const variantId of variantIds) {
          if (variantId != updatedProductId) { // Исключаем основной товар из списка вариантов
            // Проверяем, существует ли вариант
            const variantExists = await client.query('SELECT 1 FROM products WHERE id = $1', [variantId]);
            if (variantExists.rows.length > 0) {
              await client.query(
                'INSERT INTO product_variants_link (product_id, group_id) VALUES ($1, $2) ON CONFLICT (product_id) DO UPDATE SET group_id = $2',
                [variantId, groupId]
              );
              console.log(`Связь варианта ID ${variantId} с группой ID ${groupId} создана/обновлена.`);
            } else {
              console.warn(`Вариант с ID ${variantId} не найден и не был добавлен.`);
            }
          }
        }
      }
      // Если variantIds пустой массив, мы удалили старые связи выше, и новых не добавили - это очистка.
    } else {
      console.log(`Массив variantIds не передан или не является массивом для товара ID ${updatedProductId}. Связи вариантов не изменялись.`);
      // Можно также удалить все связи, если явно передан null или пустой массив
      // и нужно сбросить варианты. Пока оставляем как есть.
    }

    await client.query('COMMIT'); // Фиксируем транзакцию

    // Возвращаем обновленный товар (по аналогии со старым кодом, но можно и просто OK)
    const finalResult = await pool.query(`
      SELECT
        id, title, description, price, tag, available, category, brand, compatibility, supplier_link, supplier_notes,
        images_json -- Поле будет обработано клиентом
      FROM products
      WHERE id = $1
    `, [updatedProductId]);

    res.json(finalResult.rows[0]); // Возвращаем обновленный товар

  } catch (err) {
    await client.query('ROLLBACK'); // Откатываем транзакцию в случае ошибки
    console.error('Ошибка обновления товара (включая варианты):', err);
    res.status(500).json({ error: 'Не удалось обновить товар и его варианты' });
  } finally {
    client.release(); // Возвращаем клиент в пул
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
