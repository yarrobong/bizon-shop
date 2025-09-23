// js/product.js

document.addEventListener('DOMContentLoaded', async function () {
    console.log("Страница товара загружена");

    // --- 1. Получение ID товара из URL ---
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        console.error('ID товара не найден в URL');
        showProductError('Товар не найден (ID отсутствует)');
        return;
    }

    // --- 2. Загрузка данных товара ---
    let productData = null;
    try {
        const response = await fetch(`/api/products/${productId}`);
        if (!response.ok) {
            if (response.status === 404) {
                 throw new Error('Товар не найден');
            } else {
                 throw new Error(`Ошибка загрузки товара: ${response.status}`);
            }
        }
        productData = await response.json();
        console.log('Данные товара загружены (сырые):', productData);
    } catch (error) {
        console.error('Ошибка при загрузке данных товара:', error);
        showProductError(`Ошибка загрузки товара: ${error.message}`);
        return;
    }

    // --- 2.5. Загрузка полных данных вариантов ---
    // Проверяем формат productData.variants и загружаем полные данные при необходимости
    if (productData.variants && Array.isArray(productData.variants) && productData.variants.length > 0) {
        const firstItem = productData.variants[0];
        // Если первый элемент - число или объект только с ID, значит нужно загрузить полные данные
        if (typeof firstItem === 'number' || (typeof firstItem === 'object' && Object.keys(firstItem).length === 1 && firstItem.id)) {
            console.log("productData.variants содержит ID, загружаем полные данные...");
            try {
                // Извлекаем ID, фильтруем и исключаем сам товар
                const variantIds = productData.variants
                    .map(v => typeof v === 'object' ? v.id : v)
                    .map(id => parseInt(id, 10))
                    .filter(id => !isNaN(id) && id != productData.id); // != для сравнения чисел и строк

                if (variantIds.length > 0) {
                    const fullVariantsData = await loadFullVariantsData(variantIds);
                    // Фильтруем по доступности, если нужно, и заменяем в productData
                    productData.variants = fullVariantsData.filter(v => v.available !== false);
                    console.log("Полные данные вариантов загружены и установлены:", productData.variants);
                } else {
                    productData.variants = [];
                    console.log("Нет валидных ID вариантов для загрузки (или все совпадают с основным товаром).");
                }
            } catch (err) {
                console.error("Ошибка при загрузке полных данных вариантов:", err);
                productData.variants = []; // На случай ошибки, показываем без вариантов
                // Можно отобразить уведомление пользователю
            }
        } else {
             console.log("productData.variants уже содержит полные объекты или неполные объекты.");
             // Можно дополнительно отфильтровать по available, если сервер не делает этого
             // productData.variants = productData.variants.filter(v => v.id != productData.id && v.available !== false);
        }
    } else {
         console.log("У товара нет вариантов или формат некорректен.");
         productData.variants = []; // Убедимся, что это пустой массив
    }

    // --- 3. Отображение данных товара ---
    displayProduct(productData);

    // --- 4. Настройка обработчиков событий ---
    setupEventListeners(productData);

    // --- 5. Обновление счетчика корзины ---
    if (typeof updateCartCount === 'function') {
        updateCartCount();
    } else {
        // Резервный вариант, если функция не импортирована
        console.warn("Функция updateCartCount не найдена, используем локальную.");
        updateCartCountLocal();
    }
});

