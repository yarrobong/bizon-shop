// utils.js
// Форматирование цены
function formatPrice(price) {
  if (price === null || price === 0) return 'Цена по запросу';
  return new Intl.NumberFormat('ru-RU').format(price) + ' ₽';
}

// CSRF токен (кэшируется)
let csrfTokenCache = null;

/**
 * Получить CSRF токен (с кэшированием)
 */
async function getCsrfToken() {
  // Если токен уже есть в кэше, возвращаем его
  if (csrfTokenCache) {
    return csrfTokenCache;
  }
  
  // Пытаемся получить токен из cookie (если установлен сервером)
  const cookieToken = getCookie('XSRF-TOKEN');
  if (cookieToken) {
    csrfTokenCache = cookieToken;
    return cookieToken;
  }
  
  // Если токена нет, запрашиваем с сервера
  try {
    const response = await fetch('/api/csrf-token');
    if (response.ok) {
      // Используем безопасный парсинг JSON
      const data = typeof window.safeJsonParse === 'function' 
          ? await window.safeJsonParse(response, { defaultValue: { csrfToken: null } })
          : await response.json().catch(() => ({ csrfToken: null }));
      csrfTokenCache = data.csrfToken;
      return data.csrfToken;
    }
  } catch (error) {
    console.error('Ошибка получения CSRF токена:', error);
  }
  
  return null;
}

/**
 * Получить значение cookie по имени
 */
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Экспорт функций
if (typeof window !== 'undefined') {
  window.getCsrfToken = getCsrfToken;
  window.getCookie = getCookie;
}

/**
 * Показывает уведомление об ошибке пользователю
 * @param {string} message - Текст сообщения
 * @param {string} type - Тип уведомления: 'error', 'warning', 'info', 'success'
 * @param {number} duration - Длительность показа в миллисекундах (по умолчанию 5000)
 */
function showNotification(message, type = 'error', duration = 5000) {
  // Создаем элемент уведомления
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  // Стили для уведомления
  Object.assign(notification.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '16px 24px',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '500',
    zIndex: '10000',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    animation: 'slideInRight 0.3s ease',
    maxWidth: '400px',
    wordWrap: 'break-word',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)'
  });
  
  // Цвета в зависимости от типа
  const colors = {
    error: { bg: 'rgba(239, 68, 68, 0.9)', border: '#ef4444' },
    warning: { bg: 'rgba(245, 158, 11, 0.9)', border: '#f59e0b' },
    info: { bg: 'rgba(59, 130, 246, 0.9)', border: '#3b82f6' },
    success: { bg: 'rgba(34, 197, 94, 0.9)', border: '#22c55e' }
  };
  
  const color = colors[type] || colors.error;
  notification.style.background = color.bg;
  notification.style.border = `2px solid ${color.border}`;
  
  // Добавляем в DOM
  document.body.appendChild(notification);
  
  // Удаляем через указанное время
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, duration);
  
  return notification;
}

/**
 * Обрабатывает ошибки fetch запросов
 * @param {Error} error - Объект ошибки
 * @returns {string} - Понятное сообщение для пользователя
 */
function handleFetchError(error) {
  console.error('Ошибка запроса:', error);
  
  // Сетевые ошибки
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return 'Проблема с подключением к серверу. Проверьте интернет-соединение.';
  }
  
  // Ошибки сети
  if (error.name === 'NetworkError' || error.message.includes('network')) {
    return 'Ошибка сети. Пожалуйста, проверьте подключение к интернету.';
  }
  
  // Таймаут
  if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
    return 'Превышено время ожидания ответа. Попробуйте позже.';
  }
  
  // Общая ошибка
  return error.message || 'Произошла ошибка при выполнении запроса.';
}

/**
 * Безопасный парсинг JSON ответа с обработкой ошибок
 * @param {Response} response - Объект Response от fetch
 * @param {Object} options - Опции парсинга {defaultValue: any, silent: boolean}
 * @returns {Promise<Object>} - Распарсенный JSON или значение по умолчанию
 */
