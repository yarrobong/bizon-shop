// main.js
// Инициализация приложения
window.currentCategory = 'все';



document.addEventListener('DOMContentLoaded', () => {
  renderProducts();
  updateCartCount();
  setupEventListeners();
});

(function () {
  var a = document.querySelectorAll('.nav-list a');
  var currentPath = window.location.pathname;
  var currentHref = window.location.href;
  
  // Нормализуем пути для сравнения
  var normalizedPath = currentPath.replace(/\/$/, '') || '/'; // Убираем trailing slash, кроме корня
  var isHomePage = normalizedPath === '/' || normalizedPath === '/index.html' || normalizedPath === '/index.htm' || currentHref === window.location.origin + '/';
  
  for (var i = a.length; i--;) {
    var linkHref = a[i].getAttribute('href');
    var normalizedLink = linkHref.replace(/\/$/, '') || '/';
    
    // Для главной страницы проверяем несколько вариантов
    if (isHomePage && (normalizedLink === '/' || linkHref === 'index.html' || linkHref === './index.html')) {
      a[i].className += ' active';
    }
    // Для остальных страниц обычное сравнение
    else if (normalizedLink === normalizedPath || a[i].href === currentHref) {
      a[i].className += ' active';
    }
  }
})();;