// --- Новая функция для загрузки полных данных вариантов ---
async function loadFullVariantsData(variantIds) {
    if (!Array.isArray(variantIds) || variantIds.length === 0) {
        return [];
    }

    try {
        // Используем эндпоинт bulk, как предлагалось ранее
        const response = await fetch(`/api/products/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: variantIds })
        });

        if (!response.ok) {
            console.error("Ошибка при загрузке полных данных вариантов (bulk):", response.status, await response.text());
            // Альтернатива: загрузить по одному (менее эффективно)
            console.log("Пробуем загрузить варианты по одному...");
            const promises = variantIds.map(id => 
                fetch(`/api/products/${id}`)
                    .then(res => res.ok ? res.json() : null)
                    .catch(err => { console.error(`Ошибка загрузки варианта ${id}:`, err); return null; })
            );
            const results = await Promise.all(promises);
            return results.filter(p => p !== null);
        }

        const fullVariantsData = await response.json();
        console.log("Варианты загружены через bulk:", fullVariantsData);
        return fullVariantsData;
    } catch (error) {
        console.error("Ошибка в функции loadFullVariantsData:", error);
        throw error; // Пробрасываем ошибку выше
    }
}

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
        const breadcrumbProductTitle = document.getElementById('breadcrumb-product-title');
        if (breadcrumbCategory) {
            breadcrumbCategory.innerHTML = `<a href="/catalog?category=${encodeURIComponent(product.category || '')}">${product.category || 'Категория'}</a>`;
        }
        if (breadcrumbProductTitle) {
            breadcrumbProductTitle.textContent = product.title;
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

        // Варианты (логика аналогична модальному окну, но без автоматического выбора)
        renderVariantsOnPage(product); // Теперь product.variants должны быть полными объектами

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
    // document.querySelector('meta[property="og:url"]')?.setAttribute('content', window.location.href); // Опционально
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


// Функция для отображения вариантов на странице товара, аналогично модальному окну
function renderVariantsOnPage(baseProduct) {
    const variantsContainer = document.getElementById('product-page-variants-container');
    const variantsList = document.getElementById('product-page-variants');

    // Очищаем список
    if (variantsList) {
        variantsList.innerHTML = '';
    }

    // Проверяем, есть ли данные о вариантах
    if (baseProduct.variants && Array.isArray(baseProduct.variants) && baseProduct.variants.length > 0) {
        console.log("Отображаем варианты на странице товара (полные данные):", baseProduct.variants);

        if (variantsContainer) {
            // Показываем контейнер, если есть варианты
            // Убираем inline стиль display, который может скрывать элемент (например, из HTML)
            variantsContainer.style.removeProperty('display');
            // Или, если вы используете CSS-класс для скрытия:
            // variantsContainer.classList.remove('hidden'); // Предполагается, что .hidden { display: none; }
        }

        baseProduct.variants.forEach(variant => {
            // Защита от некорректных данных
            if (!variant || typeof variant !== 'object' || !variant.id) {
                console.warn("Некорректные данные варианта, пропускаем:", variant);
                return; // continue в forEach
            }
            const variantBtn = document.createElement('button');
            // --- Логика создания кнопки (скопирована из ui.js) ---
            let variantImageUrl = '/assets/placeholder.png'; // Используем тот же путь, что и на странице
            if (variant.images && variant.images.length > 0 && variant.images[0].url) {
                variantImageUrl = variant.images[0].url.trim();
            } else if (baseProduct.images && baseProduct.images.length > 0 && baseProduct.images[0].url) {
                variantImageUrl = baseProduct.images[0].url.trim();
            }
            const imgElement = document.createElement('img');
            imgElement.src = variantImageUrl;
            imgElement.alt = `Фото ${variant.title || `Товар ${variant.id}`}`;
            imgElement.className = 'variant-thumbnail'; // Убедитесь, что стиль .variant-thumbnail определен в product-page.css
            const textElement = document.createElement('span');
            textElement.textContent = variant.title || `Товар ${variant.id}`;
            variantBtn.appendChild(imgElement);
            variantBtn.appendChild(textElement);
            variantBtn.className = 'product-variant-btn'; // Используем тот же класс для стилей
            variantBtn.dataset.variantId = variant.id;
            // --- Конец логики создания кнопки ---
            // Добавляем обработчик клика, аналогично модальному окну
            variantBtn.addEventListener('click', (event) => {
                event.preventDefault(); // На всякий случай
                console.log("Выбран вариант на странице:", variant.id, variant.title);
                // Выбираем этот вариант как отображаемый ТОЛЬКО ПРИ КЛИКЕ
                selectVariantOnPage(baseProduct, variant); // Используем существующую функцию
                // Обновляем подсветку кнопок
                document.querySelectorAll('.product-variant-btn').forEach(btn => {
                    btn.classList.remove('selected');
                });
                // Добавляем класс 'selected' к кликнутой кнопке
                // event.currentTarget - это сама кнопка, на которую кликнули
                event.currentTarget.classList.add('selected');
            });
            if (variantsList) {
                variantsList.appendChild(variantBtn);
            }
        });
        // --- ВАЖНО: НЕ ВЫБИРАЕМ вариант автоматически ---
        // Страница должна показывать данные основного товара (baseProduct)
        // Выбор варианта происходит только по клику пользователя.
        // Поэтому НЕ вызываем selectVariantOnPage здесь.
        // Опционально: можно подсветить первую кнопку, но не выбирать вариант
        // const firstVariantBtn = document.querySelector('.product-variant-btn');
        // if (firstVariantBtn) {
        //     firstVariantBtn.classList.add('selected'); // Только визуальная подсветка
        // }
    } else {
        console.log("У товара нет вариантов или формат данных некорректен (после обработки).");
        // Явно скрываем контейнер, если вариантов нет
        // (или оставляем его скрытым, если он изначально скрыт в HTML и не предполагается показывать пустой контейнер)
        if (variantsContainer) {
             // Если контейнер изначально скрыт в HTML (style="display: none;"), и мы не хотим его показывать, когда вариантов нет,
             // то можно оставить как есть, или убедиться, что он скрыт:
             variantsContainer.style.display = 'none'; // Устанавливаем display: none; если вариантов нет
             // Или, если вы используете CSS-класс для скрытия:
             // variantsContainer.classList.add('hidden'); // Предполагается, что .hidden { display: none; }
        }
    }
}

// Новая вспомогательная функция для выбора варианта на странице товара
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
        // Можно решить, показывать ли описание варианта или базового товара, или комбинировать
        descriptionElement.textContent = selectedVariant.description || baseProduct.description || '';
        priceElement.textContent = formatPrice(selectedVariant.price);

        // Обновляем изображения
        const variantImages = selectedVariant.images && selectedVariant.images.length > 0 ? selectedVariant.images : (baseProduct.images || []);
        displayProductImages(baseProduct, variantImages); // Переиспользуем функцию

        // ВАЖНО: Обновляем dataset.id кнопки "Добавить в корзину"
        // Это исправит проблему с добавлением правильного варианта
        addToCartBtn.dataset.id = selectedVariant.id;
        if (buyNowBtn) {
            buyNowBtn.dataset.id = selectedVariant.id;
        }

        // Обновляем наличие для варианта (если доступно)
        if (availabilityElement) {
            const statusText = selectedVariant.available !== false ? 'В наличии' : 'Нет в наличии';
            const statusClass = selectedVariant.available !== false ? 'in-stock' : 'out-of-stock';
            availabilityElement.querySelector('span').textContent = statusText;
            availabilityElement.className = `product-page-availability ${statusClass}`;
        }

        // Активируем кнопки, так как вариант выбран
        addToCartBtn.disabled = false;
        if(buyNowBtn) buyNowBtn.disabled = false;

        // Сохраняем ссылку на текущий отображаемый вариант
        window.currentDisplayedVariant = selectedVariant;

    } catch (error) {
        console.error("Ошибка при выборе варианта на странице:", error);
    }
}


function setupEventListeners(product) {
    // Обработчики для кнопок "Добавить в корзину" и "Купить сейчас"
    const addToCartBtn = document.getElementById('product-page-add-to-cart-btn');
    const buyNowBtn = document.getElementById('product-page-buy-now-btn');

    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', () => {
            // Используем текущий отображаемый вариант, а не основной товар
            let itemToAdd = window.currentDisplayedVariant || product;
            console.log("Добавление в корзину:", itemToAdd.id, itemToAdd.title);
            addToCart(itemToAdd);
            if (typeof updateCartCount === 'function') {
                updateCartCount();
            } else {
                updateCartCountLocal();
            }
            // Можно показать уведомление
            alert(`${itemToAdd.title} добавлен в корзину!`);
        });
    }

    if (buyNowBtn) {
        buyNowBtn.addEventListener('click', () => {
             // Используем текущий отображаемый вариант, а не основной товар
            let itemToAdd = window.currentDisplayedVariant || product;
            console.log("Покупка в 1 клик:", itemToAdd.id, itemToAdd.title);
            addToCart(itemToAdd);
            if (typeof updateCartCount === 'function') {
                updateCartCount();
            } else {
                updateCartCountLocal();
            }
            // Открываем модальное окно корзины
            openCartModal(); // Предполагается, что openCartModal доступна (из ui.js/main.js)
        });
    }

    // Обработчик поиска (если оставили)
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const query = e.target.value.trim();
                if (query) {
                    window.location.href = `/catalog?search=${encodeURIComponent(query)}`;
                } else {
                    window.location.href = `/catalog`;
                }
            }
        });
    }

    // Обработчики для закрытия модальных окон (если они используются на этой странице)
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', closeModals); // Предполагается, что closeModals доступна
    });

     // Обработчик изменения согласия на обработку данных в модальном окне корзины
    const consentCheckbox = document.getElementById('consent-toggle');
    if (consentCheckbox) {
        consentCheckbox.addEventListener('change', updateSendOrderButton); // Предполагается, что updateSendOrderButton доступна
    }

    // Обработчик отправки заказа в модальном окне корзины
    const sendOrderBtn = document.getElementById('send-order');
    if (sendOrderBtn) {
        let isSending = false;
        sendOrderBtn.addEventListener('click', async () => {
            if (isSending) {
                console.log('Заказ уже отправляется...');
                return;
            }
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
                    comment: document.getElementById('comment-input')?.value || '',
                    cart: getCart()
                  })
                });
                const result = await response.json();
                console.log('Ответ сервера:', result);
                if (result.success) {
                  clearCart();
                  if (phoneInput) phoneInput.value = '';
                  const commentInput = document.getElementById('comment-input');
                  if (commentInput) commentInput.value = '';
                  const successMessage = document.getElementById('success-message');
                  if (successMessage) successMessage.style.display = 'block';          
                  openCartModal(); // Перерисовываем корзину
                  setTimeout(() => {
                    if (successMessage) successMessage.style.display = 'none';
                    sendOrderBtn.disabled = false;
                    sendOrderBtn.textContent = 'Оформить заказ';
                    isSending = false;
                    // Закрываем модальное окно после успешной отправки
                    closeModals();
                  }, 3000);
                } else {
                  throw new Error(result.error || 'Ошибка сервера');
                }
            } catch (error) {
                console.error('Ошибка отправки заказа:', error);
                if (error.message && error.message.includes('Заказ уже обрабатывается')) {
                  clearCart();
                  const phoneInput = document.getElementById('phone');
                  if (phoneInput) phoneInput.value = '';
                  const commentInput = document.getElementById('comment-input');
                  if (commentInput) commentInput.value = '';
                  const successMessage = document.getElementById('success-message');
                  if (successMessage) successMessage.style.display = 'block';
                  openCartModal();
                  setTimeout(() => {
                    if (successMessage) successMessage.style.display = 'none';
                    sendOrderBtn.disabled = false;
                    sendOrderBtn.textContent = 'Оформить заказ';
                    isSending = false;
                    closeModals();
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

// Обновление счетчика корзины (резервный вариант)
function updateCartCountLocal() {
    const cart = getCart();
    const count = cart.reduce((sum, item) => sum + item.qty, 0);
    const cartCountElement = document.getElementById('cart-count');
    if (cartCountElement) {
        cartCountElement.textContent = count;
        cartCountElement.style.display = count > 0 ? 'block' : 'none';
    }
}

// Открытие модального окна корзины (резервный вариант, если не импортирована)
function openCartModal() {
    const cartModal = document.getElementById('cart-modal');
    if (cartModal) {
        // Простая логика открытия, можно расширить (как в ui.js)
        cartModal.classList.add('open');
        document.body.classList.add('modal-open');
        // Также нужно обновить содержимое корзины
        renderCartItemsOnPage(); // Нужно реализовать эту функцию или использовать существующую
    } else {
         console.warn("Модальное окно корзины не найдено на странице.");
         // Альтернатива: перенаправить на страницу корзины, если она есть
         // window.location.href = '/cart.html';
    }
}

// Закрытие модалок (резервный вариант, если не импортирована)
function closeModals() {
  const modal = document.querySelector('.modal.open');
  if (modal) modal.classList.remove('open');
  document.body.classList.remove('modal-open');
  // Восстанавливаем позицию прокрутки если нужно (логика из ui.js)
  const scrollY = document.body.getAttribute('data-scroll-position');
  if (scrollY) {
    window.scrollTo(0, parseInt(scrollY));
    document.body.removeAttribute('data-scroll-position');
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
// Можно скопировать renderCartItems из ui.js и адаптировать под ID элементов этой страницы
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
            // Упрощенный рендеринг, адаптируйте под вашу разметку корзины
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
    // updateCartCount(); // Вызывается извне
  }
}