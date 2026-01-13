/**
 * Скрипт для тестирования работы сессий в БД
 * 
 * Использование:
 * node migrations/test_sessions.js
 * 
 * Требования:
 * - Таблица sessions должна быть создана
 * - Должен существовать тестовый пользователь в admin_users
 */

const pool = require('../config/db');
const { authenticate, logout, requireAuth, cleanupExpiredSessions } = require('../middleware/auth');

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testDatabaseStructure() {
  log('\n📋 Тест 1: Проверка структуры БД', 'blue');
  
  try {
    // Проверка существования таблицы
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sessions'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      log('❌ Таблица sessions не найдена!', 'red');
      return false;
    }
    log('✅ Таблица sessions существует', 'green');
    
    // Проверка структуры таблицы
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sessions'
      ORDER BY ordinal_position;
    `);
    
    const requiredColumns = ['session_id', 'user_id', 'username', 'created_at', 'last_activity', 'expires_at'];
    const existingColumns = columns.rows.map(r => r.column_name);
    
    for (const col of requiredColumns) {
      if (!existingColumns.includes(col)) {
        log(`❌ Отсутствует колонка: ${col}`, 'red');
        return false;
      }
    }
    log('✅ Все необходимые колонки присутствуют', 'green');
    
    // Проверка индексов
    const indexes = await pool.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'sessions';
    `);
    
    log(`✅ Найдено индексов: ${indexes.rows.length}`, 'green');
    indexes.rows.forEach(idx => {
      log(`   - ${idx.indexname}`, 'yellow');
    });
    
    return true;
  } catch (error) {
    log(`❌ Ошибка проверки структуры: ${error.message}`, 'red');
    return false;
  }
}

async function testSessionCreation() {
  log('\n📋 Тест 2: Создание сессии', 'blue');
  
  try {
    // Получаем первого пользователя из БД для теста
    const userResult = await pool.query('SELECT id, username FROM admin_users LIMIT 1');
    
    if (userResult.rows.length === 0) {
      log('⚠️  Нет пользователей в БД для теста. Пропускаем тест создания сессии.', 'yellow');
      return null;
    }
    
    const testUser = userResult.rows[0];
    log(`ℹ️  Тестируем с пользователем: ${testUser.username}`, 'yellow');
    
    // Проверяем количество сессий до создания
    const beforeCount = await pool.query('SELECT COUNT(*) as count FROM sessions');
    const countBefore = parseInt(beforeCount.rows[0].count);
    log(`ℹ️  Сессий в БД до создания: ${countBefore}`, 'yellow');
    
    // Создаем тестовую сессию напрямую в БД (без пароля)
    const sessionId = require('crypto').randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await pool.query(
      `INSERT INTO sessions (session_id, user_id, username, created_at, last_activity, expires_at)
       VALUES ($1, $2, $3, NOW(), NOW(), $4)`,
      [sessionId, testUser.id, testUser.username, expiresAt]
    );
    
    log(`✅ Сессия создана: ${sessionId.substring(0, 16)}...`, 'green');
    
    // Проверяем количество сессий после создания
    const afterCount = await pool.query('SELECT COUNT(*) as count FROM sessions');
    const countAfter = parseInt(afterCount.rows[0].count);
    
    if (countAfter === countBefore + 1) {
      log('✅ Количество сессий увеличилось на 1', 'green');
    } else {
      log(`❌ Ожидалось ${countBefore + 1} сессий, найдено ${countAfter}`, 'red');
    }
    
    return sessionId;
  } catch (error) {
    log(`❌ Ошибка создания сессии: ${error.message}`, 'red');
    return null;
  }
}

async function testSessionValidation(sessionId) {
  log('\n📋 Тест 3: Валидация сессии', 'blue');
  
  if (!sessionId) {
    log('⚠️  Нет сессии для теста. Пропускаем.', 'yellow');
    return false;
  }
  
  try {
    // Проверяем сессию в БД
    const sessionResult = await pool.query(
      `SELECT session_id, user_id, username, created_at, last_activity, expires_at 
       FROM sessions 
       WHERE session_id = $1 AND expires_at > NOW()`,
      [sessionId]
    );
    
    if (sessionResult.rows.length === 0) {
      log('❌ Сессия не найдена или истекла', 'red');
      return false;
    }
    
    const session = sessionResult.rows[0];
    log('✅ Сессия найдена в БД', 'green');
    log(`   - Пользователь: ${session.username}`, 'yellow');
    log(`   - Создана: ${session.created_at}`, 'yellow');
    log(`   - Истекает: ${session.expires_at}`, 'yellow');
    
    // Проверяем обновление last_activity
    const oldActivity = session.last_activity;
    
    await pool.query(
      'UPDATE sessions SET last_activity = NOW() WHERE session_id = $1',
      [sessionId]
    );
    
    const updatedResult = await pool.query(
      'SELECT last_activity FROM sessions WHERE session_id = $1',
      [sessionId]
    );
    
    const newActivity = updatedResult.rows[0].last_activity;
    
    if (new Date(newActivity) > new Date(oldActivity)) {
      log('✅ last_activity успешно обновлен', 'green');
    } else {
      log('❌ last_activity не обновился', 'red');
    }
    
    return true;
  } catch (error) {
    log(`❌ Ошибка валидации сессии: ${error.message}`, 'red');
    return false;
  }
}

