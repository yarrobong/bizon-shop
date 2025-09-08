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

document.addEventListener("DOMContentLoaded", () => {
  const trackInner = document.querySelector('.clients-track-inner');
  
  // Получаем ширину одного набора логотипов
  const logos = trackInner.querySelectorAll('.client-logo');
  const firstSetWidth = Array.from(logos).slice(0, logos.length / 2)
    .reduce((total, img) => total + img.offsetWidth + 64, 0); // 64 = gap в пикселях
  
  // Создаем точную анимацию
  const animationName = `smoothScroll_${Date.now()}`;
  
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes ${animationName} {
      0% {
        transform: translateX(0);
      }
      100% {
        transform: translateX(-${firstSetWidth}px);
      }
    }
  `;
  document.head.appendChild(styleSheet);
  
  // Применяем анимацию
  trackInner.style.animation = `${animationName} 30s linear infinite`;
  
  // Пауза при наведении
  trackInner.addEventListener('mouseenter', () => {
    trackInner.style.animationPlayState = 'paused';
  });
  
  trackInner.addEventListener('mouseleave', () => {
    trackInner.style.animationPlayState = 'running';
  });
});