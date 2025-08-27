// utils.js
// Форматирование цены
function formatPrice(price) {
  if (price === null || price === 0) return 'Цена по запросу';
  return new Intl.NumberFormat('ru-RU').format(price) + ' ₽';
}

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { formatPrice };
} else {
  window.formatPrice = formatPrice;
}