// ui.js
// DOM-элементы (только для главной/каталога)
const productsContainer = document.getElementById('products');
const searchInput = document.getElementById('search-input');
const categoryButtons = document.querySelectorAll('.tag-btn');
// const cartBtn = document.getElementById('cart-btn'); // <-- Убрано, так как обработчик теперь в main.js
// const cartModal = document.getElementById('cart-modal'); // <-- Убрано, модальное окно больше не используется
// const productModal = document.getElementById('product-modal'); // <-- Убрано, модальное окно больше не используется
// const cartItems = document.getElementById('cart-items'); // <-- Убрано, относится к модальному окну
// const phoneInput = document.getElementById('phone'); // <-- Убрано, относится к модальному окну
// const commentInput = document.getElementById('comment-input'); // <-- Убрано, относится к модальному окну
// const sendOrderBtn = document.getElementById('send-order'); // <-- Убрано, относится к модальному окну
// const successMessage = document.getElementById('success-message'); // <-- Убрано, относится к модальному окну
const yearSpan = document.getElementById('year');
let renderProductsTimeout;

// local-data.js или в начале ui.js
const LOCAL_PRODUCTS = [
  {
    id: 1,
    title: "BOBOVR BD3",
    description: "Док-станция для B100",
    price: 3390,
    category: "Док станции",
    images: [
      { url: "/assets/Images-Products/Док станции/BOBOVR BD3 для B100/1.png", alt: "BOBOVR BD3" }
    ],
    tag: "Хит",
    available: true
  },
  // ... другие товары
];

// Установка года
if (yearSpan) {
  yearSpan.textContent = new Date().getFullYear();
}

// Форматирование цены
function formatPrice(price) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
}

// Получение корзины из localStorage (использует ключ 'cart')
function getCart() {
  const cart = localStorage.getItem('cart'); // <-- Используем ключ 'cart'
  return cart ? JSON.parse(cart) : [];
}

// Добавление в корзину (использует ключ 'cart')
function addToCart(product) {
  console.log("ui.js: Добавляем в корзину:", product.id, product.title); // <-- Новый лог
  const cart = getCart();
  const existingItem = cart.find(item => item.product.id === product.id);

  if (existingItem) {
    existingItem.qty += 1;
  } else {
    cart.push({ product, qty: 1 });
  }

  localStorage.setItem('cart', JSON.stringify(cart)); // <-- Используем ключ 'cart'
  updateCartCount(); // Обновляем счётчик
}

// Обновление количества в корзине (использует ключ 'cart')
function updateQuantity(productId, change) {
  const cart = getCart();
  const item = cart.find(item => item.product.id === productId);

  if (item) {
    item.qty += change;
    if (item.qty <= 0) {
      const index = cart.indexOf(item);
      cart.splice(index, 1);
    }
    localStorage.setItem('cart', JSON.stringify(cart)); // <-- Используем ключ 'cart'
    updateCartCount();
    // УБРАНО: openCartModal(); // Не перерисовываем модальное окно
  }
}

// Очистка корзины (использует ключ 'cart')
function clearCart() {
  localStorage.removeItem('cart'); // <-- Используем ключ 'cart'
  updateCartCount();
}

// Обновление счетчика корзины
function updateCartCount() {
  const cart = getCart();
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartCountEls = document.querySelectorAll('#cart-count, #cart-count-header'); // Используем селекторы из state.js/main.js

  cartCountEls.forEach(el => {
    if (el) {
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none'; // Используем display: flex; как в state.js
    }
  });
}

