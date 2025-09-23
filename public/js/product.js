// js/product.js

// Предполагаем, что formatPrice и другие вспомогательные функции доступны из utils.js или state.js
// Если нет, нужно их импортировать или скопировать

document.addEventListener('DOMContentLoaded', async function () {
    console.log("Страница товара загружена");

    // --- 1. Получение ID товара из URL ---
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        console.error('ID товара не найден в URL');
        document.querySelector('.product-page-container').innerHTML = '<div class="error">Товар не найден (ID отсутствует)</div>';
        return;
    }

    // --- 2. Загрузка данных товара ---
    let productData = null;
    try {
        const response = await fetch(`/api/products/${productId}`);
        if (!response.ok) {
            if (response.status === 404) {
                 throw new Error('Товар не найден (404)');
            } else {
                 throw new Error(`Ошибка загрузки товара: ${response.status}`);
            }
        }
        productData = await response.json();
        console.log('Данные товара загружены:', productData);
    } catch (error) {
        console.error('Ошибка при загрузке данных товара:', error);
        document.querySelector('.product-page-container').innerHTML = `<div class="error">Ошибка загрузки товара: ${error.message}</div>`;
        return;
    }

    // --- 3. Отображение данных товара ---
    displayProduct(productData);

    // --- 4. Настройка обработчиков событий ---
    setupEventListeners(productData);

    // --- 5. Обновление счетчика корзины (если функция доступна) ---
    if (typeof updateCartCount === 'function') {
        updateCartCount();
    }
});

