// js/product.js

document.addEventListener('DOMContentLoaded', async function () {
    console.log("Страница товара загружена");

    // --- 1. Получение slug товара из URL ---
    // URL теперь вида: /product/nazvanietovara
    const pathSegments = window.location.pathname.split('/');
    const slug = pathSegments[pathSegments.length - 1]; // Последний сегмент — slug

    if (!slug) {
        console.error('Slug товара не найден в URL');
        showProductError('Товар не найден (slug отсутствует)');
        return;
    }

    // --- 2. Загрузка данных товара по slug ---
    let requestedProductData = null;
    try {
        const response = await fetch(`/api/product-by-slug/${slug}`);
        if (!response.ok) {
            if (response.status === 404) {
                 throw new Error('Товар не найден');
            } else {
                 throw new Error(`Ошибка загрузки товара: ${response.status}`);
            }
        }
        requestedProductData = await response.json();
        console.log('Данные товара (по slug):', requestedProductData);
    } catch (error) {
        console.error('Ошибка при загрузке данных товара по slug:', error);
        showProductError(`Ошибка загрузки товара: ${error.message}`);
        return;
    }

    // --- 3. Отображение данных товара ---
    displayProduct(requestedProductData);

    // --- 4. Настройка обработчиков событий ---
    setupEventListeners(requestedProductData);

    // --- 5. Обновление счетчика корзины ---
    if (typeof updateCartCount === 'function') {
        updateCartCount();
    } else {
        // Резервный вариант, если функция не импортирована
        console.warn("Функция updateCartCount не найдена, используем локальную.");
        updateCartCountLocal();
    }
});

function showProductError(message) {
    const container = document.querySelector('.product-page-container');
    if (container) {
        container.innerHTML = `<div class="error">${message}</div>`;
    }
}

function displayProduct(product) {
    try {
        // Обновление заголовков страницы
        const pageTitle = `${product.title} - BIZON`;
        document.title = pageTitle;
        updateMetaTags(product);

        // Обновление навигационной цепочки
        const breadcrumbCategory = document.getElementById('breadcrumb-category');
        
        if (breadcrumbCategory) {
            breadcrumbCategory.innerHTML = `<a href="/catalog?category=${encodeURIComponent(product.category || '')}">${product.category || 'Категория'}</a>`;
        }
        

        // Основная информация
        const titleElement = document.getElementById('product-page-title-main');
        const descriptionElement = document.getElementById('product-page-description-main');
        const priceElement = document.getElementById('product-page-price');
        const availabilityElement = document.getElementById('product-page-availability');

        if (titleElement) titleElement.textContent = product.title;
        if (descriptionElement) descriptionElement.textContent = product.description || 'Описание отсутствует';
        if (priceElement) priceElement.textContent = formatPrice(product.price);

        // Наличие
        if (availabilityElement) {
            const statusText = product.available !== false ? 'В наличии' : 'Нет в наличии';
            const statusClass = product.available !== false ? 'in-stock' : 'out-of-stock';
            availabilityElement.querySelector('span').textContent = statusText;
            availabilityElement.className = `product-page-availability ${statusClass}`;
        }

        // Изображения
        displayProductImages(product, product.images);

        // Варианты
        renderVariantsOnPage(product);

        // Инициализируем "текущий отображаемый вариант" как основной товар
        window.currentDisplayedVariant = product;

        // Обновляем dataset.id кнопок "В корзину" и "Купить"
        const addToCartBtn = document.getElementById('product-page-add-to-cart-btn');
        const buyNowBtn = document.getElementById('product-page-buy-now-btn');
        if (addToCartBtn) addToCartBtn.dataset.id = product.id;
        if (buyNowBtn) buyNowBtn.dataset.id = product.id;
        if (addToCartBtn) addToCartBtn.disabled = false;
        if (buyNowBtn) buyNowBtn.disabled = false;

    } catch (error) {
        console.error("Ошибка при отображении товара:", error);
        showProductError("Ошибка отображения товара.");
    }
}

function updateMetaTags(product) {
    // Обновление мета-тегов для SEO
    const pageDescription = product.description ? product.description.substring(0, 160) + '...' : `Купить ${product.title} по выгодной цене.`;
    
    document.querySelector('meta[name="description"]')?.setAttribute('content', pageDescription);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', product.title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', pageDescription);
    
    const mainImageUrl = product.images && product.images.length > 0 ? product.images[0].url : '/assets/placeholder.png';
    document.querySelector('meta[property="og:image"]')?.setAttribute('content', mainImageUrl);
}

