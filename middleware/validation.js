/**
 * Валидация входных данных для защиты от инъекций и некорректных данных
 */

/**
 * Валидация ID (должно быть положительным целым числом)
 */
function validateId(id) {
  const numId = parseInt(id, 10);
  return !isNaN(numId) && numId > 0 ? numId : null;
}

/**
 * Валидация slug (только безопасные символы)
 */
function validateSlug(slug) {
  if (!slug || typeof slug !== 'string') return null;
  // Разрешаем только буквы, цифры, дефисы и подчеркивания
  return /^[a-zA-Z0-9_-]+$/.test(slug) ? slug : null;
}

/**
 * Валидация строки (защита от XSS и инъекций)
 */
function sanitizeString(str, maxLength = 1000) {
  if (!str || typeof str !== 'string') return '';
  // Удаляем потенциально опасные символы
  return str
    .trim()
    .substring(0, maxLength)
    .replace(/[<>]/g, ''); // Удаляем < и > для защиты от XSS
}

/**
 * Валидация телефона
 */
function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  // Оставляем только цифры и +
  const cleaned = phone.replace(/[^0-9+]/g, '');
  return cleaned.length >= 10 ? cleaned : null;
}

/**
 * Валидация email
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) ? email : null;
}

/**
 * Валидация массива ID
 */
function validateIdArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map(id => validateId(id))
    .filter(id => id !== null);
}

/**
 * Middleware для валидации параметров запроса
 */
function validateParams(validators) {
  return (req, res, next) => {
    const errors = [];

    // Валидация params
    if (validators.params) {
      for (const [key, validator] of Object.entries(validators.params)) {
        const value = req.params[key];
        const validated = validator(value);
        if (validated === null && value !== undefined) {
          errors.push(`Некорректный параметр: ${key}`);
        } else if (validated !== null) {
          req.params[key] = validated;
        }
      }
    }

    // Валидация query
    if (validators.query) {
      for (const [key, validator] of Object.entries(validators.query)) {
        const value = req.query[key];
        if (value !== undefined) {
          const validated = validator(value);
          if (validated === null) {
            errors.push(`Некорректный query параметр: ${key}`);
          } else {
            req.query[key] = validated;
          }
        }
      }
    }

    // Валидация body
    if (validators.body) {
      for (const [key, validator] of Object.entries(validators.body)) {
        const value = req.body[key];
        if (value !== undefined) {
          const validated = validator(value);
          if (validated === null) {
            errors.push(`Некорректное поле: ${key}`);
          } else {
            req.body[key] = validated;
          }
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors: errors
      });
    }

    next();
  };
}

module.exports = {
  validateId,
  validateSlug,
  sanitizeString,
  validatePhone,
  validateEmail,
  validateIdArray,
  validateParams
};

