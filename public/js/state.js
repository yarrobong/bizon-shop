// state.js — Управление состоянием корзины с localStorage

// Ключ для хранения в localStorage
const CART_STORAGE_KEY = 'bizon-cart';

// Инициализация корзины: загружаем из localStorage или создаём пустую
let cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];

// Текущий фильтр (например, по тегу)
let currentTag = 'все';

// === Функции корзины ===

function addToCart(product) {
  const existing = cart.find(item => item.product.id === product.id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ product, qty: 1 });
  }
  saveCart(); // Сохраняем в localStorage
  updateCartCount();
  closeModals();
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.product.id !== productId);
  saveCart();
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
  cart = [];
  saveCart();
}

// Установить/получить текущий тег (для фильтрации)
function setCurrentTag(tag) {
  currentTag = tag;
}

function getCurrentTag() {
  return currentTag;
}

// === Инициализация при загрузке ===
// Вызываем при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  updateCartCount(); // Обновляем счётчик при загрузке
});

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
}