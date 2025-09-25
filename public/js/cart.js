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

document.addEventListener('DOMContentLoaded', function () {
    console.log("Страница корзины загружена.");
    
    // Проверяем, доступна ли функция getCart из state.js
    if (typeof window.getCart === 'function') {
        console.log("Функция getCart из state.js найдена.");
        renderCartItems(); // Вызываем рендер
        setupEventListeners(); // И настройку обработчиков
    } else {
        console.warn("Функция getCart из state.js не найдена. Проверяем локальные функции или ждём...");
        // Попробуем использовать резервные функции, если они есть в cart.js
        if (typeof getCartLocal === 'function') {
            console.log("Используем резервную функцию getCartLocal.");
            renderCartItemsLocal(); // Предполагается, что renderCartItemsLocal использует getCartLocal
            setupEventListenersLocal(); // Предполагается, что setupEventListenersLocal настроена на локальные функции
        } else {
            // Ждём появления getCart в window (например, если state.js загрузился с задержкой)
            console.log("Ожидаем появления функции getCart в window...");
            const checkForGetCart = setInterval(() => {
                if (typeof window.getCart === 'function') {
                    console.log("Функция getCart теперь доступна.");
                    clearInterval(checkForGetCart); // Останавливаем проверку
                    renderCartItems(); // Вызываем рендер
                    setupEventListeners(); // И настройку обработчиков
                }
            }, 100); // Проверяем каждые 100мс

            // На всякий случай, останавливаем проверку через 5 секунд, если функция так и не появилась
            setTimeout(() => {
                clearInterval(checkForGetCart);
                if (typeof window.getCart !== 'function') {
                    console.error("Функция getCart не появилась в window за 5 секунд. Корзина не будет отображена.");
                    // Показать сообщение пользователю
                    const container = document.querySelector('.cart-container'); // Или другой контейнер
                    if (container) {
                        container.innerHTML = '<div class="error">Ошибка загрузки корзины. Пожалуйста, обновите страницу.</div>';
                    }
                }
            }, 5000);
        }
    }
});


// --- Функция рендеринга корзины ---
function renderCartItems() {
    const cartItemsContainer = document.getElementById('cart-items');
    if (!cartItemsContainer) {
        console.error("Контейнер элементов корзины не найден.");
        return;
    }

    // Используем getCart из state.js
    const cart = window.getCart(); // <- Здесь была ошибка
    console.log("Текущая корзина (из state.js):", cart);

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<div class="empty">Ваша корзина пуста</div>';
        // Обновляем кнопку "Оформить заказ"
        updateSendOrderButton();
        return;
    }

    cartItemsContainer.innerHTML = ''; // Очищаем перед рендером

    let total = 0;
    cart.forEach(item => {
        const row = document.createElement('div');
        row.className = 'cart-item';
        // Упрощённый рендеринг, адаптируйте под вашу разметку
        row.innerHTML = `
            <img src="${item.product.images && item.product.images[0] ? item.product.images[0].url.trim() : '/assets/placeholder.png'}" alt="${item.product.title}" />
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
            <button class="remove-item" data-id="${item.product.id}">×</button>
        `;
        cartItemsContainer.appendChild(row);
        total += item.product.price * item.qty;
    });

    // Добавляем итоговую строку
    const totalRow = document.createElement('div');
    totalRow.className = 'total-row';
    totalRow.innerHTML = `<span>Итого:</span><span>${formatPrice(total)}</span>`;
    cartItemsContainer.appendChild(totalRow);

    // Привязываем обработчики к кнопкам +/- и удаления
    document.querySelectorAll('.qty-minus').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id, 10);
            // Используем updateQuantity из state.js
            window.updateQuantity(id, -1);
            renderCartItems(); // Перерисовываем
            // Обновляем счётчик в хедере
            if (typeof window.updateCartCount === 'function') {
                window.updateCartCount();
            }
            // Обновляем кнопку "Оформить заказ"
            updateSendOrderButton();
        });
    });

    document.querySelectorAll('.qty-plus').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id, 10);
            // Используем updateQuantity из state.js
            window.updateQuantity(id, 1);
            renderCartItems(); // Перерисовываем
            // Обновляем счётчик в хедере
            if (typeof window.updateCartCount === 'function') {
                window.updateCartCount();
            }
            // Обновляем кнопку "Оформить заказ"
            updateSendOrderButton();
        });
    });

    document.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id, 10);
            // Используем removeFromCart из state.js
            window.removeFromCart(id);
            renderCartItems(); // Перерисовываем
            // Обновляем счётчик в хедере
            if (typeof window.updateCartCount === 'function') {
                window.updateCartCount();
            }
            // Обновляем кнопку "Оформить заказ"
            updateSendOrderButton();
        });
    });

    // Обновляем кнопку "Оформить заказ"
    updateSendOrderButton();
}

