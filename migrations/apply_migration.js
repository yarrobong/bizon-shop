/**
 * Скрипт для применения миграции создания таблицы sessions
 * 
 * Использование:
 * node migrations/apply_migration.js
 */

// Загружаем переменные окружения
require('dotenv').config();

const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('📋 Применение миграции: создание таблицы sessions...');
    
    // Читаем SQL файл
    const sqlPath = path.join(__dirname, 'create_sessions_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Выполняем SQL
    await client.query(sql);
    
    await client.query('COMMIT');
    
    console.log('✅ Миграция успешно применена!');
    
    // Проверяем, что таблица создана
    const checkResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sessions'
      );
    `);
    
    if (checkResult.rows[0].exists) {
      console.log('✅ Таблица sessions успешно создана');
      
      // Проверяем индексы
      const indexesResult = await client.query(`
        SELECT indexname FROM pg_indexes 
        WHERE tablename = 'sessions';
      `);
      
      console.log(`✅ Создано индексов: ${indexesResult.rows.length}`);
      indexesResult.rows.forEach(row => {
        console.log(`   - ${row.indexname}`);
      });
    } else {
      console.error('❌ Таблица sessions не найдена после миграции!');
      process.exit(1);
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка при применении миграции:', error);
    
    // Если таблица уже существует, это не критично
    if (error.message && error.message.includes('already exists')) {
      console.log('ℹ️  Таблица sessions уже существует, миграция не требуется');
    } else {
      process.exit(1);
    }
  } finally {
    client.release();
  }
}

// Запускаем миграцию
applyMigration()
  .then(() => {
    console.log('✅ Готово!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  });