function displayProductImages(baseProduct, imagesToDisplay) {
    const mainImageElement = document.getElementById('product-page-main-image');
    const thumbnailsContainer = document.getElementById('product-page-thumbnails');

    if (!mainImageElement || !thumbnailsContainer) {
        console.error("Элементы изображений не найдены на странице.");
        return;
    }

    thumbnailsContainer.innerHTML = '';
    
    if (imagesToDisplay && imagesToDisplay.length > 0) {
        mainImageElement.src = imagesToDisplay[0].url.trim();
        mainImageElement.alt = baseProduct.title;

        imagesToDisplay.forEach((img, index) => {
            const thumb = document.createElement('img');
            thumb.src = img.url.trim();
            thumb.alt = img.alt || `Миниатюра ${baseProduct.title}`;
            thumb.className = 'thumbnail';
            if (index === 0) thumb.classList.add('active');
            thumb.addEventListener('click', () => {
                mainImageElement.src = img.url.trim();
                document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
                // Обновляем OG Image при смене главного изображения
                document.querySelector('meta[property="og:image"]')?.setAttribute('content', img.url.trim());
            });
            thumbnailsContainer.appendChild(thumb);
        });
         // Обновляем OG Image на первое изображение
         document.querySelector('meta[property="og:image"]')?.setAttribute('content', imagesToDisplay[0].url.trim());
    } else {
        mainImageElement.src = '/assets/placeholder.png';
        mainImageElement.alt = baseProduct.title;
        document.querySelector('meta[property="og:image"]')?.setAttribute('content', '/assets/placeholder.png');
    }
}

// Функция для отображения вариантов на странице товара
function renderVariantsOnPage(baseProduct) {
    const variantsContainer = document.getElementById('product-page-variants-container');
    const variantsList = document.getElementById('product-page-variants');

    // Очищаем список
    if (variantsList) {
        variantsList.innerHTML = '';
    }

    // Проверяем, есть ли данные о вариантах
    const variants = baseProduct.variants || []; // Если variants undefined, используем пустой массив

    if (variants && Array.isArray(variants) && variants.length > 0) {
        console.log("Отображаем варианты на странице товара:", variants);

        if (variantsContainer) {
            // Показываем контейнер, если есть варианты
            variantsContainer.style.removeProperty('display');
        }

        variants.forEach(variant => {
            // Защита от некорректных данных
            if (!variant || typeof variant !== 'object' || !variant.id) {
                console.warn("Некорректные данные варианта, пропускаем:", variant);
                return; // continue в forEach
            }
            const variantBtn = document.createElement('button');
            // --- Логика создания кнопки ---
            let variantImageUrl = '/assets/placeholder.png';
            if (variant.images && variant.images.length > 0 && variant.images[0].url) {
                variantImageUrl = variant.images[0].url.trim();
            } else if (baseProduct.images && baseProduct.images.length > 0 && baseProduct.images[0].url) {
                variantImageUrl = baseProduct.images[0].url.trim();
            }
            const imgElement = document.createElement('img');
            imgElement.src = variantImageUrl;
            imgElement.alt = `Фото ${variant.title || `Товар ${variant.id}`}`;
            imgElement.className = 'variant-thumbnail';
            const textElement = document.createElement('span');
            textElement.textContent = variant.title || `Товар ${variant.id}`;
            variantBtn.appendChild(imgElement);
            variantBtn.appendChild(textElement);
            variantBtn.className = 'product-variant-btn';
            variantBtn.dataset.variantId = variant.id;

            // Проверим, является ли этот вариант текущим отображаемым
            if (window.currentDisplayedVariant && window.currentDisplayedVariant.id == variant.id) {
                 variantBtn.classList.add('selected');
            }

            // --- Конец логики создания кнопки ---
            // Добавляем обработчик клика
            variantBtn.addEventListener('click', (event) => {
                event.preventDefault();
                console.log("Выбран вариант на странице:", variant.id, variant.title);
                // Выбираем этот вариант как отображаемый
                selectVariantOnPage(baseProduct, variant);
                // Обновляем подсветку кнопок
                document.querySelectorAll('.product-variant-btn').forEach(btn => {
                    btn.classList.remove('selected');
                });
                event.currentTarget.classList.add('selected');
            });
            if (variantsList) {
                variantsList.appendChild(variantBtn);
            }
        });

    } else {
        console.log("У товара нет вариантов.");
        // Явно скрываем контейнер, если нет вариантов
        if (variantsContainer) {
             variantsContainer.style.display = 'none';
        }
    }
}