function displayProduct(product) {
    // Обновление заголовков страницы
    const pageTitle = `${product.title} - BIZON`;
    document.title = pageTitle;
    document.getElementById('product-page-title').textContent = pageTitle;
    document.getElementById('product-og-title').setAttribute('content', product.title);

    // Обновление описания страницы
    const pageDescription = product.description ? product.description.substring(0, 160) + '...' : `Купить ${product.title} по выгодной цене.`;
    document.getElementById('product-page-description').setAttribute('content', pageDescription);
    document.getElementById('product-og-description').setAttribute('content', pageDescription);

    // Обновление URL в OG (опционально, если есть канонический URL)
    // document.querySelector('meta[property="og:url"]').setAttribute('content', window.location.href);

    // Обновление навигационной цепочки
    document.getElementById('breadcrumb-category').innerHTML = `<a href="/catalog?category=${encodeURIComponent(product.category || '')}">${product.category || 'Категория'}</a>`;
    document.getElementById('breadcrumb-product-title').textContent = product.title;

    // Основная информация
    document.getElementById('product-page-title-main').textContent = product.title;
    document.getElementById('product-page-description-main').textContent = product.description || 'Описание отсутствует';

    const priceElement = document.getElementById('product-page-price');
    if (priceElement) {
        priceElement.textContent = formatPrice(product.price); // Предполагается, что formatPrice доступна
    }

    // Наличие
    const availabilityElement = document.getElementById('product-page-availability');
    if (availabilityElement) {
        const statusText = product.available !== false ? 'В наличии' : 'Нет в наличии';
        const statusClass = product.available !== false ? 'in-stock' : 'out-of-stock';
        availabilityElement.querySelector('span').textContent = statusText;
        availabilityElement.className = `product-page-availability ${statusClass}`;
    }

    // Изображения
    const mainImageElement = document.getElementById('product-page-main-image');
    const thumbnailsContainer = document.getElementById('product-page-thumbnails');
    if (mainImageElement && thumbnailsContainer) {
        thumbnailsContainer.innerHTML = '';
        if (product.images && product.images.length > 0) {
            mainImageElement.src = product.images[0].url.trim();
            mainImageElement.alt = product.title;

            // OG Image
            document.getElementById('product-og-image').setAttribute('content', product.images[0].url.trim());

            product.images.forEach((img, index) => {
                const thumb = document.createElement('img');
                thumb.src = img.url.trim();
                thumb.alt = img.alt || `Миниатюра ${product.title}`;
                thumb.className = 'thumbnail';
                if (index === 0) thumb.classList.add('active');
                thumb.addEventListener('click', () => {
                    mainImageElement.src = img.url.trim();
                    document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
                    thumb.classList.add('active');
                });
                thumbnailsContainer.appendChild(thumb);
            });
        } else {
            mainImageElement.src = '/assets/placeholder.png';
            mainImageElement.alt = product.title;
            document.getElementById('product-og-image').setAttribute('content', '/assets/placeholder.png');
        }
    }

    // Варианты (логика аналогична модальному окну)
    const variantsContainer = document.getElementById('product-page-variants-container');
    const variantsList = document.getElementById('product-page-variants');
    if (variantsContainer && variantsList) {
        variantsList.innerHTML = '';
        if (product.variants && product.variants.length > 0) {
            variantsContainer.style.display = 'block';
            product.variants.forEach(variant => {
                const variantBtn = document.createElement('button');
                let variantImageUrl = '/assets/placeholder.png';
                if (variant.images && variant.images.length > 0 && variant.images[0].url) {
                    variantImageUrl = variant.images[0].url.trim();
                } else if (product.images && product.images.length > 0 && product.images[0].url) {
                    variantImageUrl = product.images[0].url.trim();
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

                // Обработчик клика по варианту
                variantBtn.addEventListener('click', () => {
                    selectVariantOnPage(product, variant);
                    document.querySelectorAll('.product-variant-btn').forEach(btn => btn.classList.remove('selected'));
                    variantBtn.classList.add('selected');
                });

                variantsList.appendChild(variantBtn);
            });

            // Выбираем первый вариант по умолчанию
            const firstVariant = product.variants[0];
            if (firstVariant) {
                selectVariantOnPage(product, firstVariant);
                const firstVariantBtn = document.querySelector(`.product-variant-btn[data-variant-id="${firstVariant.id}"]`);
                if (firstVariantBtn) {
                    firstVariantBtn.classList.add('selected');
                }
            }
        } else {
            variantsContainer.style.display = 'none';
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

    if (!titleElement || !descriptionElement || !priceElement || !mainImageElement || !thumbnailsContainer || !addToCartBtn) {
        console.error('Один или несколько элементов страницы товара не найдены для обновления варианта.');
        return;
    }

    // Обновляем отображаемую информацию на основе выбранного варианта
    titleElement.textContent = selectedVariant.title;
    // Можно решить, показывать ли описание варианта или базового товара, или комбинировать
    descriptionElement.textContent = selectedVariant.description || baseProduct.description || '';
    priceElement.textContent = formatPrice(selectedVariant.price);

    // Обновляем изображения
    const variantImages = selectedVariant.images && selectedVariant.images.length > 0 ? selectedVariant.images : (baseProduct.images || []);
    if (variantImages && variantImages.length > 0) {
        mainImageElement.src = variantImages[0].url.trim();
        mainImageElement.alt = selectedVariant.title || 'Изображение товара';
        document.getElementById('product-og-image').setAttribute('content', variantImages[0].url.trim());

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
                 document.getElementById('product-og-image').setAttribute('content', img.url.trim());
            });
            thumbnailsContainer.appendChild(thumb);
        });
    } else {
         mainImageElement.src = '/assets/placeholder.png';
         mainImageElement.alt = selectedVariant.title || 'Изображение товара';
         document.getElementById('product-og-image').setAttribute('content', '/assets/placeholder.png');
         thumbnailsContainer.innerHTML = '';
    }

    // ВАЖНО: Обновляем dataset.id кнопок
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
}

