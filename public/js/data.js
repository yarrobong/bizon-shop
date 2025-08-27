// Экспорт для модульной системы
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PRODUCTS };
} else {
  window.PRODUCTS = PRODUCTS;
}