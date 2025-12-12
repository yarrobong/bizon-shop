const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// Простая сессия в памяти (для продакшена лучше использовать Redis или JWT)
const sessions = new Map();

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
      method: req.method,
      totalSessions: sessions.size
    });
    
    if (!sessionId) {
      console.log('[requireAuth] Сессия отсутствует');
      return res.status(401).json({ 
        success: false, 
        error: 'Требуется аутентификация' 
      });
    }

    const session = sessions.get(sessionId);
    
    if (!session) {
      console.log('[requireAuth] Сессия не найдена в памяти. Всего сессий:', sessions.size);
      console.log('[requireAuth] Существующие сессии:', Array.from(sessions.keys()).map(s => s.substring(0, 8) + '...'));
      return res.status(401).json({ 
        success: false, 
        error: 'Сессия недействительна' 
      });
    }

    // Проверяем срок действия сессии
    const sessionAge = Date.now() - session.createdAt;
    if (sessionAge > SESSION_DURATION) {
      console.log('[requireAuth] Сессия истекла. Возраст:', Math.floor(sessionAge / 1000 / 60), 'минут');
      sessions.delete(sessionId);
      return res.status(401).json({ 
        success: false, 
        error: 'Сессия истекла' 
      });
    }

    // Обновляем время последней активности
    session.lastActivity = Date.now();
    req.user = session.user;
    console.log('[requireAuth] Сессия валидна, пользователь:', session.user.username);
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

    // Создаем сессию
    const sessionId = generateSessionId();
    sessions.set(sessionId, {
      user: {
        id: user.id,
        username: user.username
      },
      createdAt: Date.now(),
      lastActivity: Date.now()
    });

    return { sessionId, user: { id: user.id, username: user.username } };
  } catch (error) {
    throw error;
  }
}

/**
 * Выход из системы
 */
function logout(sessionId) {
  sessions.delete(sessionId);
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
function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_DURATION) {
      sessions.delete(sessionId);
    }
  }
}

// Очистка каждые 30 минут
setInterval(cleanupExpiredSessions, 30 * 60 * 1000);

module.exports = {
  requireAuth,
  authenticate,
  logout,
  cleanupExpiredSessions
};