// Обновленная функция для выбора варианта на странице товара
function selectVariantOnPage(baseProduct, selectedVariant) {
    const titleElement = document.getElementById('product-page-title-main');
    const descriptionElement = document.getElementById('product-page-description-main');
    const priceElement = document.getElementById('product-page-price');
    const mainImageElement = document.getElementById('product-page-main-image');
    const thumbnailsContainer = document.getElementById('product-page-thumbnails');
    const addToCartBtn = document.getElementById('product-page-add-to-cart-btn');
    const buyNowBtn = document.getElementById('product-page-buy-now-btn');
    const availabilityElement = document.getElementById('product-page-availability');

    // Проверки на существование элементов
    if (!titleElement || !descriptionElement || !priceElement || !mainImageElement || !thumbnailsContainer || !addToCartBtn) {
        console.error('Один или несколько элементов страницы товара не найдены для обновления варианта.');
        return;
    }

    try {
        // Обновляем отображаемую информацию на основе выбранного варианта
        titleElement.textContent = selectedVariant.title;
        descriptionElement.textContent = selectedVariant.description || baseProduct.description || '';
        priceElement.textContent = formatPrice(selectedVariant.price);

        // Обновляем изображения
        const variantImages = selectedVariant.images && selectedVariant.images.length > 0 ? selectedVariant.images : (baseProduct.images || []);
        displayProductImages(baseProduct, variantImages); // Переиспользуем функцию

        // Обновляем dataset.id кнопки "Добавить в корзину"
        addToCartBtn.dataset.id = selectedVariant.id;
        if (buyNowBtn) {
            buyNowBtn.dataset.id = selectedVariant.id;
        }

        // Обновляем наличие для варианта
        if (availabilityElement) {
            const statusText = selectedVariant.available !== false ? 'В наличии' : 'Нет в наличии';
            const statusClass = selectedVariant.available !== false ? 'in-stock' : 'out-of-stock';
            availabilityElement.querySelector('span').textContent = statusText;
            availabilityElement.className = `product-page-availability ${statusClass}`;
        }

        // Активируем кнопки
        addToCartBtn.disabled = false;
        if(buyNowBtn) buyNowBtn.disabled = false;

        // Сохраняем ссылку на текущий отображаемый вариант
        window.currentDisplayedVariant = selectedVariant;

        // --- НОВОЕ: Обновляем URL ---
        // Используем slug выбранного варианта, если он есть
        const newSlug = selectedVariant.slug || baseProduct.slug;
        const newUrl = `/product/${newSlug}`;
        window.history.replaceState({}, '', newUrl);
        console.log("URL обновлен до:", newUrl);

    } catch (error) {
        console.error("Ошибка при выборе варианта на странице:", error);
    }
}

// Добавляем обработчик для кнопки корзины, если она есть (альтернативный способ, если не в main.js)
const cartBtn = document.getElementById('cart-btn');
if (cartBtn) {
    cartBtn.addEventListener('click', () => {
         window.location.href = '/cart';
    });
}

