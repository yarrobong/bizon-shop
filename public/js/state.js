// js/state.js
// Ключ для хранения в localStorage (используем 'cart', как в ui.js)
const CART_STORAGE_KEY = 'cart'; // <-- Изменено с 'bizon-cart' на 'cart'

// Инициализация корзины: загружаем из localStorage или создаём пустую
let cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];

// Текущий фильтр (например, по тегу)
let currentTag = 'все';

// === Функции корзины ===

function addToCart(product) {
  console.log('[addToCart] Вызвана функция addToCart для товара:', product);
  
  if (!product || !product.id) {
    console.error('[addToCart] Ошибка: товар не передан или отсутствует id');
    return;
  }
  
  const existing = cart.find(item => item.product.id === product.id);
  if (existing) {
    existing.qty += 1;
    console.log('[addToCart] Увеличено количество товара в корзине:', existing.qty);
  } else {
    cart.push({ product, qty: 1 });
    console.log('[addToCart] Товар добавлен в корзину');
  }
  saveCart(); // Сохраняем в localStorage
  updateCartCount();
  
  // Показываем мини-корзину и обновляем кнопку
  console.log('[addToCart] Вызываем showMiniCart и updateCartButton');
  try {
    showMiniCart();
    updateCartButton(product.id);
  } catch (error) {
    console.error('[addToCart] Ошибка при показе мини-корзины:', error);
  }
}

// Показать мини-корзину
function showMiniCart() {
  console.log('[showMiniCart] Функция вызвана');
  
  if (typeof document === 'undefined' || !document.body) {
    console.error('[showMiniCart] Ошибка: document или document.body недоступны');
    return;
  }
  
  // Создаем или получаем элемент мини-корзины
  let miniCart = document.getElementById('mini-cart');
  
  if (!miniCart) {
    console.log('[showMiniCart] Создаем новый элемент мини-корзины');
    miniCart = document.createElement('div');
    miniCart.id = 'mini-cart';
    miniCart.className = 'mini-cart';
    document.body.appendChild(miniCart);
    console.log('[showMiniCart] Элемент добавлен в DOM');
  } else {
    console.log('[showMiniCart] Используем существующий элемент');
  }
  
  // Получаем корзину
  const cartItems = getCart();
  console.log('[showMiniCart] Товаров в корзине:', cartItems.length);
  
  const totalItems = cartItems.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cartItems.reduce((sum, item) => sum + (item.product.price * item.qty), 0);
  
  console.log('[showMiniCart] Итого товаров:', totalItems, 'Итого цена:', totalPrice);
  
  // Форматируем цену
  const formatPrice = (price) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };
  
  // Рендерим содержимое мини-корзины
  console.log('[showMiniCart] Рендерим содержимое мини-корзины');
  miniCart.innerHTML = `
    <div class="mini-cart-header">
      <h3>Корзина</h3>
      <button class="mini-cart-close" aria-label="Закрыть">&times;</button>
    </div>
    <div class="mini-cart-items">
      ${cartItems.length === 0 
        ? '<div class="mini-cart-empty">Корзина пуста</div>'
        : cartItems.map(item => `
          <div class="mini-cart-item" data-product-id="${item.product.id}">
            <img src="${item.product.images[0]?.url?.trim() || '/assets/icons/placeholder1.webp'}" 
                 alt="${item.product.title}" />
            <div class="mini-cart-item-info">
              <div class="mini-cart-item-title">${item.product.title}</div>
              <div class="mini-cart-item-details">
                <span class="mini-cart-item-qty">${item.qty} шт.</span>
                <span class="mini-cart-item-price">${formatPrice(item.product.price * item.qty)}</span>
              </div>
            </div>
            <button class="mini-cart-item-remove" data-product-id="${item.product.id}" aria-label="Удалить товар" title="Удалить из корзины">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        `).join('')
      }
    </div>
    <div class="mini-cart-footer">
      <div class="mini-cart-total">
        <span>Итого:</span>
        <span class="mini-cart-total-price">${formatPrice(totalPrice)}</span>
      </div>
      <div class="mini-cart-actions">
        ${cartItems.length > 0 
          ? `<a href="/cart" class="mini-cart-btn mini-cart-btn-primary">Перейти в корзину</a>`
          : `<a href="/catalog" class="mini-cart-btn mini-cart-btn-primary">Перейти в каталог</a>`
        }
      </div>
    </div>
  `;
  
  // Показываем мини-корзину с анимацией
  console.log('[showMiniCart] Добавляем класс show');
  miniCart.classList.add('show');
  
  // Проверяем, что класс добавлен
  setTimeout(() => {
    console.log('[showMiniCart] Проверка: класс show добавлен?', miniCart.classList.contains('show'));
    console.log('[showMiniCart] Стили элемента:', window.getComputedStyle(miniCart).display);
    console.log('[showMiniCart] Позиция элемента:', miniCart.getBoundingClientRect());
  }, 100);
  
  // Обработчик закрытия
  const closeBtn = miniCart.querySelector('.mini-cart-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      console.log('[showMiniCart] Закрытие мини-корзины по клику');
      hideMiniCart();
    });
  } else {
    console.warn('[showMiniCart] Кнопка закрытия не найдена');
  }
  
  // Обработчики удаления товаров
  const removeButtons = miniCart.querySelectorAll('.mini-cart-item-remove');
  removeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const productId = parseInt(btn.dataset.productId);
      console.log('[showMiniCart] Удаление товара из корзины:', productId);
      
      if (typeof window.removeFromCart === 'function') {
        window.removeFromCart(productId);
        // Обновляем мини-корзину
        showMiniCart();
        // Обновляем кнопки
        if (typeof window.updateAllCartButtons === 'function') {
          window.updateAllCartButtons();
        }
      }
    });
  });
  
  // Автоматически скрываем через 5 секунд
  clearTimeout(window.miniCartTimeout);
  window.miniCartTimeout = setTimeout(() => {
    console.log('[showMiniCart] Автоматическое закрытие мини-корзины');
    hideMiniCart();
  }, 5000);
}

