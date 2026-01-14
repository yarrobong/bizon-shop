/**
 * CSRF Protection Middleware
 * Защита от Cross-Site Request Forgery атак
 */

const csrf = require('csrf');
const tokens = new csrf();

// Секретный ключ для генерации токенов (из переменной окружения или случайный)
const SECRET = process.env.CSRF_SECRET || 'bizon-csrf-secret-key-change-in-production';

/**
 * Генерация CSRF токена
 */
function generateToken() {
  return tokens.create(SECRET);
}

/**
 * Проверка CSRF токена
 */
function verifyToken(token) {
  return tokens.verify(SECRET, token);
}

/**
 * Middleware для проверки CSRF токена в запросах
 * Применяется только к POST, PUT, DELETE, PATCH запросам
 */
function csrfProtection(req, res, next) {
  // Пропускаем GET, HEAD, OPTIONS запросы
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Получаем токен из заголовка или тела запроса
  const token = req.headers['x-csrf-token'] || req.body._csrf || req.query._csrf;

  if (!token) {
    return res.status(403).json({ 
      error: 'CSRF токен отсутствует',
      message: 'Требуется CSRF токен для выполнения этого запроса'
    });
  }

  // Проверяем токен
  if (!verifyToken(token)) {
    return res.status(403).json({ 
      error: 'Неверный CSRF токен',
      message: 'CSRF токен недействителен или истек'
    });
  }

  // Токен валиден, продолжаем
  next();
}

/**
 * Middleware для добавления CSRF токена в ответ (для форм)
 * Добавляет токен в res.locals для использования в шаблонах
 */
function csrfToken(req, res, next) {
  const token = generateToken();
  res.locals.csrfToken = token;
  // Также устанавливаем в cookie для удобства получения через JavaScript
  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false, // Доступен для JavaScript
    secure: process.env.NODE_ENV === 'production', // Только HTTPS в продакшене
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 часа
  });
  next();
}

module.exports = {
  generateToken,
  verifyToken,
  csrfProtection,
  csrfToken
};
