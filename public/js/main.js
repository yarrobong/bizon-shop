document.addEventListener('DOMContentLoaded', async () => {
  // Инициализируем начальное состояние
  window.currentCategory = 'все'; // Устанавливаем начальную категорию
  
  // Определяем текущую страницу и устанавливаем активный пункт меню
  const url = window.location.href;
  let pageKey = 'index';

  if (url.includes('/catalog')) pageKey = 'catalog';
  else if (url.includes('/attractions')) pageKey = 'attractions'; // Добавлено
  else if (url.includes('/contact')) pageKey = 'contact';

  // Удаляем активный класс со всех ссылок
  document.querySelectorAll('.nav-list a').forEach(link => {
    link.classList.remove('active');
  });

  // Добавляем активный класс нужной ссылке
  const activeLink = document.querySelector(`.nav-list a[data-page="${pageKey}"]`);
  if (activeLink) {
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