// ui.js
// DOM-элементы
const productsContainer = document.getElementById('products');
const searchInput = document.getElementById('search-input');
const categoryButtons = document.querySelectorAll('.tag-btn');
const cartBtn = document.getElementById('cart-btn');
const cartModal = document.getElementById('cart-modal');
const productModal = document.getElementById('product-modal');
const cartItems = document.getElementById('cart-items');
const phoneInput = document.getElementById('phone');
const commentInput = document.getElementById('comment-input');
const sendOrderBtn = document.getElementById('send-order');
const successMessage = document.getElementById('success-message');
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

function getScrollbarWidth() {
  const outer = document.createElement('div');
  outer.style.visibility = 'hidden';
  outer.style.overflow = 'scroll';
  outer.style.msOverflowStyle = 'scrollbar';
  document.body.appendChild(outer);

  const inner = document.createElement('div');
  outer.appendChild(inner);

  const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;

  outer.parentNode.removeChild(outer);

  return scrollbarWidth;
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

// Получение корзины из localStorage
function getCart() {
  const cart = localStorage.getItem('cart');
  return cart ? JSON.parse(cart) : [];
}

// Добавление в корзину
// Исправлено: принимает конкретный товар/вариант, а не window.currentProduct
function addToCart(productToAdd) {
  if (!productToAdd || productToAdd.id === undefined) {
    console.error('addToCart: Не передан корректный товар для добавления');
    return;
  }
  const cart = getCart();
  const existingItem = cart.find(item => item.product.id === productToAdd.id);

  if (existingItem) {
    existingItem.qty += 1;
  } else {
    cart.push({ product: productToAdd, qty: 1 });
  }

  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount(); // Обновляем счетчик в шапке
  showMiniCartNotification(productToAdd); // Показываем уведомление
}

// Показ уведомления о добавлении в корзину
function showMiniCartNotification(product) {
  // Создаем элемент уведомления
  const notification = document.createElement('div');
  notification.className = 'mini-cart-notification';
  notification.innerHTML = `
    <div class="notification-content">
      <img src="${product.images && product.images[0] ? product.images[0].url : '/assets/placeholder.png'}" alt="${product.title}" class="notification-image">
      <div class="notification-text">
        <div class="notification-title">${product.title}</div>
        <div class="notification-message">добавлен в корзину</div>
      </div>
    </div>
  `;

  // Стили для уведомления
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 15px;
    border-radius: 5px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 10000;
    display: flex;
    align-items: center;
    animation: fadeInOut 3s forwards;
  `;

  // Стили для изображения уведомления
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeInOut {
      0% { opacity: 0; transform: translateY(-20px); }
      10% { opacity: 1; transform: translateY(0); }
      90% { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(-20px); }
    }
    .notification-content {
      display: flex;
      align-items: center;
    }
    .notification-image {
      width: 50px;
      height: 50px;
      object-fit: cover;
      margin-right: 10px;
      border-radius: 4px;
    }
    .notification-text {
      display: flex;
      flex-direction: column;
    }
    .notification-title {
      font-weight: bold;
      font-size: 0.9em;
    }
    .notification-message {
      font-size: 0.8em;
      opacity: 0.9;
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(notification);

  // Удаляем уведомление после анимации
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
    if (style.parentNode) {
      style.remove();
    }
  }, 3000);
}


// Обновление количества в корзине
function updateQuantity(productId, change) {
  const cart = getCart();
  const item = cart.find(item => item.product.id === productId);

  if (item) {
    item.qty += change;
    if (item.qty <= 0) {
      const index = cart.indexOf(item);
      cart.splice(index, 1);
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    // Перерисовываем модальное окно корзины после изменения количества
    openCartModal();
  }
}

// Очистка корзины
function clearCart() {
  localStorage.removeItem('cart');
  updateCartCount();
}

// Обновление счетчика корзины
function updateCartCount() {
  const cart = getCart();
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartCount = document.getElementById('cart-count');
  if (cartCount) {
    cartCount.textContent = count;
    cartCount.style.display = count > 0 ? 'block' : 'none';
  }
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
        throw new Error(`HTTP error! status: ${res.status}`);
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
      const categoryMatch = currentCategory === 'все' || (p.category && p.category === currentCategory);
      const searchMatch = query === '' ||
        (p.title && p.title.toLowerCase().includes(query)) ||
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
          <h3 class="product-title">${product.title || 'Без названия'}</h3>
          <div class="product-image">
            <img src="${product.images && product.images[0]?.url?.trim() || '/assets/placeholder.png'}" alt="${product.title || 'Изображение товара'}" />
            ${product.tag ? `<div class="product-badge" data-tag="${product.tag.toLowerCase()}">${product.tag}</div>` : ''}
          </div>
          <div class="product-footer">
            <div class="product-price">${formatPrice(product.price || 0)}</div>
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
        if (event.target.classList.contains('btn-cart') || event.target.classList.contains('btn-details')) return;

        const buttonDetails = card.querySelector('.btn-details');
        if (!buttonDetails) return;

        const productId = parseInt(buttonDetails.dataset.id);
        const product = PRODUCTS.find(p => p.id === productId);

        if (product) {
          openProductModal(product);
        }
      });
    });

    // Обработчики для кнопок "Подробнее"
    document.querySelectorAll('.btn-details').forEach(button => {
      button.addEventListener('click', (event) => {
        event.stopPropagation(); // Предотвращаем всплытие клика
        const productId = parseInt(event.target.dataset.id);
        const product = PRODUCTS.find(p => p.id === productId);
        if (product) {
          openProductModal(product);
        }
      });
    });

    // Обработчики для кнопок "В корзину"
    document.querySelectorAll('.btn-cart').forEach(button => {
      button.addEventListener('click', (event) => {
        event.stopPropagation(); // Предотвращаем всплытие клика
        const productId = parseInt(event.target.dataset.id);
        const product = PRODUCTS.find(p => p.id === productId);
        if (product) {
          addToCart(product);
          // updateCartCount(); // Вызывается внутри addToCart
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

/// Открытие модального окна товара
function openProductModal(product) {
  // Сохраняем текущую позицию прокрутки
  const scrollY = window.scrollY || window.pageYOffset;
  document.body.setAttribute('data-scroll-position', scrollY);
  // Блокируем скролл, но сохраняем позицию
  document.body.classList.add('modal-open');
  document.body.style.setProperty('--scrollbar-width', getScrollbarWidth() + 'px');
  document.body.style.top = `-${scrollY}px`;

  // --- Основная логика обновления модального окна ---
  const titleElement = document.getElementById('product-title');
  const descriptionElement = document.getElementById('product-description');
  const priceElement = document.getElementById('product-price');
  const mainImageElement = document.getElementById('product-main-image');
  const thumbnailsContainer = document.getElementById('thumbnails');
  const addToCartBtn = document.getElementById('add-to-cart-btn');
  const buyNowBtn = document.getElementById('buy-now-btn');

  // Сохраняем ссылку на "основной" товар
  window.currentProduct = product;
  // Инициализируем "текущий отображаемый вариант" как основной товар
  window.currentDisplayedVariant = product;

  // Обновляем основную информацию (по умолчанию - основной товар)
  titleElement.textContent = product.title;
  descriptionElement.textContent = product.description || '';
  priceElement.textContent = formatPrice(product.price);
  mainImageElement.src = product.images && product.images[0] ? product.images[0].url.trim() : '/assets/placeholder.png';
  mainImageElement.alt = product.title || 'Изображение товара';

  // Обновляем миниатюры (по умолчанию - основной товар)
  thumbnailsContainer.innerHTML = '';
  if (product.images && product.images.length > 0) {
    product.images.forEach(img => {
      const thumb = document.createElement('img');
      thumb.src = img.url.trim();
      thumb.alt = img.alt || `Миниатюра ${product.title}`;
      thumb.className = 'thumbnail';
      if (img.url === product.images[0].url) thumb.classList.add('active');
      thumb.addEventListener('click', () => {
        mainImageElement.src = img.url.trim();
        document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
      });
      thumbnailsContainer.appendChild(thumb);
    });
  }

  // Обновляем атрибуты кнопок "В корзину" и "Купить"
  // По умолчанию добавляем основной товар
  addToCartBtn.dataset.id = product.id;
  buyNowBtn.dataset.id = product.id;

  // --- Логика для вариантов (БЕЗ кнопки "Основной") ---
  const variantsContainer = document.getElementById('product-variants-container');
  const variantsList = document.getElementById('product-variants');

  if (product.variants && product.variants.length > 0) {
    // Если у товара есть варианты
    variantsContainer.style.display = 'block'; // Показываем контейнер
    variantsList.innerHTML = ''; // Очищаем список

    // Создаем кнопки ТОЛЬКО для каждого варианта
    product.variants.forEach(variant => {
      const variantBtn = document.createElement('button');

      // --- Логика формирования содержимого кнопки ---
      // Отображаем название основного товара для всех вариантов
      let variantName = product.title || `Товар ${product.id}`;

      // Получаем URL главного изображения варианта
      let variantImageUrl = '/assets/placeholder.png'; // По умолчанию
      if (variant.images && variant.images.length > 0 && variant.images[0].url) {
        variantImageUrl = variant.images[0].url.trim();
      } else if (product.images && product.images.length > 0 && product.images[0].url) {
        // Если у варианта нет изображений, используем первое изображение основного товара
        variantImageUrl = product.images[0].url.trim();
      }

      // Создаем элемент изображения
      const imgElement = document.createElement('img');
      imgElement.src = variantImageUrl;
      imgElement.alt = `Фото ${variantName}`; // Альт текст для изображения
      imgElement.className = 'variant-thumbnail'; // Применяем стиль

      // Создаем текстовый элемент для названия
      const textElement = document.createElement('span');
      textElement.textContent = variantName; // Только название

      // Добавляем изображение и текст в кнопку
      variantBtn.appendChild(imgElement);
      variantBtn.appendChild(textElement);

      variantBtn.className = 'product-variant-btn'; // НЕ добавляем 'active' по умолчанию
      variantBtn.dataset.variantId = variant.id;

      // Добавляем обработчик клика
      variantBtn.addEventListener('click', () => {
        // Выбираем этот вариант как отображаемый
        selectVariantInModal(product, variant);
        // Обновляем подсветку кнопок
        document.querySelectorAll('.product-variant-btn').forEach(btn => btn.classList.remove('selected'));
        variantBtn.classList.add('selected');
      });

      variantsList.appendChild(variantBtn);
    });

    // --- Подсвечиваем первый вариант по умолчанию ---
    const firstVariant = product.variants[0];
    if (firstVariant) {
      selectVariantInModal(product, firstVariant);
      const firstVariantBtn = document.querySelector(`.product-variant-btn[data-variant-id="${firstVariant.id}"]`);
      if (firstVariantBtn) {
        firstVariantBtn.classList.add('selected');
      }
    }

  } else {
    // Если у товара нет вариантов
    variantsContainer.style.display = 'none'; // Скрываем контейнер
  }
  // --- Конец логики для вариантов ---

  // Открываем модальное окно
  productModal.classList.add('open');
}

// --- Вспомогательная функция для выбора варианта ---
// product - основной товар (с полем variants)
// selectedVariant - конкретный вариант
function selectVariantInModal(product, selectedVariant) {
  const titleElement = document.getElementById('product-title');
  const descriptionElement = document.getElementById('product-description');
  const priceElement = document.getElementById('product-price');
  const mainImageElement = document.getElementById('product-main-image');
  const thumbnailsContainer = document.getElementById('thumbnails');
  const addToCartBtn = document.getElementById('add-to-cart-btn');
  const buyNowBtn = document.getElementById('buy-now-btn');

  if (!titleElement || !descriptionElement || !priceElement || !mainImageElement || !thumbnailsContainer || !addToCartBtn) {
    console.error('Один или несколько элементов модального окна не найдены.');
    return;
  }

  // Обновляем отображаемую информацию на основе выбранного варианта
  titleElement.textContent = selectedVariant.title;
  descriptionElement.textContent = selectedVariant.description || product.description || '';
  priceElement.textContent = formatPrice(selectedVariant.price);

  // Обновляем изображения
  const variantImages = selectedVariant.images && selectedVariant.images.length > 0 ? selectedVariant.images : (product.images || []);
  if (variantImages && variantImages.length > 0) {
    mainImageElement.src = variantImages[0].url.trim();
    mainImageElement.alt = selectedVariant.title || 'Изображение товара';

    thumbnailsContainer.innerHTML = '';
    variantImages.forEach(img => {
      const thumb = document.createElement('img');
      thumb.src = img.url.trim();
      thumb.alt = img.alt || `Миниатюра ${selectedVariant.title}`;
      thumb.className = 'thumbnail';
      if (img.url === variantImages[0].url) thumb.classList.add('active');
      thumb.addEventListener('click', () => {
        mainImageElement.src = img.url.trim();
        document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
      });
      thumbnailsContainer.appendChild(thumb);
    });
  } else {
    mainImageElement.src = '/assets/placeholder.png';
    mainImageElement.alt = selectedVariant.title || 'Изображение товара';
    thumbnailsContainer.innerHTML = '';
  }

  // --- КРИТИЧЕСКИ ВАЖНО: Обновляем dataset.id кнопок ---
  // Это исправит проблему с добавлением правильного варианта
  addToCartBtn.dataset.id = selectedVariant.id;
  if (buyNowBtn) {
    buyNowBtn.dataset.id = selectedVariant.id;
  }
  // --- Конец обновления dataset.id ---

  // Сохраняем ссылку на текущий отображаемый вариант
  window.currentDisplayedVariant = selectedVariant;
}
// --- Конец вспомогательной функции ---

// Открытие модального окна корзины
function openCartModal() {
  // Сохраняем текущую позицию прокрутки
  const scrollY = window.scrollY || window.pageYOffset;
  document.body.setAttribute('data-scroll-position', scrollY);

  // Блокируем скролл, но сохраняем позицию
  document.body.classList.add('modal-open');
  document.body.style.setProperty('--scrollbar-width', getScrollbarWidth() + 'px');
  document.body.style.top = `-${scrollY}px`;

  if (cartItems) {
    const cart = getCart();
    if (cart.length === 0) {
      cartItems.innerHTML = '<div class="empty">Ваша корзина пуста</div>';
    } else {
      cartItems.innerHTML = '';
      let total = 0;
      cart.forEach(item => {
        const row = document.createElement('div');
        row.className = 'cart-item';
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
        `;
        cartItems.appendChild(row);
        total += item.product.price * item.qty;
      });

      const totalRow = document.createElement('div');
      totalRow.className = 'total-row';
      totalRow.innerHTML = `<span>Итого:</span><span>${formatPrice(total)}</span>`;
      cartItems.appendChild(totalRow);

      // Обработчики изменения количества
      document.querySelectorAll('.qty-minus').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = parseInt(btn.dataset.id);
          updateQuantity(id, -1);
          // openCartModal(); // Вызывается внутри updateQuantity
        });
      });

      document.querySelectorAll('.qty-plus').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = parseInt(btn.dataset.id);
          updateQuantity(id, 1);
          // openCartModal(); // Вызывается внутри updateQuantity
        });
      });
    }
  }

  // Проверяем, что jQuery и maskedinput доступны, и элемент существует
  if (typeof $ !== 'undefined' && $.fn.mask && phoneInput) {
    $(phoneInput).unmask();
    $(phoneInput).mask("+7 (999) 999-99-99", { placeholder: "+7 (___) ___-__-__" });
    console.log("Маска телефона применена к #phone-input");
  } else {
    console.warn("jQuery, maskedinput или элемент #phone-input не найдены. Маска не применена.");
    if (phoneInput) {
      phoneInput.removeEventListener('input', sanitizePhoneInput);
      phoneInput.addEventListener('input', sanitizePhoneInput);
    }
  }

  updateSendOrderButton();

  cartModal.setAttribute('aria-hidden', 'false');
  cartModal.setAttribute('tabindex', '-1');
  cartModal.classList.add('open');

  setTimeout(() => {
    const phoneInputToFocus = document.getElementById('phone');
    if (phoneInputToFocus && typeof phoneInputToFocus.focus === 'function') {
      phoneInputToFocus.focus();
      console.log("Фокус установлен на поле #phone");
    } else {
      const closeButton = cartModal.querySelector('.modal-close');
      if (closeButton && typeof closeButton.focus === 'function') {
        closeButton.focus();
        console.log("Фокус установлен на кнопку закрытия модального окна");
      } else {
        cartModal.setAttribute('tabindex', '-1');
        cartModal.focus();
        console.log("Фокус установлен на само модальное окно");
      }
    }
  }, 0);
}

