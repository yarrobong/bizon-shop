const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// Время жизни сессии (24 часа)
const SESSION_DURATION = 24 * 60 * 60 * 1000;

/**
 * Middleware для проверки аутентификации администратора
 */
async function requireAuth(req, res, next) {
  try {
    const sessionId = req.headers['x-session-id'];
    
    console.log('[requireAuth] Проверка сессии:', {
      sessionId: sessionId ? `${sessionId.substring(0, 8)}...` : 'отсутствует',
      url: req.url,
      method: req.method
    });
    
    if (!sessionId) {
      console.log('[requireAuth] Сессия отсутствует');
      return res.status(401).json({ 
        success: false, 
        error: 'Требуется аутентификация' 
      });
    }

    // Проверяем сессию в БД
    const sessionResult = await pool.query(
      `SELECT session_id, user_id, username, created_at, last_activity, expires_at 
       FROM sessions 
       WHERE session_id = $1 AND expires_at > NOW()`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      console.log('[requireAuth] Сессия не найдена в БД или истекла');
      return res.status(401).json({ 
        success: false, 
        error: 'Сессия недействительна или истекла' 
      });
    }

    const session = sessionResult.rows[0];

    // Обновляем время последней активности
    await pool.query(
      'UPDATE sessions SET last_activity = NOW() WHERE session_id = $1',
      [sessionId]
    );

    req.user = {
      id: session.user_id,
      username: session.username
    };

    console.log('[requireAuth] Сессия валидна, пользователь:', session.username);
    next();
  } catch (error) {
    console.error('Ошибка проверки аутентификации:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка сервера при проверке аутентификации' 
    });
  }
}

/**
 * Аутентификация пользователя
 */
async function authenticate(username, password) {
  try {
    if (!username || !password) {
      throw new Error('Логин и пароль обязательны');
    }

    // Используем параметризованный запрос для защиты от SQL-инъекций
    const result = await pool.query(
      'SELECT id, username, password_hash FROM admin_users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      throw new Error('Неверный логин или пароль');
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      throw new Error('Неверный логин или пароль');
    }

    // Создаем сессию в БД
    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + SESSION_DURATION);

    await pool.query(
      `INSERT INTO sessions (session_id, user_id, username, created_at, last_activity, expires_at)
       VALUES ($1, $2, $3, NOW(), NOW(), $4)`,
      [sessionId, user.id, user.username, expiresAt]
    );

    console.log('[authenticate] Создана новая сессия в БД:', {
      sessionId: sessionId.substring(0, 8) + '...',
      username: user.username,
      expiresAt: expiresAt
    });

    return { sessionId, user: { id: user.id, username: user.username } };
  } catch (error) {
    console.error('[authenticate] Ошибка создания сессии:', error);
    throw error;
  }
}

/**
 * Выход из системы
 */
async function logout(sessionId) {
  try {
    if (!sessionId) {
      return;
    }

    const result = await pool.query(
      'DELETE FROM sessions WHERE session_id = $1',
      [sessionId]
    );

    console.log('[logout] Сессия удалена из БД:', {
      sessionId: sessionId.substring(0, 8) + '...',
      deleted: result.rowCount > 0
    });
  } catch (error) {
    console.error('[logout] Ошибка удаления сессии:', error);
    // Не пробрасываем ошибку, чтобы не ломать процесс выхода
  }
}

/**
 * Генерация уникального ID сессии
 */
function generateSessionId() {
  return require('crypto').randomBytes(32).toString('hex');
}

/**
 * Очистка истекших сессий (запускать периодически)
 */
async function cleanupExpiredSessions() {
  try {
    const result = await pool.query(
      'DELETE FROM sessions WHERE expires_at < NOW()'
    );

    if (result.rowCount > 0) {
      console.log(`[cleanupExpiredSessions] Удалено истекших сессий: ${result.rowCount}`);
    }
  } catch (error) {
    console.error('[cleanupExpiredSessions] Ошибка очистки сессий:', error);
  }
}

// Очистка каждые 30 минут
setInterval(cleanupExpiredSessions, 30 * 60 * 1000);

// Очистка при старте сервера
cleanupExpiredSessions();

module.exports = {
  requireAuth,
  authenticate,
  logout,
  cleanupExpiredSessions
};