async function safeJsonParse(response, options = {}) {
  const { defaultValue = null, silent = false } = options;
  
  try {
    // Проверяем Content-Type
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    
    // Получаем текст ответа
    const text = await response.text();
    
    // Если ответ пустой
    if (!text || text.trim().length === 0) {
      if (!silent) {
        console.warn('Получен пустой ответ от сервера');
      }
      return defaultValue;
    }
    
    // Если это не JSON, но мы ожидаем JSON
    if (!isJson && !silent) {
      console.warn('Ответ не является JSON. Content-Type:', contentType);
      // Пытаемся распарсить как JSON, если это возможно
      if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
        try {
          return JSON.parse(text);
        } catch {
          return defaultValue;
        }
      }
      return defaultValue;
    }
    
    // Пытаемся распарсить JSON
    try {
      return JSON.parse(text);
    } catch (parseError) {
      if (!silent) {
        console.error('Ошибка парсинга JSON:', parseError);
        console.error('Текст ответа:', text.substring(0, 200));
      }
      
      // Если это ошибка сервера, возвращаем информацию об ошибке
      if (!response.ok) {
        return { 
          error: `Ошибка ${response.status}: ${response.statusText}`,
          message: text.substring(0, 500)
        };
      }
      
      return defaultValue;
    }
  } catch (error) {
    if (!silent) {
      console.error('Ошибка обработки ответа:', error);
    }
    return defaultValue || { error: 'Ошибка обработки ответа сервера' };
  }
}

/**
 * Система валидации форм с визуальной обратной связью
 */

/**
 * Показывает ошибку валидации под полем
 * @param {HTMLElement} field - Поле ввода
 * @param {string} message - Сообщение об ошибке
 */
function showFieldError(field, message) {
  // Удаляем предыдущую ошибку, если есть
  clearFieldError(field);
  
  // Добавляем класс ошибки к полю
  field.classList.add('error');
  
  // Создаем элемент с сообщением об ошибке
  const errorElement = document.createElement('div');
  errorElement.className = 'field-error-message';
  errorElement.textContent = message;
  errorElement.setAttribute('role', 'alert');
  errorElement.setAttribute('aria-live', 'polite');
  
  // Вставляем после поля
  field.parentNode.insertBefore(errorElement, field.nextSibling);
  
  // Фокус на поле с ошибкой
  field.focus();
  
  return errorElement;
}

/**
 * Очищает ошибку валидации поля
 * @param {HTMLElement} field - Поле ввода
 */
function clearFieldError(field) {
  field.classList.remove('error');
  
  // Удаляем сообщение об ошибке
  const errorElement = field.parentNode.querySelector('.field-error-message');
  if (errorElement) {
    errorElement.remove();
  }
}

/**
 * Валидация телефона
 * @param {string} phone - Номер телефона
 * @returns {Object} - {valid: boolean, message: string}
 */
function validatePhone(phone) {
  if (!phone || !phone.trim()) {
    return { valid: false, message: 'Укажите номер телефона' };
  }
  
  const phoneDigits = phone.replace(/\D/g, '');
  
  if (phoneDigits.length < 10) {
    return { valid: false, message: 'Номер телефона должен содержать минимум 10 цифр' };
  }
  
  if (phoneDigits.length > 15) {
    return { valid: false, message: 'Номер телефона слишком длинный' };
  }
  
  // Проверка формата российского номера
  if (phoneDigits.startsWith('7') && phoneDigits.length !== 11) {
    return { valid: false, message: 'Неверный формат номера телефона' };
  }
  
  return { valid: true, message: '' };
}

/**
 * Валидация email
 * @param {string} email - Email адрес
 * @returns {Object} - {valid: boolean, message: string}
 */