function setupEventListeners(product) {
    // Обработчики для кнопок "Добавить в корзину" и "Купить сейчас"
    const addToCartBtn = document.getElementById('product-page-add-to-cart-btn');
    const buyNowBtn = document.getElementById('product-page-buy-now-btn');

    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', () => {
            // Получаем ID из dataset кнопки (который обновляется при выборе варианта)
            const idToAdd = parseInt(addToCartBtn.dataset.id);
            if (idToAdd) {
                // Находим выбранный товар/вариант (предполагаем, что product.variants содержит полные объекты)
                let itemToAdd = product;
                if (product.variants && product.variants.length > 0) {
                     // Ищем среди вариантов
                     const foundVariant = product.variants.find(v => v.id === idToAdd);
                     if (foundVariant) {
                         itemToAdd = foundVariant;
                     }
                }
                // Проверка на всякий случай
                if (itemToAdd.id === idToAdd) {
                    addToCart(itemToAdd); // Предполагается, что addToCart доступна (из ui.js/main.js/utils.js)
                    if (typeof updateCartCount === 'function') {
                        updateCartCount();
                    }
                     // Можно показать уведомление
                     alert(`${itemToAdd.title} добавлен в корзину!`);
                } else {
                    console.error("Не удалось определить товар для добавления в корзину");
                }
            } else {
                 // Если ID не установлен (например, товар без вариантов, но кнопка была заблокирована неправильно)
                 // Добавляем базовый товар
                 addToCart(product);
                 if (typeof updateCartCount === 'function') {
                    updateCartCount();
                 }
                 alert(`${product.title} добавлен в корзину!`);
            }
        });
    }

    if (buyNowBtn) {
        buyNowBtn.addEventListener('click', () => {
             const idToAdd = parseInt(buyNowBtn.dataset.id);
            if (idToAdd) {
                let itemToAdd = product;
                if (product.variants && product.variants.length > 0) {
                     const foundVariant = product.variants.find(v => v.id === idToAdd);
                     if (foundVariant) {
                         itemToAdd = foundVariant;
                     }
                }
                if (itemToAdd.id === idToAdd) {
                    addToCart(itemToAdd);
                    if (typeof updateCartCount === 'function') {
                        updateCartCount();
                    }
                    // Открываем модальное окно корзины
                    if (typeof openCartModal === 'function') {
                         openCartModal();
                    } else {
                        console.warn("Функция openCartModal не найдена");
                        // Альтернатива: перенаправить на страницу корзины, если она есть
                        // window.location.href = '/cart.html';
                    }
                } else {
                    console.error("Не удалось определить товар для покупки");
                }
            } else {
                 addToCart(product);
                 if (typeof updateCartCount === 'function') {
                    updateCartCount();
                 }
                 if (typeof openCartModal === 'function') {
                     openCartModal();
                 } else {
                     console.warn("Функция openCartModal не найдена");
                 }
            }
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
}

// --- Функции, которые должны быть доступны (предполагаются определенными в других файлах) ---
// Если они не будут найдены, нужно будет скопировать их сюда или импортировать

// Форматирование цены (пример, если не доступна)
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

// Добавление в корзину (пример, если не доступна)
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

// Получение корзины (пример, если не доступна)
function getCart() {
    const cart = localStorage.getItem('cart');
    return cart ? JSON.parse(cart) : [];
}

// Обновление счетчика корзины (пример, если не доступна)
function updateCartCount() {
    const cart = getCart();
    const count = cart.reduce((sum, item) => sum + item.qty, 0);
    const cartCountElement = document.getElementById('cart-count');
    if (cartCountElement) {
        cartCountElement.textContent = count;
        cartCountElement.style.display = count > 0 ? 'block' : 'none';
    }
}

// Открытие модального окна корзины (пример, если не доступна)
function openCartModal() {
    const cartModal = document.getElementById('cart-modal');
    if (cartModal) {
        // Простая логика открытия, можно расширить (как в ui.js)
        cartModal.classList.add('open');
        document.body.classList.add('modal-open');
        // Также нужно обновить содержимое корзины, вызвав соответствующую функцию
        // renderCartItems(); // Предполагаемая функция
         if (typeof renderCartItemsOnPage === 'function') {
             renderCartItemsOnPage(); // Нужно реализовать эту функцию или использовать существующую
         } else {
             console.warn("Функция для рендеринга корзины на странице товара не найдена.");
             // Минимальный рендеринг
             const cartItemsContainer = document.getElementById('cart-items');
             if(cartItemsContainer) {
                 const cart = getCart();
                 if (cart.length === 0) {
                     cartItemsContainer.innerHTML = '<div class="empty">Ваша корзина пуста</div>';
                 } else {
                      cartItemsContainer.innerHTML = '<div>Корзина содержит товары. Пожалуйста, оформите заказ.</div>';
                      // Здесь должна быть логика рендеринга, как в openCartModal в ui.js
                 }
             }
         }
    }
}

// Функция для рендеринга корзины в модальном окне этой страницы (если нужно)
// Можно скопировать renderCartItems из ui.js и адаптировать под ID элементов этой страницы
// function renderCartItemsOnPage() { ... }