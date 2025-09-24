// js/cart.js

// DOM-элементы (теперь на странице cart.html)
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalPriceElement = document.getElementById('cart-total-price');
const phoneInput = document.getElementById('phone');
const commentInput = document.getElementById('comment-input');
const sendOrderBtn = document.getElementById('send-order');
const successMessage = document.getElementById('success-message');
const consentCheckbox = document.getElementById('consent-toggle');
const clearCartBtn = document.getElementById('clear-cart-btn');
const cartBtn = document.getElementById('cart-btn'); // Для обновления счетчика

// Форматирование цены (предполагается, что функция есть в utils.js или определена глобально)
// function formatPrice(price) { ... }

// Получение корзины (предполагается, что функция есть в utils.js или определена глобально)
// function getCart() { ... }

// Обновление количества в корзине (предполагается, что функция есть в utils.js или определена глобально)
// function updateQuantity(productId, change) { ... }

// Очистка корзины (предполагается, что функция есть в utils.js или определена глобально)
// function clearCart() { ... }

// Обновление счетчика корзины (предполагается, что функция есть в utils.js или определена глобально)
// function updateCartCount() { ... }

// Рендеринг элементов корзины
function renderCartItems() {
  if (!cartItemsContainer) {
    console.error("Контейнер элементов корзины не найден.");
    return;
  }

  const cart = getCart();
  let total = 0;

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = '<div class="empty">Ваша корзина пуста</div>';
    cartTotalPriceElement.textContent = formatPrice(0);
    updateSendOrderButton(); // Обновим кнопку, так как корзина пуста
    return;
  }

  cartItemsContainer.innerHTML = '';

  cart.forEach(item => {
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <img src="${item.product.images[0]?.url?.trim() || '/assets/icons/placeholder1.webp'}" alt="${item.product.title}" />
      <div class="cart-item-info">
        <div class="cart-item-title">${item.product.title}</div>
        <div class="cart-item-price">${formatPrice(item.product.price)}</div>
        <div class="cart-quantity">
          <button class="qty-minus" data-id="${item.product.id}">−</button>
          <span>${item.qty}</span>
          <button class="qty-plus" data-id="${item.product.id}">+</button>
        </div>
      </div>
      <div class="cart-item-total">${formatPrice(item.product.price * item.qty)}</div>
    `;
    cartItemsContainer.appendChild(row);
    total += item.product.price * item.qty;
  });

  // Обработчики изменения количества
  document.querySelectorAll('.qty-minus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      updateQuantity(id, -1);
      renderCartItems(); // Перерисовываем после изменения
      updateCartCount(); // Обновляем счетчик в шапке
    });
  });

  document.querySelectorAll('.qty-plus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      updateQuantity(id, 1);
      renderCartItems(); // Перерисовываем после изменения
      updateCartCount(); // Обновляем счетчик в шапке
    });
  });

  // Обновляем итоговую цену
  cartTotalPriceElement.textContent = formatPrice(total);
  updateSendOrderButton(); // Обновим кнопку, так как цена могла измениться
}

// Обновление состояния кнопки "Оформить заказ"
function updateSendOrderButton() {
  if (!sendOrderBtn) return;

  const cart = getCart();
  const isConsentGiven = consentCheckbox ? consentCheckbox.checked : false;

  if (cart.length === 0) {
    sendOrderBtn.disabled = true;
    sendOrderBtn.title = 'Нельзя оформить заказ — корзина пуста';
  } else if (!isConsentGiven) {
    sendOrderBtn.disabled = true;
    sendOrderBtn.title = 'Необходимо дать согласие на обработку персональных данных';
  } else {
    sendOrderBtn.disabled = false;
    sendOrderBtn.title = '';
  }
}

// Обработчик отправки заказа
async function handleSendOrder() {
  if (handleSendOrder.isSending) {
    console.log('Заказ уже отправляется...');
    return;
  }

  const isConsentGiven = consentCheckbox ? consentCheckbox.checked : false;

  if (!isConsentGiven) {
    alert('Необходимо дать согласие на обработку персональных данных');
    return;
  }

  if (!phoneInput.value.trim()) {
    alert('Укажите телефон');
    return;
  }

  if (getCart().length === 0) {
    alert('Корзина пуста');
    return;
  }

  try {
    handleSendOrder.isSending = true;
    sendOrderBtn.disabled = true;
    sendOrderBtn.textContent = 'Отправка...';

    const response = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phoneInput.value,
        comment: commentInput.value || '',
        cart: getCart()
      })
    });

    const result = await response.json();
    console.log('Ответ сервера:', result);

    if (result.success) {
      clearCart();
      renderCartItems(); // Перерисовываем пустую корзину
      updateCartCount(); // Обновляем счетчик
      phoneInput.value = '';
      commentInput.value = '';
      successMessage.style.display = 'block';

      setTimeout(() => {
        successMessage.style.display = 'none';
        // Можно перенаправить на главную или другую страницу
        // window.location.href = '/';
      }, 3000);
    } else {
      throw new Error(result.error || 'Ошибка сервера');
    }
  } catch (error) {
    console.error('Ошибка отправки заказа:', error);
    let message = 'Не удалось отправить заказ. Пожалуйста, позвоните нам.';
    if (error.message && error.message.includes('Заказ уже обрабатывается')) {
      clearCart();
      renderCartItems(); // Перерисовываем пустую корзину
      updateCartCount(); // Обновляем счетчик
      phoneInput.value = '';
      commentInput.value = '';
      message = 'Заказ уже обрабатывается.';
    }
    alert(message);
  } finally {
    handleSendOrder.isSending = false;
    sendOrderBtn.disabled = false;
    sendOrderBtn.textContent = 'Оформить заказ';
  }
}

// Функция для очистки корзины
function handleClearCart() {
    if (confirm("Вы уверены, что хотите очистить корзину?")) {
        clearCart();
        renderCartItems(); // Перерисовываем пустую корзину
        updateCartCount(); // Обновляем счетчик
    }
}

// Санитизация ввода телефона
function sanitizePhoneInput(event) {
  event.target.value = event.target.value.replace(/[^0-9+]/g, '');
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  console.log("Страница корзины загружена.");

  // Применение маски к полю телефона
  if (typeof $ !== 'undefined' && $.fn.mask && phoneInput) {
    $(phoneInput).unmask(); // Убираем старую маску
    $(phoneInput).mask("+7 (999) 999-99-99", { placeholder: "+7 (___) ___-__-__" });
  } else {
    console.warn("jQuery, maskedinput или элемент #phone не найдены. Маска не применена.");
    if (phoneInput) {
       phoneInput.removeEventListener('input', sanitizePhoneInput); // Убираем старый обработчик
       phoneInput.addEventListener('input', sanitizePhoneInput);
    }
  }

  // Рендерим содержимое корзины
  renderCartItems();

  // Обновляем счетчик корзины в шапке
  updateCartCount();

  // Настройка обработчиков событий
  if (sendOrderBtn) {
    sendOrderBtn.addEventListener('click', handleSendOrder);
  }

  if (consentCheckbox) {
    consentCheckbox.addEventListener('change', updateSendOrderButton);
  }

  if (clearCartBtn) {
    clearCartBtn.addEventListener('click', handleClearCart);
  }

  // Обновляем кнопку "Оформить заказ" при изменении содержимого корзины или согласия
  // (updateSendOrderButton вызывается в renderCartItems и при изменении чекбокса)
});

// Экспорт (если используется модульная система, хотя в браузере редко)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderCartItems, updateSendOrderButton, handleSendOrder };
} else {
  // window.renderCartItems = renderCartItems; // Не нужно, если функция используется только в этом файле
}