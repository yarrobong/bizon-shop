// main.js
// Инициализация приложения
window.currentCategory = 'все';

// Функция рендеринга продуктов (заглушка)
function renderProducts() {
  console.log('Рендеринг продуктов для категории:', window.currentCategory);
  // Здесь будет ваша логика рендеринга
}

// Функция обновления счетчика корзины (заглушка)
function updateCartCount() {
  console.log('Обновление счетчика корзины');
  // Здесь будет ваша логика обновления корзины
}

// Функция настройки обработчиков событий (заглушка)
function setupEventListeners() {
  console.log('Настройка обработчиков событий');
  // Здесь будет ваша логика обработчиков
}

document.addEventListener('DOMContentLoaded', () => {
  renderProducts();
  updateCartCount();
  setupEventListeners();
});

(function () {
  var a = document.querySelectorAll('.nav-list a');
  for (var i = a.length; i--;) {
    if (a[i].href === window.location.pathname || a[i].href === window.location.href) {
      a[i].className += ' active';
    }
  }
})();