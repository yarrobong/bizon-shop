// create-admin-user.js
require('dotenv').config();
const bcrypt = require('bcryptjs');

// Если вы используете тот же pool, что и в server.js
let pool;
if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
}

async function createAdminUser(username, password) {
  try {
    if (!pool) {
      console.error('Подключение к БД не настроено');
      return;
    }

    // Хэшируем пароль
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Вставляем пользователя в БД
    const result = await pool.query(
      'INSERT INTO admin_users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username, hashedPassword]
    );
    
    console.log('Пользователь успешно создан:', result.rows[0]);
  } catch (err) {
    console.error('Ошибка создания пользователя:', err);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Замените 'admin' и 'password123' на желаемые логин и пароль
createAdminUser('admin777', 'Ispector228!');