// Скрыть мини-корзину
function hideMiniCart() {
  const miniCart = document.getElementById('mini-cart');
  if (miniCart) {
    miniCart.classList.remove('show');
    setTimeout(() => {
      if (miniCart && !miniCart.classList.contains('show')) {
        miniCart.remove();
      }
    }, 300);
  }
}

// Обновить кнопку "В корзину" на "В корзине"
function updateCartButton(productId) {
  console.log('[updateCartButton] Обновление кнопки для товара:', productId);
  
  const cart = getCart();
  const item = cart.find(item => item.product.id === productId);
  
  if (item) {
    console.log('[updateCartButton] Товар найден в корзине, обновляем кнопки');
    
    // Обновляем кнопки в карточках товаров
    const cardButtons = document.querySelectorAll(`.btn-cart[data-id="${productId}"]`);
    console.log('[updateCartButton] Найдено кнопок в карточках:', cardButtons.length);
    cardButtons.forEach(button => {
      button.textContent = 'В корзине';
      button.classList.add('in-cart');
      button.disabled = false;
      console.log('[updateCartButton] Кнопка обновлена:', button);
    });
    
    // Обновляем кнопку на странице товара (проверяем по data-id или по текущему товару)
    const productPageBtn = document.getElementById('product-page-add-to-cart-btn');
    if (productPageBtn) {
      const btnProductId = parseInt(productPageBtn.dataset.id);
      console.log('[updateCartButton] Кнопка на странице товара найдена, data-id:', btnProductId);
      // Если кнопка соответствует текущему товару или data-id не установлен (значит это текущий товар)
      if (!btnProductId || btnProductId === productId) {
        productPageBtn.textContent = 'В корзине';
        productPageBtn.classList.add('in-cart');
        productPageBtn.disabled = false;
        console.log('[updateCartButton] Кнопка на странице товара обновлена');
      }
    } else {
      console.log('[updateCartButton] Кнопка на странице товара не найдена');
    }
  } else {
    console.warn('[updateCartButton] Товар не найден в корзине');
  }
}