function sanitizePhoneInput(event) {
  event.target.value = event.target.value.replace(/[^0-9+]/g, '');
}

// Закрытие модалок
function closeModals() {
  const modal = document.querySelector('.modal.open');
  if (modal) modal.classList.remove('open');

  const scrollY = document.body.getAttribute('data-scroll-position');
  document.body.classList.remove('modal-open');
  document.body.style.removeProperty('--scrollbar-width');
  document.body.style.removeProperty('top');

  if (scrollY) {
    window.scrollTo(0, parseInt(scrollY));
    document.body.removeAttribute('data-scroll-position');
  }
}

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', closeModals);
});

document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeModals();
    }
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    const openModal = document.querySelector('.modal.open');
    if (openModal) {
      closeModals();
    }
  }
});

// Обновление состояния кнопки "Оформить заказ"
function updateSendOrderButton() {
  if (!sendOrderBtn) return;

  const cart = getCart();
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

// Привязка событий
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

  if (cartBtn) {
    cartBtn.removeEventListener('click', openCartModal);
    cartBtn.addEventListener('click', openCartModal);
  }

  // Исправлено: обработчик теперь использует window.currentDisplayedVariant
  document.getElementById('add-to-cart-btn')?.addEventListener('click', () => {
    if (window.currentDisplayedVariant) {
      addToCart(window.currentDisplayedVariant);
    } else if (window.currentProduct) {
      addToCart(window.currentProduct);
    } else {
      console.error('Нет доступного товара для добавления в корзину из модального окна');
    }
  });

  document.getElementById('buy-now-btn')?.addEventListener('click', () => {
    if (window.currentDisplayedVariant) {
      addToCart(window.currentDisplayedVariant);
    } else if (window.currentProduct) {
      addToCart(window.currentProduct);
    } else {
      console.error('Нет доступного товара для добавления в корзину (Купить сейчас)');
      return;
    }
    closeModals();
    openCartModal();
  });

  if (phoneInput) {
    phoneInput.removeEventListener('input', sanitizePhoneInput);
    phoneInput.addEventListener('input', sanitizePhoneInput);
  }

  const consentCheckbox = document.getElementById('consent-toggle');
  if (consentCheckbox) {
    consentCheckbox.addEventListener('change', updateSendOrderButton);
  }

  if (sendOrderBtn) {
    let isSending = false;

    sendOrderBtn.addEventListener('click', async () => {
      if (isSending) {
        console.log('Заказ уже отправляется...');
        return;
      }

      const consentCheckbox = document.getElementById('consent-toggle');
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
        isSending = true;
        sendOrderBtn.disabled = true;
        sendOrderBtn.textContent = 'Отправка...';

        const response = await fetch('/api/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: phoneInput.value,
            comment: commentInput.value,
            cart: getCart()
          })
        });

        const result = await response.json();
        console.log('Ответ сервера:', result);

        if (result.success) {
          clearCart();
          phoneInput.value = '';
          commentInput.value = '';
          successMessage.style.display = 'block';
          updateCartCount();
          openCartModal();

          setTimeout(() => {
            successMessage.style.display = 'none';
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
          clearCart();
          phoneInput.value = '';
          commentInput.value = '';
          successMessage.style.display = 'block';
          updateCartCount();
          openCartModal();

          setTimeout(() => {
            successMessage.style.display = 'none';
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

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', closeModals);
  });
}

// Отдельная функция для обработки кликов по категориям
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

// main.js логика
document.addEventList