function validateEmail(email) {
  if (!email || !email.trim()) {
    return { valid: false, message: 'Укажите email адрес' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return { valid: false, message: 'Введите корректный email адрес' };
  }
  
  if (email.length > 255) {
    return { valid: false, message: 'Email адрес слишком длинный' };
  }
  
  return { valid: true, message: '' };
}

/**
 * Валидация обязательного поля
 * @param {HTMLElement} field - Поле ввода
 * @param {string} fieldName - Название поля для сообщения
 * @returns {Object} - {valid: boolean, message: string}
 */
function validateRequired(field, fieldName = 'Поле') {
  const value = field.value ? field.value.trim() : '';
  
  if (!value) {
    return { valid: false, message: `${fieldName} обязательно для заполнения` };
  }
  
  return { valid: true, message: '' };
}

/**
 * Валидация длины текста
 * @param {string} text - Текст
 * @param {number} minLength - Минимальная длина
 * @param {number} maxLength - Максимальная длина
 * @param {string} fieldName - Название поля
 * @returns {Object} - {valid: boolean, message: string}
 */
function validateLength(text, minLength, maxLength, fieldName = 'Поле') {
  const length = text ? text.trim().length : 0;
  
  if (minLength && length < minLength) {
    return { valid: false, message: `${fieldName} должно содержать минимум ${minLength} символов` };
  }
  
  if (maxLength && length > maxLength) {
    return { valid: false, message: `${fieldName} должно содержать максимум ${maxLength} символов` };
  }
  
  return { valid: true, message: '' };
}

/**
 * Валидация формы с визуальной обратной связью
 * @param {HTMLFormElement} form - Форма для валидации
 * @param {Object} rules - Правила валидации {fieldId: {validator: function, message: string}}
 * @returns {boolean} - true если форма валидна
 */
function validateForm(form, rules) {
  let isValid = true;
  
  // Очищаем все предыдущие ошибки
  form.querySelectorAll('.error').forEach(field => {
    clearFieldError(field);
  });
  
  // Валидируем каждое поле
  for (const [fieldId, rule] of Object.entries(rules)) {
    const field = form.querySelector(`#${fieldId}`) || form.querySelector(`[name="${fieldId}"]`);
    
    if (!field) continue;
    
    let fieldValid = true;
    let errorMessage = '';
    
    // Проверяем обязательность
    if (rule.required) {
      const requiredCheck = validateRequired(field, rule.label || fieldId);
      if (!requiredCheck.valid) {
        fieldValid = false;
        errorMessage = requiredCheck.message;
      }
    }
    
    // Если поле не пустое или не обязательное, проверяем другие правила
    if (fieldValid && field.value && field.value.trim()) {
      // Валидация телефона
      if (rule.type === 'phone') {
        const phoneCheck = validatePhone(field.value);
        if (!phoneCheck.valid) {
          fieldValid = false;
          errorMessage = phoneCheck.message;
        }
      }
      
      // Валидация email
      if (rule.type === 'email') {
        const emailCheck = validateEmail(field.value);
        if (!emailCheck.valid) {
          fieldValid = false;
          errorMessage = emailCheck.message;
        }
      }
      
      // Валидация длины
      if (rule.minLength || rule.maxLength) {
        const lengthCheck = validateLength(
          field.value,
          rule.minLength,
          rule.maxLength,
          rule.label || fieldId
        );
        if (!lengthCheck.valid) {
          fieldValid = false;
          errorMessage = lengthCheck.message;
        }
      }
      
      // Кастомная валидация
      if (rule.validator && typeof rule.validator === 'function') {
        const customCheck = rule.validator(field.value, field);
        if (customCheck && !customCheck.valid) {
          fieldValid = false;
          errorMessage = customCheck.message || rule.message || 'Неверное значение';
        }
      }
    }
    
    // Показываем ошибку, если поле невалидно
    if (!fieldValid) {
      showFieldError(field, errorMessage);
      isValid = false;
    } else {
      clearFieldError(field);
    }
  }
  
  return isValid;
}

/**
 * Инициализация валидации в реальном времени
 * @param {HTMLElement} field - Поле ввода
 * @param {Object} rule - Правило валидации
 */
function initRealtimeValidation(field, rule) {
  // Валидация при потере фокуса
  field.addEventListener('blur', () => {
    if (field.value && field.value.trim()) {
      validateField(field, rule);
    } else if (rule.required) {
      validateField(field, rule);
    }
  });
  
  // Очистка ошибки при вводе
  field.addEventListener('input', () => {
    if (field.classList.contains('error')) {
      clearFieldError(field);
    }
  });
}

/**
 * Валидация одного поля
 * @param {HTMLElement} field - Поле ввода
 * @param {Object} rule - Правило валидации
 * @returns {boolean} - true если поле валидно
 */
function validateField(field, rule) {
  let isValid = true;
  let errorMessage = '';
  
  // Проверка обязательности
  if (rule.required) {
    const requiredCheck = validateRequired(field, rule.label || field.name || field.id);
    if (!requiredCheck.valid) {
      isValid = false;
      errorMessage = requiredCheck.message;
    }
  }
  
  // Дополнительные проверки, если поле не пустое
  if (isValid && field.value && field.value.trim()) {
    if (rule.type === 'phone') {
      const phoneCheck = validatePhone(field.value);
      if (!phoneCheck.valid) {
        isValid = false;
        errorMessage = phoneCheck.message;
      }
    }
    
    if (rule.type === 'email') {
      const emailCheck = validateEmail(field.value);
      if (!emailCheck.valid) {
        isValid = false;
        errorMessage = emailCheck.message;
      }
    }
    
    if (rule.minLength || rule.maxLength) {
      const lengthCheck = validateLength(
        field.value,
        rule.minLength,
        rule.maxLength,
        rule.label || field.name || field.id
      );
      if (!lengthCheck.valid) {
        isValid = false;
        errorMessage = lengthCheck.message;
      }
    }
    
    if (rule.validator && typeof rule.validator === 'function') {
      const customCheck = rule.validator(field.value, field);
      if (customCheck && !customCheck.valid) {
        isValid = false;
        errorMessage = customCheck.message || rule.message || 'Неверное значение';
      }
    }
  }
  
  // Показываем или очищаем ошибку
  if (!isValid) {
    showFieldError(field, errorMessage);
  } else {
    clearFieldError(field);
  }
  
  return isValid;
}

// Добавляем CSS стили для валидации, если их еще нет
if (!document.getElementById('validation-styles')) {
  const style = document.createElement('style');
  style.id = 'validation-styles';
  style.textContent = `
    /* Стили для полей с ошибками */
    input.error,
    textarea.error,
    select.error {
      border-color: #ef4444 !important;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2) !important;
      background-color: rgba(239, 68, 68, 0.05) !important;
    }
    
    input.error:focus,
    textarea.error:focus,
    select.error:focus {
      border-color: #ef4444 !important;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.3) !important;
    }
    
    /* Сообщения об ошибках */
    .field-error-message {
      color: #ef4444;
      font-size: 0.875rem;
      margin-top: 6px;
      display: block;
      animation: slideDown 0.2s ease;
      line-height: 1.4;
    }
    
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-5px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    /* Успешная валидация */
    input.valid,
    textarea.valid,
    select.valid {
      border-color: #22c55e !important;
    }
  `;
  document.head.appendChild(style);
}

// Добавляем CSS анимации для уведомлений, если их еще нет
if (!document.getElementById('notification-styles')) {
  const style = document.createElement('style');
  style.id = 'notification-styles';
  style.textContent = `
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOutRight {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    formatPrice, 
    showNotification, 
    handleFetchError, 
    safeJsonParse,
    showFieldError,
    clearFieldError,
    validatePhone,
    validateEmail,
    validateRequired,
    validateLength,
    validateForm,
    validateField,
    initRealtimeValidation
  };
} else {
  window.formatPrice = formatPrice;
  window.showNotification = showNotification;
  window.handleFetchError = handleFetchError;
  window.safeJsonParse = safeJsonParse;
  window.showFieldError = showFieldError;
  window.clearFieldError = clearFieldError;
  window.validatePhone = validatePhone;
  window.validateEmail = validateEmail;
  window.validateRequired = validateRequired;
  window.validateLength = validateLength;
  window.validateForm = validateForm;
  window.validateField = validateField;
  window.initRealtimeValidation = initRealtimeValidation;
}