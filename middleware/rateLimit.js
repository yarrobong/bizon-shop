// Простой rate limiter в памяти
// Для продакшена лучше использовать redis-rate-limit

const rateLimitMap = new Map();

/**
 * Middleware для ограничения количества запросов
 */
function rateLimit(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 минут
    max = 100, // максимум 100 запросов
    message = 'Слишком много запросов, попробуйте позже'
  } = options;

  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!rateLimitMap.has(key)) {
      rateLimitMap.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    const record = rateLimitMap.get(key);

    // Если окно истекло, сбрасываем счетчик
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return next();
    }

    // Увеличиваем счетчик
    record.count++;

    // Проверяем лимит
    if (record.count > max) {
      const remainingTime = Math.ceil((record.resetTime - now) / 1000 / 60); // минуты
      return res.status(429).json({
        success: false,
        error: message,
        retryAfter: remainingTime
      });
    }

    next();
  };
}

// Очистка старых записей каждые 5 минут
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Сброс rate limit для конкретного IP
 * Используется после успешной авторизации
 */
function resetRateLimit(ip) {
  if (ip && rateLimitMap.has(ip)) {
    rateLimitMap.delete(ip);
  }
}

module.exports = rateLimit;
module.exports.resetRateLimit = resetRateLimit;