// Асинхронная загрузка и рендеринг товаров
async function renderProducts() {
  if (renderProductsTimeout) {
    clearTimeout(renderProductsTimeout);
  }

  renderProductsTimeout = setTimeout(async () => {
    let PRODUCTS = [];
    let useLocalData = false;

    try {
      // Пытаемся загрузить с сервера
      const res = await fetch('/api/products');

      if (!res.ok) {
        throw new Error('Не удалось загрузить товары');
      }

      PRODUCTS = await res.json();

      // Если сервер вернул пустой массив, используем локальные данные
      if (!PRODUCTS || PRODUCTS.length === 0) {
        console.warn('Сервер вернул пустой массив товаров, используем локальные данные');
        PRODUCTS = LOCAL_PRODUCTS;
        useLocalData = true;
      }

    } catch (err) {
      console.error('Ошибка загрузки товаров с сервера:', err);
      console.warn('Используем локальные данные как резервный вариант');
      PRODUCTS = LOCAL_PRODUCTS;
      useLocalData = true;
    }

    // Остальной код фильтрации и отображения...
    const query = (searchInput?.value || '').toLowerCase();
    const currentCategory = window.currentCategory || 'все';

    const filtered = PRODUCTS.filter(p => {
      const available = p.available !== false;
      const categoryMatch = currentCategory === 'все' || p.category === currentCategory;
      const searchMatch = query === '' ||
        p.title.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query));

      return available && categoryMatch && searchMatch;
    });

    // Отображение товаров...
    if (!productsContainer) return;

    productsContainer.innerHTML = '';

    if (filtered.length === 0) {
      productsContainer.innerHTML = `
        <div class="empty">
          <div class="text-6xl">🔍</div>
          <h3>Товары не найдены</h3>
          <p>Попробуйте изменить параметры поиска</p>
          ${useLocalData ? '<small class="text-muted">Отображаются локальные данные</small>' : ''}
        </div>
      `;
      return;
    }

    // Рендеринг карточек...
    filtered.forEach((product) => {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.innerHTML = `
        <div class="product-content">
          <h3 class="product-title">${product.title}</h3>
          <div class="product-image">
            <img src="${product.images[0]?.url?.trim() || '/assets/icons/placeholder1.webp'}" alt="${product.title}" />
            ${product.tag ? `<div class="product-badge" data-tag="${product.tag.toLowerCase()}">${product.tag}</div>` : ''}
          </div>
          <div class="product-footer">
            <div class="product-price">${formatPrice(product.price)}</div>
            <div class="product-actions">
              <button class="btn-details" data-id="${product.id}">Подробнее</button>
              <button class="btn-cart" data-id="${product.id}">В корзину</button>
            </div>
          </div>
        </div>
      `;
      productsContainer.appendChild(card);
    });

    // Обработчики для кликов по всей карточке товара
    document.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', (event) => {
        // Проверяем, что клик был не по кнопке "В корзину", чтобы избежать конфликта
        if (event.target.classList.contains('btn-cart')) return;
        // Проверяем, что клик был не по кнопке "Подробнее"
        if (event.target.classList.contains('btn-details')) return;

        // Клик по карточке - переходим на страницу товара
        const buttonDetails = card.querySelector('.btn-details');
        if (!buttonDetails) return;
        const productId = parseInt(buttonDetails.dataset.id);
        if (productId) {
            // Переход на новую страницу товара
            window.location.href = `product.html?id=${productId}`;
        }
      });
    });

    // Обработчики для кнопок "Подробнее"
    // УБРАНО: Открытие модального окна. Теперь "Подробнее" ведёт на product.html.
    document.querySelectorAll('.btn-details').forEach(button => {
      button.addEventListener('click', (event) => {
        event.stopPropagation(); // Предотвращаем всплытие, чтобы не сработал обработчик клика по карточке
        const productId = parseInt(event.target.dataset.id);
        // Переход на страницу товара
        window.location.href = `product.html?id=${productId}`;
      });
    });

    // Обработчики для кнопок "В корзину"
    document.querySelectorAll('.btn-cart').forEach(button => {
      button.addEventListener('click', (event) => {
        event.stopPropagation(); // Останавливаем всплытие, чтобы не сработал обработчик клика по карточке
        const productId = parseInt(event.target.dataset.id);
        const product = PRODUCTS.find(p => p.id === productId);
        if (product) {
          addToCart(product);
          updateCartCount();
        }
      });
    });

    // Добавляем визуальный индикатор, если используются локальные данные
    if (useLocalData) {
      const indicator = document.createElement('div');
      indicator.className = 'local-data-indicator';
      indicator.innerHTML = '⚠️ Используются локальные данные';
      indicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #ff6b6b;
        color: white;
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10000;
      `;
      document.body.appendChild(indicator);

      // Удаляем индикатор через 5 секунд
      setTimeout(() => {
        if (indicator.parentNode) {
          indicator.parentNode.removeChild(indicator);
        }
      }, 5000);
    }

  }, 300);
}

// УБРАНО: Функция openProductModal и selectVariantInModal

// УБРАНО: Функция openCartModal (теперь в main.js)
// УБРАНО: Функция sanitizePhoneInput (теперь в main.js)
// УБРАНО: Функция closeModals (теперь в main.js)
// УБРАНО: Функция updateSendOrderButton (теперь в main.js)

// Привязка событий (только для главной/каталога)
function setupEventListeners() {
  const searchInput = document.getElementById('search-input');

  if (searchInput) {
    searchInput.removeEventListener('input', renderProducts);
    searchInput.addEventListener('input', renderProducts);
  }

  const categoryButtons = document.querySelectorAll('.tag-btn');

  categoryButtons.forEach(btn => {
    btn.removeEventListener('click', handleCategoryClick);
  });

  categoryButtons.forEach(btn => {
    btn.addEventListener('click', handleCategoryClick);
  });

  // УБРАНО: Обработчик для cartBtn (теперь в main.js)
  // if (cartBtn) {
  //   cartBtn.removeEventListener('click', openCartModal); // <-- Убрано
  //   cartBtn.addEventListener('click', openCartModal); // <-- Убрано
  // }

  // УБРАНО: Обработчики для кнопок "Добавить в корзину" и "Купить" (модальное окно) - они теперь в product.js
  // document.getElementById('add-to-cart-btn')?.addEventListener('click', () => { ... });
  // document.getElementById('buy-now-btn')?.addEventListener('click', () => { ... });

  // УБРАНО: Обработчики для элементов модального окна
  // phoneInput?.addEventListener('input', () => { ... });
  // const consentCheckbox = document.getElementById('consent-toggle');
  // if (consentCheckbox) { consentCheckbox.addEventListener('change', updateSendOrderButton); }
  // if (sendOrderBtn) { sendOrderBtn.addEventListener('click', async () => { ... }); }
  // document.querySelectorAll('[data-close]').forEach(btn => { btn.addEventListener('click', closeModals); });

  // Добавляем обработчик для кнопки корзины, если она есть (альтернативный способ, если не в main.js)
  const cartBtn = document.getElementById('cart-btn'); // <-- Опционально, если нужно здесь
  if (cartBtn) {
  cartBtn.addEventListener('click', () => {
       window.location.href = '/cart.html'; // <-- Перенаправление
     });
   }
}

function handleCategoryClick(event) {
  const categoryButtons = document.querySelectorAll('.tag-btn');
  const clickedBtn = event.target;

  categoryButtons.forEach(btn => {
    btn.classList.remove('active');
  });

  clickedBtn.classList.add('active');

  window.currentCategory = clickedBtn.dataset.category || 'все';

  renderProducts();
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
  window.currentCategory = 'все';

  setupEventListeners();

  await renderProducts();

  // УБРАНО: updateSendOrderButton(); // Больше не нужно на главной/каталоге
  updateCartCount();
});

// Экспорт (только функции, не связанные с модальными окнами)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderProducts, setupEventListeners, getCart, addToCart, updateQuantity, clearCart, updateCartCount, formatPrice };
} else {
  window.renderProducts = renderProducts;
  window.setupEventListeners = setupEventListeners;
  // window.openProductModal = openProductModal; // <-- Убрано
  // window.openCartModal = openCartModal; // <-- Убрано
  // window.closeModals = closeModals; // <-- Убрано
  // window.updateSendOrderButton = updateSendOrderButton; // <-- Убрано

  // Экспортируем функции корзины
  window.getCart = getCart;
  window.addToCart = addToCart;
  window.updateQuantity = updateQuantity;
  window.clearCart = clearCart;
  window.updateCartCount = updateCartCount;
  window.formatPrice = formatPrice; // Если нужно глобально
}