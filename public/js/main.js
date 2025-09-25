document.addEventListener('DOMContentLoaded', async () => {
  // Инициализируем начальное состояние
  window.currentCategory = 'все'; // Устанавливаем начальную категорию

  // Определяем текущую страницу и устанавливаем активный пункт меню
  const url = window.location.href;
  let pageKey = null; // <-- Теперь по умолчанию null

  // Проверяем конкретные страницы
  if (url.includes('/catalog')) pageKey = 'catalog';
  else if (url.includes('/attractions')) pageKey = 'attractions';
  else if (url.includes('/contact')) pageKey = 'contact';
  // else if (url.includes('/product.html')) pageKey = 'product'; // <-- Не нужно

  // Проверяем, находимся ли мы на главной странице
  // window.location.pathname возвращает путь, например, '/' или '/catalog'
  if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
    // Если URL указывает на главную, устанавливаем pageKey в 'index', независимо от других условий
    pageKey = 'index';
  }

  // Удаляем активный класс со всех ссылок
  document.querySelectorAll('.nav-list a').forEach(link => {
    link.classList.remove('active');
  });

  // Добавляем активный класс нужной ссылке, ТОЛЬКО ЕСЛИ pageKey - одна из известных страниц меню ИЛИ это главная
  const activeLink = document.querySelector(`.nav-list a[data-page="${pageKey}"]`);
  if (activeLink && pageKey !== null) { // <-- Проверяем, что pageKey не null
    activeLink.classList.add('active');
  }
});

// Аккордеон для FAQ
document.querySelectorAll('.accordion-header').forEach(button => {
  button.addEventListener('click', () => {
    const item = button.parentElement;
    const panel = item.querySelector('.accordion-panel');
    const icon = button.querySelector('.accordion-icon');

    // Закрываем все другие (если нужно только один открыт)
    document.querySelectorAll('.accordion-item').forEach(i => {
      if (i !== item) {
        i.querySelector('.accordion-panel').classList.remove('open');
        i.querySelector('.accordion-header').classList.remove('active');
        i.querySelector('.accordion-icon').textContent = '+';
      }
    });

    // Переключаем текущий
    panel.classList.toggle('open');
    button.classList.toggle('active');
    icon.textContent = panel.classList.contains('open') ? '−' : '+';
  });
});





// Мобильное меню
const hamburger = document.getElementById('hamburger');
const nav = document.getElementById('mainNav');

hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    nav.classList.toggle('active');
});

// Закрытие меню при клике на ссылку
document.querySelectorAll('.nav-list a').forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        nav.classList.remove('active');
    });
});