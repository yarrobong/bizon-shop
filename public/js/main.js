// main.js
document.addEventListener('DOMContentLoaded', async () => {
 
  
  // Инициализируем начальное состояние
  window.currentCategory = 'все'; // Устанавливаем начальную категорию
  

  

  
  
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

