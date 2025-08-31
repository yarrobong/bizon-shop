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