// --- Функция обновления состояния кнопки "Оформить заказ" ---
function updateSendOrderButton() {
  const sendOrderBtn = document.getElementById('send-order');
  if (!sendOrderBtn) return;

  // Используем getCart из state.js
  const cart = window.getCart();
  const consentCheckbox = document.getElementById('consent-toggle');
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

// --- Функция форматирования цены ---
function formatPrice(price) {
    if (typeof Intl !== 'undefined' && Intl.NumberFormat) {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(price);
    }
    // Резервный вариант
    return `${price} ₽`;
}

// --- Функция настройки обработчиков событий для корзины ---
function setupEventListeners() {
    // Обработчик отправки заказа
    const sendOrderBtn = document.getElementById('send-order');
    if (sendOrderBtn) {
        let isSending = false;
        sendOrderBtn.addEventListener('click', async () => {
            if (isSending) {
                console.log('Заказ уже отправляется...');
                return;
            }
            // Проверки
            const consentCheckbox = document.getElementById('consent-toggle');
            const isConsentGiven = consentCheckbox ? consentCheckbox.checked : false;
            const phoneInput = document.getElementById('phone');

            if (!isConsentGiven) {
                alert('Необходимо дать согласие на обработку персональных данных');
                return;
            }
            if (!phoneInput || !phoneInput.value.trim()) {
                alert('Укажите телефон');
                return;
            }
            // Используем getCart из state.js
            if (window.getCart().length === 0) {
                alert('Корзина пуста');
                return;
            }

            try {
                isSending = true;
                sendOrderBtn.disabled = true;
                sendOrderBtn.textContent = 'Отправка...';

                const response = await fetch('/api/order', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    phone: phoneInput.value,
                    comment: document.getElementById('comment-input')?.value || '',
                    // Используем getCart из state.js
                    cart: window.getCart()
                  })
                });
                const result = await response.json();
                console.log('Ответ сервера:', result);

                if (result.success) {
                  // Используем clearCart из state.js
                  window.clearCart();
                  // Обновляем счётчик в хедере
                  if (typeof window.updateCartCount === 'function') {
                    window.updateCartCount();
                  }
                  // Очищаем поля
                  if (phoneInput) phoneInput.value = '';
                  const commentInput = document.getElementById('comment-input');
                  if (commentInput) commentInput.value = '';

                  const successMessage = document.getElementById('success-message');
                  if (successMessage) {
                      successMessage.style.display = 'block';
                      // Перерисовываем корзину (теперь пустую)
                      renderCartItems();
                  }

                  setTimeout(() => {
                    if (successMessage) successMessage.style.display = 'none';
                    sendOrderBtn.disabled = false;
                    sendOrderBtn.textContent = 'Оформить заказ';
                    isSending = false;
                  }, 3000);
                } else {
                  throw new Error(result.error || 'Ошибка сервера');
                }
            } catch (error) {
                console.error('Ошибка отправки заказа:', error);
                if (error.message && error.message.includes('Заказ уже обрабатывается')) {
                  // Используем clearCart из state.js
                  window.clearCart();
                  // Обновляем счётчик в хедере
                  if (typeof window.updateCartCount === 'function') {
                    window.updateCartCount();
                  }
                  // Очищаем поля
                  if (phoneInput) phoneInput.value = '';
                  const commentInput = document.getElementById('comment-input');
                  if (commentInput) commentInput.value = '';

                  const successMessage = document.getElementById('success-message');
                  if (successMessage) {
                      successMessage.style.display = 'block';
                      // Перерисовываем корзину (теперь пустую)
                      renderCartItems();
                  }

                  setTimeout(() => {
                    if (successMessage) successMessage.style.display = 'none';
                    sendOrderBtn.disabled = false;
                    sendOrderBtn.textContent = 'Оформить заказ';
                    isSending = false;
                  }, 3000);
                } else {
                  alert('Не удалось отправить заказ. Пожалуйста, позвоните нам.');
                  sendOrderBtn.disabled = false;
                  sendOrderBtn.textContent = 'Оформить заказ';
                  isSending = false;
                }
            }
        });
    }

    // Обработчик изменения чекбокса согласия
    const consentCheckbox = document.getElementById('consent-toggle');
    if (consentCheckbox) {
        consentCheckbox.addEventListener('change', updateSendOrderButton);
    }
}

// Экспорт (если используется модульная система, хотя в браузере редко)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderCartItems, updateSendOrderButton, handleSendOrder };
} else {
  // window.renderCartItems = renderCartItems; // Не нужно, если функция используется только в этом файле
}