// Обновить все кнопки корзины на странице
function updateAllCartButtons() {
  const cart = getCart();
  const cartProductIds = cart.map(item => item.product.id);
  
  // Обновляем кнопки в карточках товаров
  document.querySelectorAll('.btn-cart').forEach(button => {
    const productId = parseInt(button.dataset.id);
    if (productId && cartProductIds.includes(productId)) {
      button.textContent = 'В корзине';
      button.classList.add('in-cart');
    } else {
      button.textContent = 'В корзину';
      button.classList.remove('in-cart');
    }
  });
  
  // Обновляем кнопку на странице товара
  const productPageBtn = document.getElementById('product-page-add-to-cart-btn');
  if (productPageBtn) {
    const productId = parseInt(productPageBtn.dataset.id);
    // Если товар в корзине
    if (productId && cartProductIds.includes(productId)) {
      productPageBtn.textContent = 'В корзине';
      productPageBtn.classList.add('in-cart');
    } else {
      productPageBtn.textContent = 'Добавить в корзину';
      productPageBtn.classList.remove('in-cart');
    }
  }
}

function removeFromCart(productId) {
  console.log('[removeFromCart] Удаление товара из корзины:', productId);
  cart = cart.filter(item => item.product.id !== productId);
  saveCart();
  updateCartCount();
  
  // Обновляем кнопки
  if (typeof updateAllCartButtons === 'function') {
    updateAllCartButtons();
  }
}

function updateQuantity(productId, delta) {
  const item = cart.find(item => item.product.id === productId);
  if (item) {
    item.qty += delta;
    if (item.qty <= 0) {
      removeFromCart(productId);
    } else {
      saveCart();
    }
  }
}

// Сохранение в localStorage
function saveCart() {

  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  updateCartCount();
}

// Обновление счётчика на странице
function updateCartCount() {
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartCountEls = document.querySelectorAll('#cart-count, #cart-count-header');

  cartCountEls.forEach(el => {
    if (el) {
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    }
  });
}

// Получить корзину (например, для отправки заказа)
function getCart() {
  return cart;
}

// Очистить корзину (после оформления заказа)
function clearCart() {
  console.log('[clearCart] Очистка корзины');
  cart = [];
  saveCart();
  updateCartCount();
  
  // Обновляем кнопки
  if (typeof updateAllCartButtons === 'function') {
    updateAllCartButtons();
  }
}

// Установить/получить текущий тег (для фильтрации)
function setCurrentTag(tag) {
  currentTag = tag;
}

function getCurrentTag() {
  return currentTag;
}

// === Инициализация при загрузке ===
// Обновляем все кнопки корзины при загрузке страницы
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    updateAllCartButtons();
  });
}

// Логируем, что state.js завершил выполнение
console.log("state.js: Скрипт полностью выполнен, функции экспортированы в window.");
// Проверим, доступна ли функция getCart в window
console.log("state.js: window.getCart =", typeof window.getCart, window.getCart);

// === Экспорт для использования в других файлах ===
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    addToCart,
    removeFromCart,
    updateQuantity,
    updateCartCount,
    getCart,
    clearCart,
    setCurrentTag,
    getCurrentTag
  };
} else {
  window.addToCart = addToCart;
  window.removeFromCart = removeFromCart;
  window.updateQuantity = updateQuantity;
  window.updateCartCount = updateCartCount;
  window.getCart = getCart;
  window.clearCart = clearCart;
  window.setCurrentTag = setCurrentTag;
  window.getCurrentTag = getCurrentTag;
  window.showMiniCart = showMiniCart;
  window.hideMiniCart = hideMiniCart;
  window.updateCartButton = updateCartButton;
  window.updateAllCartButtons = updateAllCartButtons;
}