function setupEventListeners(product) {
    // Обработчики для кнопок "Добавить в корзину" и "Купить сейчас"
    const addToCartBtn = document.getElementById('product-page-add-to-cart-btn');
    const buyNowBtn = document.getElementById('product-page-buy-now-btn');

    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', () => {
            // Используем текущий отображаемый вариант, а не основной товар
            let itemToAdd = window.currentDisplayedVariant || product;
            console.log("Добавление в корзину (из state.js):", itemToAdd.id, itemToAdd.title);
            window.addToCart(itemToAdd); // Вызываем функцию из state.js
            window.updateCartCountLocal(); // Вызываем функцию из state.js
        });
    }

    if (buyNowBtn) {
        buyNowBtn.addEventListener('click', () => {
             // Используем текущий отображаемый вариант, а не основной товар
            let itemToAdd = window.currentDisplayedVariant || product;
            console.log("Покупка в 1 клик (из state.js):", itemToAdd.id, itemToAdd.title);
            window.addToCart(itemToAdd); // Вызываем функцию из state.js
            window.updateCartCount(); // Вызываем функцию из state.js
            // ВАЖНО: Перенаправляем на страницу корзины
            window.location.href = '/cart';
        });
    }

    // Обработчик отправки заказа в модальном окне корзины (изменён: убрана проверка consent)
    const sendOrderBtn = document.getElementById('send-order');
    if (sendOrderBtn) {
        let isSending = false;
        sendOrderBtn.addEventListener('click', async () => {
            console.log("Кликнули 'Оформить заказ'. isSending:", isSending);
            if (isSending) {
                console.log('Заказ уже отправляется...');
                return;
            }
            const phoneInput = document.getElementById('phone');
            if (!phoneInput || !phoneInput.value.trim()) {
                alert('Укажите телефон');
                return;
            }
            if (window.getCart().length === 0) { // Используем функцию из state.js
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
                    cart: window.getCart() // Используем функцию из state.js
                  })
                });
                const result = await response.json();
                console.log('Ответ сервера:', result);
                if (result.success) {
                  window.clearCart(); // Используем функцию из state.js
                  if (phoneInput) phoneInput.value = '';
                  const commentInput = document.getElementById('comment-input');
                  if (commentInput) commentInput.value = '';
                  const successMessage = document.getElementById('success-message');
                  if (successMessage) successMessage.style.display = 'block';
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
                  window.clearCart(); // Используем функцию из state.js
                  const phoneInput = document.getElementById('phone');
                  if (phoneInput) phoneInput.value = '';
                  const commentInput = document.getElementById('comment-input');
                  if (commentInput) commentInput.value = '';
                  const successMessage = document.getElementById('success-message');
                  if (successMessage) successMessage.style.display = 'block';
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
}

// --- Функции, которые должны быть доступны (предполагаются определенными в других файлах) ---
// Если они не будут найдены, используются резервные варианты ниже

// Форматирование цены (резервный вариант)
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

// Добавление в корзину (резервный вариант)
function addToCart(product) {
    const cart = getCart(); // Предполагается, что getCart доступна
    const existingItem = cart.find(item => item.product.id === product.id);
    if (existingItem) {
        existingItem.qty += 1;
    } else {
        cart.push({ product, qty: 1 });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    console.log(`Товар ${product.title} (ID: ${product.id}) добавлен в корзину.`);
}

// Получение корзины (резервный вариант)
function getCart() {
    const cart = localStorage.getItem('cart');
    return cart ? JSON.parse(cart) : [];
}

// Очистка корзины (резервный вариант)
function clearCart() {
  localStorage.removeItem('cart');
  updateCartCountLocal(); // Обновляем локальный счетчик
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
  }
}

// Обновление состояния кнопки "Оформить заказ" (резервный вариант)
function updateSendOrderButton() {
  const sendOrderBtn = document.getElementById('send-order');
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

// Функция для рендеринга корзины в модальном окне этой страницы (если нужно)
function renderCartItemsOnPage() {
    const cartItemsContainer = document.getElementById('cart-items');
    if (!cartItemsContainer) {
        console.warn("Контейнер элементов корзины не найден.");
        return;
    }

    const cart = getCart();
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<div class="empty">Ваша корзина пуста</div>';
    } else {
        cartItemsContainer.innerHTML = '';
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
            cartItemsContainer.appendChild(row);
            total += item.product.price * item.qty;
        });
        const totalRow = document.createElement('div');
        totalRow.className = 'total-row';
        totalRow.innerHTML = `<span>Итого:</span><span>${formatPrice(total)}</span>`;
        cartItemsContainer.appendChild(totalRow);

        // Повторно привязываем обработчики событий для изменения количества
        document.querySelectorAll('.qty-minus').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                updateQuantityLocal(id, -1);
                renderCartItemsOnPage(); // Перерисовываем
                 if (typeof updateCartCount === 'function') {
                    updateCartCount();
                } else {
                    updateCartCountLocal();
                }
            });
        });
        document.querySelectorAll('.qty-plus').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                updateQuantityLocal(id, 1);
                renderCartItemsOnPage(); // Перерисовываем
                 if (typeof updateCartCount === 'function') {
                    updateCartCount();
                } else {
                    updateCartCountLocal();
                }
            });
        });
    }
    updateSendOrderButton();
}

// Обновление количества в корзине (резервный вариант)
function updateQuantityLocal(productId, change) {
  const cart = getCart();
  const item = cart.find(item => item.product.id === productId);
  if (item) {
    item.qty += change;
    if (item.qty <= 0) {
      const index = cart.indexOf(item);
      cart.splice(index, 1);
    }
    localStorage.setItem('cart', JSON.stringify(cart));
  }
}