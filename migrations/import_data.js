require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Подключение к серверной БД
const serverPool = new Pool({
  connectionString: process.env.DATABASE_URL && process.env.DATABASE_URL !== 'undefined'
    ? process.env.DATABASE_URL
    : `postgres://${process.env.DB_USER}:${encodeURIComponent(process.env.DB_PASSWORD)}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: process.env.DB_HOST === 'localhost' || process.env.DB_HOST === '127.0.0.1' ? false : {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

const exportDir = path.join(__dirname, 'exported_data');
const allDataPath = path.join(exportDir, 'all_data.json');

// Функция для получения колонок таблицы
async function getTableColumns(tableName) {
  const result = await serverPool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);
  return result.rows;
}

// Функция для импорта данных в таблицу
async function importTableData(tableName, data) {
  if (!data || data.length === 0) {
    console.log(`   ⚠️  Нет данных для импорта в ${tableName}`);
    return;
  }
  
  try {
    console.log(`📥 Импорт таблицы: ${tableName} (${data.length} записей)...`);
    
    // Получаем колонки таблицы
    const columns = await getTableColumns(tableName);
    const columnNames = columns.map(c => c.column_name);
    
    const client = await serverPool.connect();
    
    try {
      await client.query('BEGIN');
      
      let imported = 0;
      let updated = 0;
      let skipped = 0;
      
      for (const row of data) {
        try {
          // Формируем запрос INSERT/UPDATE
          const values = [];
          const placeholders = [];
          const insertCols = [];
          
          // Обрабатываем все колонки, которые есть в данных
          for (const col of columnNames) {
            if (row.hasOwnProperty(col)) {
              insertCols.push(col);
              let value = row[col];
              
              // Обрабатываем специальные случаи
              if (value === null || value === undefined) {
                values.push(null);
              } else if (value instanceof Date) {
                values.push(value);
              } else if (typeof value === 'object' && value !== null) {
                // JSON объекты
                values.push(JSON.stringify(value));
              } else {
                values.push(value);
              }
              
              placeholders.push(`$${values.length}`);
            }
          }
          
          if (insertCols.length === 0) {
            skipped++;
            continue;
          }
          
          // Проверяем существование записи (по id)
          if (row.id !== undefined) {
            const exists = await client.query(
              `SELECT 1 FROM ${tableName} WHERE id = $1`,
              [row.id]
            );
            
            if (exists.rows.length > 0) {
              // Обновляем существующую запись
              const updateCols = insertCols.filter(c => c !== 'id');
              if (updateCols.length > 0) {
                const updateValues = [];
                const updateSet = [];
                
                updateCols.forEach((col, idx) => {
                  const valIdx = insertCols.indexOf(col);
                  updateValues.push(values[valIdx]);
                  updateSet.push(`${col} = $${idx + 1}`);
                });
                
                updateValues.push(row.id);
                
                const updateQuery = `
                  UPDATE ${tableName} 
                  SET ${updateSet.join(', ')}
                  WHERE id = $${updateCols.length + 1}
                `;
                
                await client.query(updateQuery, updateValues);
                updated++;
              } else {
                skipped++;
              }
            } else {
              // Вставляем новую запись
              const insertQuery = `
                INSERT INTO ${tableName} (${insertCols.join(', ')})
                VALUES (${placeholders.join(', ')})
              `;
              
              await client.query(insertQuery, values);
              imported++;
            }
          } else {
            // Если нет id, просто вставляем (для таблиц без id или с auto-increment)
            const insertQuery = `
              INSERT INTO ${tableName} (${insertCols.join(', ')})
              VALUES (${placeholders.join(', ')})
            `;
            
            await client.query(insertQuery, values);
            imported++;
          }
        } catch (err) {
          console.error(`   ⚠️  Ошибка при импорте записи (id: ${row.id || 'N/A'}):`, err.message);
          skipped++;
        }
      }
      
      await client.query('COMMIT');
      console.log(`   ✅ Импортировано: ${imported}, обновлено: ${updated}, пропущено: ${skipped}`);
      
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    
  } catch (err) {
    if (err.code === '42P01') {
      console.log(`   ⚠️  Таблица ${tableName} не существует на сервере, пропускаем...`);
      return;
    }
    throw err;
  }
}

async function importAllData() {
  try {
    console.log('🚀 Начало импорта данных на сервер...\n');
    
    // Проверяем наличие файла с данными
    if (!fs.existsSync(allDataPath)) {
      throw new Error(`Файл с данными не найден: ${allDataPath}\nСначала запустите export_data.js`);
    }
    
    // Загружаем данные
    const allData = JSON.parse(fs.readFileSync(allDataPath, 'utf8'));
    
    // Порядок импорта (с учетом зависимостей)
    const importOrder = [
      'categories',
      'products',
      'product_variants_link',
      'attractions',
      'attraction_images',
      'attraction_videos',
      'orders',
      'order_items',
      'sessions'
    ];
    
    for (const table of importOrder) {
      if (allData[table]) {
        await importTableData(table, allData[table]);
      } else {
        console.log(`⚠️  Таблица ${table} отсутствует в экспортированных данных`);
      }
    }
    
    console.log('\n✅ Импорт завершен успешно!');
    
  } catch (err) {
    console.error('❌ Ошибка при импорте:', err);
    throw err;
  } finally {
    await serverPool.end();
  }
}

// Запуск импорта
importAllData().catch(err => {
  console.error('Критическая ошибка:', err);
  process.exit(1);
});