async function testSessionDeletion(sessionId) {
  log('\n📋 Тест 4: Удаление сессии', 'blue');
  
  if (!sessionId) {
    log('⚠️  Нет сессии для теста. Пропускаем.', 'yellow');
    return false;
  }
  
  try {
    // Проверяем количество сессий до удаления
    const beforeCount = await pool.query('SELECT COUNT(*) as count FROM sessions');
    const countBefore = parseInt(beforeCount.rows[0].count);
    
    // Удаляем сессию
    await logout(sessionId);
    
    // Проверяем количество сессий после удаления
    const afterCount = await pool.query('SELECT COUNT(*) as count FROM sessions');
    const countAfter = parseInt(afterCount.rows[0].count);
    
    if (countAfter === countBefore - 1) {
      log('✅ Сессия успешно удалена', 'green');
      return true;
    } else {
      log(`❌ Ожидалось ${countBefore - 1} сессий, найдено ${countAfter}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка удаления сессии: ${error.message}`, 'red');
    return false;
  }
}

async function testCleanupExpiredSessions() {
  log('\n📋 Тест 5: Очистка истекших сессий', 'blue');
  
  try {
    // Создаем истекшую сессию
    const userResult = await pool.query('SELECT id, username FROM admin_users LIMIT 1');
    
    if (userResult.rows.length === 0) {
      log('⚠️  Нет пользователей в БД. Пропускаем.', 'yellow');
      return false;
    }
    
    const testUser = userResult.rows[0];
    const expiredSessionId = require('crypto').randomBytes(32).toString('hex');
    const expiredAt = new Date(Date.now() - 1000); // Истекла секунду назад
    
    await pool.query(
      `INSERT INTO sessions (session_id, user_id, username, created_at, last_activity, expires_at)
       VALUES ($1, $2, $3, NOW(), NOW(), $4)`,
      [expiredSessionId, testUser.id, testUser.username, expiredAt]
    );
    
    log(`ℹ️  Создана истекшая сессия: ${expiredSessionId.substring(0, 16)}...`, 'yellow');
    
    // Запускаем очистку
    await cleanupExpiredSessions();
    
    // Проверяем, что сессия удалена
    const checkResult = await pool.query(
      'SELECT session_id FROM sessions WHERE session_id = $1',
      [expiredSessionId]
    );
    
    if (checkResult.rows.length === 0) {
      log('✅ Истекшая сессия успешно удалена', 'green');
      return true;
    } else {
      log('❌ Истекшая сессия не была удалена', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка теста очистки: ${error.message}`, 'red');
    return false;
  }
}

async function testForeignKeys() {
  log('\n📋 Тест 6: Проверка Foreign Keys', 'blue');
  
  try {
    // Проверяем, что foreign key работает
    const fkResult = await pool.query(`
      SELECT 
        tc.constraint_name, 
        tc.table_name, 
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = 'sessions';
    `);
    
    if (fkResult.rows.length > 0) {
      log('✅ Foreign key настроен', 'green');
      fkResult.rows.forEach(fk => {
        log(`   - ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`, 'yellow');
      });
    } else {
      log('⚠️  Foreign key не найден', 'yellow');
    }
    
    return true;
  } catch (error) {
    log(`❌ Ошибка проверки Foreign Keys: ${error.message}`, 'red');
    return false;
  }
}

async function runAllTests() {
  log('🧪 Запуск тестов системы сессий\n', 'blue');
  log('='.repeat(50), 'blue');
  
  const results = {
    structure: false,
    creation: false,
    validation: false,
    deletion: false,
    cleanup: false,
    foreignKeys: false
  };
  
  // Тест 1: Структура БД
  results.structure = await testDatabaseStructure();
  
  if (!results.structure) {
    log('\n❌ Критическая ошибка: структура БД неверна. Остановка тестов.', 'red');
    process.exit(1);
  }
  
  // Тест 6: Foreign Keys
  results.foreignKeys = await testForeignKeys();
  
  // Тест 2: Создание сессии
  const sessionId = await testSessionCreation();
  results.creation = sessionId !== null;
  
  // Тест 3: Валидация сессии
  results.validation = await testSessionValidation(sessionId);
  
  // Тест 4: Удаление сессии
  results.deletion = await testSessionDeletion(sessionId);
  
  // Тест 5: Очистка истекших сессий
  results.cleanup = await testCleanupExpiredSessions();
  
  // Итоги
  log('\n' + '='.repeat(50), 'blue');
  log('📊 Итоги тестирования:', 'blue');
  log('='.repeat(50), 'blue');
  
  const tests = [
    { name: 'Структура БД', result: results.structure },
    { name: 'Создание сессии', result: results.creation },
    { name: 'Валидация сессии', result: results.validation },
    { name: 'Удаление сессии', result: results.deletion },
    { name: 'Очистка истекших', result: results.cleanup },
    { name: 'Foreign Keys', result: results.foreignKeys }
  ];
  
  let passed = 0;
  tests.forEach(test => {
    const status = test.result ? '✅' : '❌';
    const color = test.result ? 'green' : 'red';
    log(`${status} ${test.name}`, color);
    if (test.result) passed++;
  });
  
  log('\n' + '='.repeat(50), 'blue');
  log(`✅ Пройдено: ${passed}/${tests.length}`, passed === tests.length ? 'green' : 'yellow');
  
  if (passed === tests.length) {
    log('🎉 Все тесты пройдены успешно!', 'green');
    process.exit(0);
  } else {
    log('⚠️  Некоторые тесты не пройдены. Проверьте ошибки выше.', 'yellow');
    process.exit(1);
  }
}

// Запускаем тесты
runAllTests().catch(error => {
  log(`\n❌ Критическая ошибка: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
