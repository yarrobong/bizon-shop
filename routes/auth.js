const express = require('express');
const router = express.Router();
const { authenticate, logout } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const { resetRateLimit } = require('../middleware/rateLimit');

// Rate limiting для логина (более строгий)
const loginRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 минут
  max: 15, // максимум 15 попыток
  message: 'Слишком много попыток входа, попробуйте позже'
});

/**
 * POST /api/login
 * Аутентификация администратора
 */
router.post('/login', loginRateLimit, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Логин и пароль обязательны' 
      });
    }

    const { sessionId, user } = await authenticate(username, password);

    console.log('[auth] Создана новая сессия:', {
      sessionId: sessionId.substring(0, 8) + '...',
      username: user.username
    });

    // Сбрасываем rate limit при успешной авторизации
    const clientIp = req.ip || req.connection.remoteAddress;
    resetRateLimit(clientIp);

    res.json({ 
      success: true, 
      message: 'Авторизация успешна',
      sessionId,
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Ошибка авторизации:', error);
    res.status(401).json({ 
      success: false, 
      message: error.message || 'Неверный логин или пароль' 
    });
  }
});

/**
 * POST /api/logout
 * Выход из системы
 */
router.post('/logout', (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;
    if (sessionId) {
      logout(sessionId);
    }
    res.json({ success: true, message: 'Выход выполнен' });
  } catch (error) {
    console.error('Ошибка выхода:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

module.exports = router;

