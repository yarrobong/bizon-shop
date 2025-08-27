// ui.js
// DOM-элементы
const productsContainer = document.getElementById('products');
const searchInput = document.getElementById('search-input');

const categoryButtons = document.querySelectorAll('.tag-btn');
const cartBtn = document.getElementById('cart-btn');
const cartModal = document.getElementById('cart-modal');
const productModal = document.getElementById('product-modal');
const cartItems = document.getElementById('cart-items');
const phoneInput = document.getElementById('phone-input');
const commentInput = document.getElementById('comment-input');
const sendOrderBtn = document.getElementById('send-order');
const successMessage = document.getElementById('success-message');
const yearSpan = document.getElementById('year');

// Установка года
if (yearSpan) {
  yearSpan.textContent = new Date().getFullYear();
}

// Асинхронная загрузка и рендеринг товаров
async function renderProducts() {
  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Не удалось загрузить товары');
    const PRODUCTS = await res.json();

    // 🔥 Отладка
    console.log('Товары с сервера:', PRODUCTS);
    console.log('Текущая категория:', window.currentCategory);

    const query = (searchInput?.value || '').toLowerCase();

    const filtered = PRODUCTS.filter(p =>
      p.available !== false &&
      (window.currentCategory === 'все' || p.category === window.currentCategory) &&
      (query === '' ||
        p.title.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query))
    );

    // 🔥 Отладка
    console.log('Отфильтрованные товары:', filtered);

    if (!productsContainer) {
      console.error('Элемент #products не найден');
      return;
    }

    productsContainer.innerHTML = '';

    if (filtered.length === 0) {
      productsContainer.innerHTML = `
        <div class="empty">
          <div class="text-6xl">🔍</div>
          <h3>Товары не найдены</h3>
          <p>Попробуйте изменить параметры поиска</p>
        </div>
      `;
      return;
    }

    filtered.forEach(product => {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.innerHTML = `
        <div class="product-content">
          <h3 class="product-title">${product.title}</h3>
          <div class="product-image">
            <img src="${product.images[0]?.url?.trim() || '/assets/placeholder.png'}" alt="${product.title}" />
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
    // --- Добавить обработчики событий для кнопок на карточках товаров ---
    // Обработчики для кнопок "Подробнее"
    document.querySelectorAll('.btn-details').forEach(button => {
      button.addEventListener('click', (event) => {
        const productId = parseInt(event.target.dataset.id);
        const product = PRODUCTS.find(p => p.id === productId);
        if (product) {
          openProductModal(product);
        } else {
          console.error(`Товар с id ${productId} не найден.`);
        }
      });
    });

    // Обработчики для кнопок "В корзину"
    document.querySelectorAll('.btn-cart').forEach(button => {
      button.addEventListener('click', (event) => {
        const productId = parseInt(event.target.dataset.id);
        const product = PRODUCTS.find(p => p.id === productId);
        if (product) {
          addToCart(product); // Предполагается, что функция addToCart определена в другом файле (cart.js)
          updateCartCount(); // Предполагается, что функция updateCartCount определена в другом файле (cart.js)
        } else {
          console.error(`Товар с id ${productId} не найден.`);
        }
      });
    });
    // --- Конец добавления обработчиков ---
    // Обработчики...
  } catch (err) {
    console.error('Ошибка загрузки товаров:', err);
    if (productsContainer) {
      productsContainer.innerHTML = `
        <div class="empty">
          <div class="text-6xl">⚠️</div>
          <h3>Ошибка загрузки</h3>
          <p>Попробуйте позже или свяжитесь с нами</p>
        </div>
      `;
    }
  }
}
// Открытие модального окна товара
function openProductModal(product) {
  document.getElementById('product-title').textContent = product.title;
  document.getElementById('product-description').textContent = product.description;
  document.getElementById('product-price').textContent = formatPrice(product.price);
  document.getElementById('product-main-image').src = product.images[0].url.trim();

  const thumbnails = document.getElementById('thumbnails');
  thumbnails.innerHTML = '';
  product.images.forEach(img => {
    const thumb = document.createElement('img');
    thumb.src = img.url.trim();
    thumb.alt = img.alt;
    thumb.className = 'thumbnail';
    if (img.url === product.images[0].url) thumb.classList.add('active');

    thumb.addEventListener('click', () => {
      document.getElementById('product-main-image').src = img.url.trim();
      document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
    });

    thumbnails.appendChild(thumb);
  });

  window.currentProduct = product;
  productModal.classList.add('open');
}

// Открытие модального окна корзины
function openCartModal() {
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
          <img src="${item.product.images[0].url.trim()}" alt="" />
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
          openCartModal();
        });
      });

      document.querySelectorAll('.qty-plus').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = parseInt(btn.dataset.id);
          updateQuantity(id, 1);
          openCartModal();
        });
      });
    }
  }

  updateSendOrderButton();
  cartModal.classList.add('open');
}

// Закрытие модалок
function closeModals() {
  const modal = document.querySelector('.modal.open');
  if (modal) modal.classList.remove('open');
}

// Обновление состояния кнопки "Оформить заказ"
function updateSendOrderButton() {
  if (!sendOrderBtn) return;
  if (getCart().length === 0) {
    sendOrderBtn.disabled = true;
    sendOrderBtn.title = 'Нельзя оформить заказ — корзина пуста';
  } else {
    sendOrderBtn.disabled = false;
    sendOrderBtn.title = '';
  }
}

// Привязка событий
function setupEventListeners() {
  if (searchInput) {
    searchInput.addEventListener('input', renderProducts);
  }

  categoryButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      categoryButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      window.currentCategory = btn.dataset.category;
      renderProducts();
    });
  });

  if (cartBtn) {
    cartBtn.addEventListener('click', openCartModal);
  }

  document.getElementById('add-to-cart-btn')?.addEventListener('click', () => addToCart(window.currentProduct));
  document.getElementById('buy-now-btn')?.addEventListener('click', () => {
    addToCart(window.currentProduct);
    closeModals();
    openCartModal();
  });

  phoneInput?.addEventListener('input', () => {
    phoneInput.value = phoneInput.value.replace(/[^0-9+]/g, '');
  });

  // Отправка заказа на сервер
  if (sendOrderBtn) {
    sendOrderBtn.addEventListener('click', async () => {
      if (!phoneInput.value.trim()) {
        alert('Укажите телефон');
        return;
      }
      if (getCart().length === 0) return;

      try {
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
          }, 3000);
        } else {
          throw new Error(result.error || 'Ошибка сервера');
        }
      } catch (error) {
        console.error('Ошибка отправки заказа:', error);
        alert('Не удалось отправить заказ. Пожалуйста, позвоните нам.');
        sendOrderBtn.disabled = false;
        sendOrderBtn.textContent = 'Оформить заказ';
      }
    });
  }

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', closeModals);
  });
}

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderProducts, openProductModal, openCartModal, closeModals, setupEventListeners };
} else {
  window.renderProducts = renderProducts;
  window.openProductModal = openProductModal;
  window.openCartModal = openCartModal;
  window.closeModals = closeModals;
  window.setupEventListeners = setupEventListeners;
}