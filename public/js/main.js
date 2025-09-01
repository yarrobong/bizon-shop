// main.js
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[DEBUG] DOM загружен, инициализация приложения');
  
  // Инициализируем начальное состояние
  window.currentCategory = 'все'; // Устанавливаем начальную категорию
  
  // Настраиваем обработчики событий
  setupEventListeners();
  
  // Загружаем и отображаем товары
  await renderProducts();
  
  
});

const path = window.location.pathname;
let pageKey = 'index'; // по умолчанию — главная

if (path.includes('catalog.html')) pageKey = 'catalog';
else if (path.includes('about.html')) pageKey = 'about';
else if (path.includes('contact.html')) pageKey = 'contact';

const activeLink = document.querySelector(`.main-nav a[data-page="${pageKey}"]`);
if (activeLink) {
  activeLink.classList.add('active');
}