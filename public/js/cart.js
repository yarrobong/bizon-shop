// js/cart.js

// DOM-элементы (теперь на странице cart.html)
// Получаем элементы только после загрузки DOM
let cartItemsContainer, cartTotalPriceElement, phoneInput, commentInput, sendOrderBtn, successMessage, consentCheckbox, clearCartBtn;

function initDOMElements() {
  cartItemsContainer = document.getElementById('cart-items');
  cartTotalPriceElement = document.getElementById('cart-total-price');
  phoneInput = document.getElementById('phone');
  commentInput = document.getElementById('comment-input');
  sendOrderBtn = document.getElementById('send-order');
  successMessage = document.getElementById('success-message');
  consentCheckbox = document.getElementById('consent-toggle');
  clearCartBtn = document.getElementById('clear-cart-btn');
}



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
    if (cartTotalPriceElement) {
    cartTotalPriceElement.textContent = formatPrice(0);
    }
    // Скрываем кнопку очистки корзины
    if (clearCartBtn) {
      clearCartBtn.style.display = 'none';
    }
    updateSendOrderButton(); // Обновим кнопку, так как корзина пуста
    return;
  }

  // Показываем кнопку очистки корзины, если есть товары
  if (clearCartBtn) {
    clearCartBtn.style.display = 'flex';
  }

  cartItemsContainer.innerHTML = '';

  cart.forEach(item => {
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.setAttribute('data-product-id', item.product.id);
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
      <div class="cart-item-right">
        <div class="cart-item-total">${formatPrice(item.product.price * item.qty)}</div>
        <button class="cart-item-remove" data-id="${item.product.id}" aria-label="Удалить товар" title="Удалить из корзины">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
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

  // Обработчики удаления товаров
  document.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      if (confirm('Удалить товар из корзины?')) {
        if (typeof window.removeFromCart === 'function') {
          window.removeFromCart(id);
        } else if (typeof removeFromCart === 'function') {
          removeFromCart(id);
        }
        renderCartItems(); // Перерисовываем после удаления
        updateCartCount(); // Обновляем счетчик в шапке
      }
    });
  });

  // Обновляем итоговую цену
  if (cartTotalPriceElement) {
  cartTotalPriceElement.textContent = formatPrice(total);
  }
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

  if (!sendOrderBtn || !phoneInput || !consentCheckbox) {
    console.error('Необходимые элементы не найдены');
    return;
  }

  // Валидация формы
  let isValid = true;
  
  // Очищаем предыдущие ошибки
  if (typeof clearFieldError === 'function') {
    clearFieldError(phoneInput);
  }

  // Проверка согласия
  const isConsentGiven = consentCheckbox.checked;
  if (!isConsentGiven) {
    if (typeof showNotification === 'function') {
      showNotification('Необходимо дать согласие на обработку персональных данных', 'warning');
    } else {
      alert('Необходимо дать согласие на обработку персональных данных');
    }
    consentCheckbox.focus();
    return;
  }

  // Валидация телефона
  if (typeof validatePhone === 'function') {
    const phoneValidation = validatePhone(phoneInput.value);
    if (!phoneValidation.valid) {
      if (typeof showFieldError === 'function') {
        showFieldError(phoneInput, phoneValidation.message);
      } else {
        alert(phoneValidation.message);
      }
      isValid = false;
    }
  } else {
    // Fallback валидация
    if (!phoneInput.value.trim()) {
      if (typeof showFieldError === 'function') {
        showFieldError(phoneInput, 'Укажите номер телефона');
      } else {
        alert('Укажите телефон');
      }
      isValid = false;
    } else {
      const phoneDigits = phoneInput.value.replace(/\D/g, '');
      if (phoneDigits.length < 10) {
        if (typeof showFieldError === 'function') {
          showFieldError(phoneInput, 'Номер телефона должен содержать минимум 10 цифр');
        } else {
          alert('Введите корректный номер телефона');
        }
        isValid = false;
      }
    }
  }

  // Проверка корзины
  if (getCart().length === 0) {
    if (typeof showNotification === 'function') {
      showNotification('Корзина пуста. Добавьте товары перед оформлением заказа', 'warning');
    } else {
      alert('Корзина пуста');
    }
    isValid = false;
  }

  if (!isValid) {
    return;
  }

  const phone = phoneInput.value;

  try {
    handleSendOrder.isSending = true;
    sendOrderBtn.disabled = true;
    sendOrderBtn.textContent = 'Отправка...';

    // Получаем CSRF токен
    const csrfToken = typeof getCsrfToken === 'function' ? await getCsrfToken() : null;
    if (!csrfToken) {
      const errorMsg = 'Не удалось получить CSRF токен. Пожалуйста, обновите страницу.';
      if (typeof showNotification === 'function') {
        showNotification(errorMsg, 'error');
      } else {
        alert(errorMsg);
      }
      handleSendOrder.isSending = false;
      if (sendOrderBtn) {
        sendOrderBtn.disabled = false;
        sendOrderBtn.textContent = 'Оформить заказ';
      }
      return;
    }

    let response;
    try {
      response = await fetch('/api/order', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          phone: phone,
          comment: commentInput ? commentInput.value || '' : '',
          cart: getCart(),
          _csrf: csrfToken // Также в теле для совместимости
        })
      });
    } catch (networkError) {
      // Обработка сетевых ошибок
      const errorMessage = typeof handleFetchError === 'function' 
        ? handleFetchError(networkError)
        : 'Ошибка подключения к серверу. Проверьте интернет-соединение.';
      
      if (typeof showNotification === 'function') {
        showNotification(errorMessage, 'error');
      } else {
        alert(errorMessage);
      }
      throw networkError;
    }

    // Проверяем статус ответа перед парсингом JSON
    if (response.status === 429) {
      const errorData = typeof safeJsonParse === 'function' 
        ? await safeJsonParse(response)
        : await response.json().catch(() => ({ retryAfter: 2 }));
      const retryAfter = errorData.retryAfter || 2;
      const message = `Слишком много заказов. Пожалуйста, подождите ${retryAfter} ${retryAfter === 1 ? 'минуту' : 'минуты'} перед следующей попыткой.`;
      
      if (typeof showNotification === 'function') {
        showNotification(message, 'warning', 6000);
      } else {
        alert(message);
      }
      
      handleSendOrder.isSending = false;
      if (sendOrderBtn) {
        sendOrderBtn.disabled = false;
        sendOrderBtn.textContent = 'Оформить заказ';
      }
      return;
    }

    // Безопасный парсинг JSON
    const result = typeof safeJsonParse === 'function' 
      ? await safeJsonParse(response)
      : await response.json();
    console.log('Ответ сервера:', result);

    if (result.success) {
/*Calltouch requests*/
try {
        var request = window.ActiveXObject ? new ActiveXObject("Microsoft.XMLHTTP") : new XMLHttpRequest();
        var ct_data = {};
        ct_data.subject = 'Корзина с ' + location.hostname; ct_data.fio = ''; ct_data.phoneNumber = phoneInput.value; ct_data.email = ''; ct_data.comment = commentInput ? commentInput.value || '' : ''; ct_data.sessionId = window.call_value; 
        ct_data.requestUrl = location.href;
        var post_data = Object.keys(ct_data).reduce(function(a,k){if(!!ct_data[k]){a.push(k+'='+encodeURIComponent(ct_data[k]));}return a},[]).join('&');
        var CT_URL = 'https://api.calltouch.ru/calls-service/RestAPI/requests/78900/register/';
        console.log(ct_data);
            request.open("POST", CT_URL, true); request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
            request.send(post_data); сt_сheck = false; ct_data = {};
} catch (error) {
  console.error('[Calltouch] Ошибка отправки данных:', error);
  // Не показываем ошибку пользователю, так как это не критично
}
/*Calltouch requests*/
      
      // Отправка цели в Яндекс Метрику
      (function() {
        function sendGoal() {
          try {
            if (typeof ym === 'function' && typeof ym.a === 'undefined') {
              ym(104163309, 'reachGoal', 'cart_order_submit');
              return true;
            }
            if (typeof window.ym === 'function') {
              if (typeof window.ym.a === 'undefined') {
                window.ym(104163309, 'reachGoal', 'cart_order_submit');
                return true;
              } else if (Array.isArray(window.ym.a)) {
                window.ym.a.push([104163309, 'reachGoal', 'cart_order_submit']);
                            try {
                              window.ym(104163309, 'reachGoal', 'cart_order_submit');
                            } catch (e) {
                              console.warn('[Yandex Metrika] Не удалось отправить цель:', e);
                            }
                            return true;
              }
            }
            window.ym = window.ym || [];
            if (Array.isArray(window.ym)) {
              window.ym.push(function() {
                ym(104163309, 'reachGoal', 'cart_order_submit');
              });
              return true;
            }
            return false;
          } catch (e) {
            console.error('[Yandex Metrika] Ошибка отправки цели:', e);
            return false;
          }
        }
        sendGoal();
        setTimeout(function() {
          try {
            if (typeof ym === 'function' && typeof ym.a === 'undefined') {
              ym(104163309, 'reachGoal', 'cart_order_submit');
            }
          } catch (e) {
            console.warn('[Yandex Metrika] Не удалось отправить цель (отложенная):', e);
          }
        }, 1000);
      })();
      
      clearCart();
      renderCartItems(); // Перерисовываем пустую корзину
      updateCartCount(); // Обновляем счетчик
      if (phoneInput) phoneInput.value = '';
      if (commentInput) commentInput.value = '';
      if (successMessage) {
      successMessage.style.display = 'block';
      setTimeout(() => {
        successMessage.style.display = 'none';
        // Можно перенаправить на главную или другую страницу
        // window.location.href = '/';
      }, 3000);
      }
    } else {
      throw new Error(result.error || 'Ошибка сервера');
    }
  } catch (error) {
    console.error('Ошибка отправки заказа:', error);
    let message = 'Не удалось отправить заказ. Пожалуйста, позвоните нам.';
    
    // Обработка различных типов ошибок
    if (error.message && error.message.includes('Заказ уже обрабатывается')) {
      clearCart();
      renderCartItems(); // Перерисовываем пустую корзину
      updateCartCount(); // Обновляем счетчик
      if (phoneInput) phoneInput.value = '';
      if (commentInput) commentInput.value = '';
      message = 'Заказ уже обрабатывается.';
    } else if (error instanceof TypeError && error.message.includes('fetch')) {
      // Сетевая ошибка
      message = typeof handleFetchError === 'function' 
        ? handleFetchError(error)
        : 'Ошибка подключения к серверу. Проверьте интернет-соединение.';
    } else if (error.message) {
      message = error.message;
    }
    
    // Показываем уведомление пользователю
    if (typeof showNotification === 'function') {
      showNotification(message, 'error');
    } else {
      alert(message);
    }
  } finally {
    handleSendOrder.isSending = false;
    if (sendOrderBtn) {
    sendOrderBtn.disabled = false;
    sendOrderBtn.textContent = 'Оформить заказ';
    }
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
    
    // Инициализируем DOM элементы
    initDOMElements();
    
    // Инициализация валидации в реальном времени для телефона
    if (phoneInput && typeof initRealtimeValidation === 'function') {
        initRealtimeValidation(phoneInput, {
            type: 'phone',
            required: true,
            label: 'Номер телефона'
        });
    }
    
    // Инициализация маски телефона
    if (typeof $ !== 'undefined' && $.fn.mask) {
        $(document).ready(function(){
            $(".phone_mask").mask("+7 (999) 999-99-99");
        });
    }
    
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
                    initDOMElements(); // Инициализируем DOM элементы перед использованием
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


// Функция renderCartItems уже определена выше (строка 16), дублирование удалено

// Функция updateSendOrderButton уже определена выше (строка 79), дублирование удалено

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
  // Обработчик очистки корзины
  if (clearCartBtn) {
    clearCartBtn.addEventListener('click', () => {
      if (confirm('Вы уверены, что хотите очистить корзину?')) {
        if (typeof window.clearCart === 'function') {
          window.clearCart();
        } else if (typeof clearCart === 'function') {
          clearCart();
        }
        renderCartItems(); // Перерисовываем корзину
        updateCartCount(); // Обновляем счетчик
      }
    });
  }

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

            // Валидация формы
            let isValid = true;
            
            // Очищаем предыдущие ошибки
            if (phoneInput && typeof clearFieldError === 'function') {
                clearFieldError(phoneInput);
            }

            if (!isConsentGiven) {
                if (typeof showNotification === 'function') {
                    showNotification('Необходимо дать согласие на обработку персональных данных', 'warning');
                } else {
                    alert('Необходимо дать согласие на обработку персональных данных');
                }
                if (consentCheckbox) consentCheckbox.focus();
                return;
            }
            
            if (!phoneInput) {
                if (typeof showNotification === 'function') {
                    showNotification('Поле телефона не найдено', 'error');
                } else {
                    alert('Ошибка: поле телефона не найдено');
                }
                return;
            }
            
            // Валидация телефона
            if (typeof validatePhone === 'function') {
                const phoneValidation = validatePhone(phoneInput.value);
                if (!phoneValidation.valid) {
                    if (typeof showFieldError === 'function') {
                        showFieldError(phoneInput, phoneValidation.message);
                    } else {
                        alert(phoneValidation.message);
                    }
                    isValid = false;
                }
            } else {
                // Fallback валидация
                if (!phoneInput.value.trim()) {
                    if (typeof showFieldError === 'function') {
                        showFieldError(phoneInput, 'Укажите номер телефона');
                    } else {
                        alert('Укажите телефон');
                    }
                    isValid = false;
                } else {
                    const phoneDigits = phoneInput.value.replace(/\D/g, '');
                    if (phoneDigits.length < 10) {
                        if (typeof showFieldError === 'function') {
                            showFieldError(phoneInput, 'Номер телефона должен содержать минимум 10 цифр');
                        } else {
                            alert('Введите корректный номер телефона');
                        }
                        isValid = false;
                    }
                }
            }
            
            // Проверка корзины
            if (window.getCart().length === 0) {
                if (typeof showNotification === 'function') {
                    showNotification('Корзина пуста. Добавьте товары перед оформлением заказа', 'warning');
                } else {
                    alert('Корзина пуста');
                }
                isValid = false;
            }

            if (!isValid) {
                return;
            }

            const phone = phoneInput.value;

            try {
                isSending = true;
                sendOrderBtn.disabled = true;
                sendOrderBtn.textContent = 'Отправка...';

                let response;
                try {
                  // Получаем CSRF токен
                  const csrfToken = typeof getCsrfToken === 'function' ? await getCsrfToken() : null;
                  if (!csrfToken) {
                    throw new Error('Не удалось получить CSRF токен');
                  }
                  
                  response = await fetch('/api/order', {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json',
                      'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({
                      phone: phone,
                      comment: document.getElementById('comment-input')?.value || '',
                      // Используем getCart из state.js
                      cart: window.getCart(),
                      _csrf: csrfToken
                    })
                  });
                } catch (networkError) {
                  // Обработка сетевых ошибок
                  const errorMessage = typeof handleFetchError === 'function' 
                    ? handleFetchError(networkError)
                    : 'Ошибка подключения к серверу. Проверьте интернет-соединение.';
                  
                  if (typeof showNotification === 'function') {
                    showNotification(errorMessage, 'error');
                  } else {
                    alert(errorMessage);
                  }
                  sendOrderBtn.disabled = false;
                  sendOrderBtn.textContent = 'Оформить заказ';
                  isSending = false;
                  return;
                }
                
                // Проверяем статус ответа перед парсингом JSON
                if (response.status === 429) {
                  const errorData = typeof safeJsonParse === 'function' 
                    ? await safeJsonParse(response)
                    : await response.json().catch(() => ({ retryAfter: 2 }));
                  const retryAfter = errorData.retryAfter || 2;
                  const message = `Слишком много заказов. Пожалуйста, подождите ${retryAfter} ${retryAfter === 1 ? 'минуту' : 'минуты'} перед следующей попыткой.`;
                  
                  if (typeof showNotification === 'function') {
                    showNotification(message, 'warning', 6000);
                  } else {
                    alert(message);
                  }
                  
                  sendOrderBtn.disabled = false;
                  sendOrderBtn.textContent = 'Оформить заказ';
                  isSending = false;
                  return;
                }
                
                // Безопасный парсинг JSON
                const result = typeof safeJsonParse === 'function' 
                  ? await safeJsonParse(response)
                  : await response.json();
                console.log('Ответ сервера:', result);

                if (result.success) {
/*Calltouch requests*/
try {
                    var request = window.ActiveXObject ? new ActiveXObject("Microsoft.XMLHTTP") : new XMLHttpRequest();
                    var ct_data = {};
                    ct_data.subject = 'Корзина с ' + location.hostname; ct_data.fio = ''; ct_data.phoneNumber = phoneInput.value; ct_data.email = ''; ct_data.comment = document.getElementById('comment-input')?.value || ''; ct_data.sessionId = window.call_value; 
                    ct_data.requestUrl = location.href;
                    var post_data = Object.keys(ct_data).reduce(function(a,k){if(!!ct_data[k]){a.push(k+'='+encodeURIComponent(ct_data[k]));}return a},[]).join('&');
                    var CT_URL = 'https://api.calltouch.ru/calls-service/RestAPI/requests/78900/register/';
                    console.log(ct_data);
                    request.open("POST", CT_URL, true); request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                    request.send(post_data); сt_сheck = false; ct_data = {};
} catch (error) {
  console.error('[Calltouch] Ошибка отправки данных:', error);
  // Не показываем ошибку пользователю, так как это не критично
}
/*Calltouch requests*/
                  // Отправка цели в Яндекс Метрику
                  (function() {
                    function sendGoal() {
                      try {
                        if (typeof ym === 'function' && typeof ym.a === 'undefined') {
                          ym(104163309, 'reachGoal', 'cart_order_submit');
                          return true;
                        }
                        if (typeof window.ym === 'function') {
                          if (typeof window.ym.a === 'undefined') {
                            window.ym(104163309, 'reachGoal', 'cart_order_submit');
                            return true;
                          } else if (Array.isArray(window.ym.a)) {
                            window.ym.a.push([104163309, 'reachGoal', 'cart_order_submit']);
                            try {
                              window.ym(104163309, 'reachGoal', 'cart_order_submit');
                            } catch (e) {
                              console.warn('[Yandex Metrika] Не удалось отправить цель:', e);
                            }
                            return true;
                          }
                        }
                        window.ym = window.ym || [];
                        if (Array.isArray(window.ym)) {
                          window.ym.push(function() {
                            ym(104163309, 'reachGoal', 'cart_order_submit');
                          });
                          return true;
                        }
                        return false;
                      } catch (e) {
                        console.error('[Yandex Metrika] Ошибка отправки цели:', e);
                        return false;
                      }
                    }
                    sendGoal();
                    setTimeout(function() {
                      try {
                        if (typeof ym === 'function' && typeof ym.a === 'undefined') {
                          ym(104163309, 'reachGoal', 'cart_order_submit');
                        }
                      } catch (e) {
                        console.warn('[Yandex Metrika] Не удалось отправить цель (отложенная):', e);
                      }
                    }, 1000);
                  })();
                  
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
                let message = 'Не удалось отправить заказ. Пожалуйста, позвоните нам.';
                
                // Обработка различных типов ошибок
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
                  message = 'Заказ уже обрабатывается.';
                } else if (error instanceof TypeError && error.message.includes('fetch')) {
                  // Сетевая ошибка
                  message = typeof handleFetchError === 'function' 
                    ? handleFetchError(error)
                    : 'Ошибка подключения к серверу. Проверьте интернет-соединение.';
                } else if (error.message) {
                  message = error.message;
                }
                
                // Показываем уведомление пользователю
                if (typeof showNotification === 'function') {
                  showNotification(message, 'error');
                } else {
                  alert(message);
                }
                
                sendOrderBtn.disabled = false;
                sendOrderBtn.textContent = 'Оформить заказ';
                isSending = false;
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