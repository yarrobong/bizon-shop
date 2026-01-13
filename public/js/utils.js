// utils.js
// Форматирование цены
function formatPrice(price) {
  if (price === null || price === 0) return 'Цена по запросу';
  return new Intl.NumberFormat('ru-RU').format(price) + ' ₽';
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
 * @returns {Promise<Object>} - Распарсенный JSON или пустой объект
 */
async function safeJsonParse(response) {
  try {
    if (!response.ok) {
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        return { error: `Ошибка ${response.status}: ${response.statusText}` };
      }
    }
    return await response.json();
  } catch (error) {
    console.error('Ошибка парсинга JSON:', error);
    return { error: 'Ошибка обработки ответа сервера' };
  }
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
  module.exports = { formatPrice, showNotification, handleFetchError, safeJsonParse };
} else {
  window.formatPrice = formatPrice;
  window.showNotification = showNotification;
  window.handleFetchError = handleFetchError;
  window.safeJsonParse = safeJsonParse;
}