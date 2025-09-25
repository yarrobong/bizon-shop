// js/attractions.js

(function () {
  'use strict';

  // --- DOM Elements ---
  const attractionsContainer = document.getElementById('attractions-container');
  const searchInput = document.getElementById('search-input');
  const categoryButtons = document.querySelectorAll('.tag-btn');
  const cartBtn = document.getElementById('cart-btn');
  const cartModal = document.getElementById('cart-modal');
  const cartItems = document.getElementById('cart-items');
  const phoneInput = document.getElementById('phone');
  const commentInput = document.getElementById('comment-input');
  const sendOrderBtn = document.getElementById('send-order');
  const successMessage = document.getElementById('success-message');
  const yearSpan = document.getElementById('year');

  // --- State ---
  let currentCategory = 'все';
  let ATTRACTIONS = []; // Будет заполнен данными
  let renderProductsTimeout;

  // --- Инициализация ---
  document.addEventListener('DOMContentLoaded', async function () {
    console.log('Attractions page loaded');
    await loadAttractions(); // Загружаем данные
    renderAttractions(); // Рендерим карточки
    setupEventListeners(); // Навешиваем обработчики
    updateCartCount(); // Обновляем счетчик корзины
    // Установка года
    if (yearSpan) {
      yearSpan.textContent = new Date().getFullYear();
    }
  });

  // --- Data Loading ---
  async function loadAttractions() {
    // Всегда пытаемся загрузить данные с сервера
    try {
      console.log('Запрос аттракционов с сервера...');
      const response = await fetch('/api/attractions');

      if (!response.ok) {
        // Если статус не 2xx, генерируем ошибку
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP error! status: ${response.status}. ${errorData.error || ''} Details: ${errorData.details || ''}`);
      }

      const data = await response.json();
      
      ATTRACTIONS = data; // Сохраняем полученные данные

      // Проверка на пустой массив
      if (!ATTRACTIONS || ATTRACTIONS.length === 0) {
        console.warn('Сервер вернул пустой список аттракционов.');
        if (attractionsContainer) {
          attractionsContainer.innerHTML = `
            <div class="empty">
              <div class="text-6xl">🪄</div>
              <h3>Аттракционы не найдены</h3>
              <p>Каталог аттракционов временно пуст. Загляните позже!</p>
              <small class="text-muted">Данные были успешно загружены с сервера, но список пуст.</small>
            </div>
          `;
        }
        return; // Выходим, так как данных нет
      }

    } catch (error) {
      // Любая ошибка (сетевая, JSON.parse, HTTP status code и т.д.)
      console.error('❌ Критическая ошибка загрузки аттракционов:', error);
      if (attractionsContainer) {
        attractionsContainer.innerHTML = `
          <div class="empty error">
            <div class="text-6xl">❗</div>
            <h3>Ошибка загрузки</h3>
            <p>Не удалось загрузить каталог аттракционов.</p>
            <p class="error-details">Подробности в консоли разработчика (F12).</p>
            <small class="text-muted">Это может быть связано с сетевой проблемой или внутренней ошибкой сервера.</small>
            <button onclick="location.reload()" class="btn-details" style="margin-top: 1rem;">Повторить попытку</button>
          </div>
        `;
      }
    }
  }

  

  // --- Функция для создания карточки аттракциона с галереей ---
  function createAttractionCard(attraction) {
    // Извлекаем спецификации из объекта
    const specs = attraction.specs || {};
    const places = specs.places || 'N/A';
    const power = specs.power || 'N/A';
    const games = specs.games || 'N/A';
    const area = specs.area || 'N/A';
    const dimensions = specs.dimensions || 'N/A';

    // Обработка изображений: используем массив images, если он есть и не пуст, иначе fallback на поле image
    let imagesArray = [];
    if (attraction.images && Array.isArray(attraction.images) && attraction.images.length > 0) {
        imagesArray = attraction.images;
    } else if (attraction.image) {
        // Для обратной совместимости со старым форматом
        imagesArray = [{ url: attraction.image, alt: attraction.title || 'Изображение' }];
    } else {
        // Заглушка, если изображений нет совсем
        imagesArray = [{ url: '/assets/icons/placeholder1.webp', alt: 'Нет изображения' }];
    }

    const card = document.createElement('div');
    card.className = 'attraction-card';
    // Уникальный ID для контейнеров галереи этой карточки
    const galleryId = `gallery-${attraction.id}`;
    const mainImageId = `main-image-${attraction.id}`;
    const thumbnailsId = `thumbnails-${attraction.id}`;

    card.innerHTML = `
      <div class="attraction-gallery" id="${galleryId}" data-attraction-id="${attraction.id}">
        <div class="attraction-main-image-container">
            <img id="${mainImageId}" class="attraction-main-image" src="${imagesArray[0].url}" onerror="this.onerror=null; this.src='/assets/icons/placeholder1.webp';" alt="${imagesArray[0].alt || attraction.title}" />
            ${imagesArray.length > 1 ? `
            <button class="attraction-gallery-nav prev" aria-label="Предыдущее изображение">&#10094;</button>
            <button class="attraction-gallery-nav next" aria-label="Следующее изображение">&#10095;</button>
            ` : ''}
        </div>
        ${imagesArray.length > 1 ? `
        <div class="attraction-thumbnails" id="${thumbnailsId}">
            ${imagesArray.map((img, index) => `
                <img class="attraction-thumbnail ${index === 0 ? 'active' : ''}" 
                     src="${img.url}" 
                     alt="Миниатюра ${index + 1} для ${attraction.title}" 
                     data-index="${index}"
                     onerror="this.onerror=null; this.src='/assets/icons/placeholder1.webp';"/>
            `).join('')}
        </div>
        ` : ''}
      </div>
      <div class="attraction-info">
        <h3 class="attraction-title">${attraction.title}</h3>
        <div class="attraction-price">${window.formatPrice ? window.formatPrice(attraction.price) : `${attraction.price}₽`}</div>
    
        <div class="attraction-specs">
          <div class="spec-item">
            <span class="spec-label">Мест:</span> <span class="spec-value">${places}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Мощность:</span> <span class="spec-value">${power}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Игры:</span> <span class="spec-value">${games}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Площадь:</span> <span class="spec-value">${area}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Размеры:</span> <span class="spec-value">${dimensions}</span>
          </div>
        </div>
        <div class="attraction-description">${attraction.description ? (attraction.description) : ''}</div>
        <!-- Кнопка перемещена вниз -->
        <div class="product-actions">
          <button class="btn-cart" data-id="${attraction.id}">В корзину</button>
        </div>
      </div>
    `;
    return card;
  }

  // --- Функция для настройки галереи конкретной карточки ---
  function setupGallery(cardElement, imagesArray) {
    if (imagesArray.length <= 1) return; // Нечего настраивать

    const mainImage = cardElement.querySelector('.attraction-main-image');
    const prevBtn = cardElement.querySelector('.attraction-gallery-nav.prev');
    const nextBtn = cardElement.querySelector('.attraction-gallery-nav.next');
    const thumbnailsContainer = cardElement.querySelector('.attraction-thumbnails');
    let currentIndex = 0;

    const updateGallery = (newIndex) => {
        if (newIndex < 0 || newIndex >= imagesArray.length) return;
        currentIndex = newIndex;
        const newImage = imagesArray[currentIndex];
        if (mainImage) {
            mainImage.src = newImage.url;
            mainImage.alt = newImage.alt || '';
            // Обработка ошибки загрузки для главного изображения
            mainImage.onerror = () => { mainImage.src = '/assets/icons/placeholder1.webp'; };
        }
        // Обновляем активную миниатюру
        cardElement.querySelectorAll('.attraction-thumbnail').forEach((thumb, i) => {
            thumb.classList.toggle('active', i === currentIndex);
        });
    };

    if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Предотвращаем всплытие клика
            updateGallery((currentIndex - 1 + imagesArray.length) % imagesArray.length);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Предотвращаем всплытие клика
            updateGallery((currentIndex + 1) % imagesArray.length);
        });
    }

    if (thumbnailsContainer) {
        thumbnailsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('attraction-thumbnail')) {
                e.stopPropagation(); // Предотвращаем всплытие клика
                const index = parseInt(e.target.dataset.index);
                if (!isNaN(index)) {
                    updateGallery(index);
                }
            }
        });
    }

    // Также можно добавить поддержку свайпов или клавиатуры, если нужно
  }

  // --- Rendering ---
  function renderAttractions() {
    // Проверка наличия контейнера
    if (!attractionsContainer) {
      console.error('Контейнер для аттракционов (#attractions-container) не найден в DOM');
      return;
    }

    // Очистка контейнера перед рендерингом
    attractionsContainer.innerHTML = '';

    // Проверка, были ли данные загружены
    if (!ATTRACTIONS || ATTRACTIONS.length === 0) {
      // Этот случай должен обрабатываться в loadAttractions, но на всякий случай
      console.warn('renderAttractions вызван, но данные ATTRACTIONS пусты или не определены.');
      return; // Просто выходим, если данных нет
    }

    // Получение текущего поискового запроса и категории
    const query = (searchInput?.value || '').toLowerCase().trim();
    // currentCategory определяется в handleCategoryClick и изначально 'все'

    // Фильтрация данных
    const filtered = ATTRACTIONS.filter(attraction => {
      const matchesCategory = currentCategory === 'все' || attraction.category === currentCategory;
      const matchesSearch = !query ||
        (attraction.title && attraction.title.toLowerCase().includes(query)) ||
        (attraction.description && attraction.description.toLowerCase().includes(query));

      return matchesCategory && matchesSearch;
    });

    // Отображение состояния "ничего не найдено"
    if (filtered.length === 0) {
      attractionsContainer.innerHTML = `
        <div class="empty">
          <div class="text-6xl">🔍</div>
          <h3>Аттракционы не найдены</h3>
          <p>Попробуйте изменить параметры поиска или фильтрации.</p>
        </div>
      `;
      return;
    }

    // Рендеринг карточек для отфильтрованных аттракционов
    filtered.forEach(attraction => {
      const card = createAttractionCard(attraction);
      attractionsContainer.appendChild(card);
      
      // Находим объект аттракциона по ID
      const attractionData = ATTRACTIONS.find(a => a.id == attraction.id);

      if (attractionData) {
        // Находим кнопку "В корзину" внутри этой карточки
        // Добавляем обработчик для кнопки корзины, если она есть (альтернативный способ, если не в main.js)
  const cartBtn = document.getElementById('cart-btn'); // <-- Опционально, если нужно здесь
  if (cartBtn) {
  cartBtn.addEventListener('click', () => {
       window.location.href = '/cart.html'; // <-- Перенаправление
     });
   }

        // Настройка галереи для этой карточки
        // Получаем массив изображений для этой карточки
        let imagesForThisCard = [];
        if (attractionData.images && Array.isArray(attractionData.images) && attractionData.images.length > 0) {
            imagesForThisCard = attractionData.images;
        } else if (attractionData.image) {
            imagesForThisCard = [{ url: attractionData.image, alt: attractionData.title || 'Изображение' }];
        } else {
            imagesForThisCard = [{ url: '/assets/icons/placeholder1.webp', alt: 'Нет изображения' }];
        }
        setupGallery(card, imagesForThisCard);
      } else {
        console.error(`Аттракцион с ID ${attraction.id} не найден в данных ATTRACTIONS при настройке галереи.`);
      }
    });
  }

  // --- Cart Functions (перенесены из state.js) ---
  // Получение корзины из localStorage
  function getCart() {
    const cart = localStorage.getItem('cart');
    return cart ? JSON.parse(cart) : [];
  }

  // Получение корзины из localStorage (использует ключ 'cart')
function getCart() {
  const cart = localStorage.getItem('cart'); // <-- Используем ключ 'cart'
  return cart ? JSON.parse(cart) : [];
}

// Добавление в корзину (использует ключ 'cart')
function addToCart(product) {
  console.log("attractions.js: Добавляем в корзину:", attractions.id, attractions.title); // <-- Новый лог
  const cart = getCart();
  const existingItem = cart.find(item => item.attractions.id === attractions.id);

  if (existingItem) {
    existingItem.qty += 1;
  } else {
    cart.push({ product, qty: 1 });
  }

  localStorage.setItem('cart', JSON.stringify(cart)); // <-- Используем ключ 'cart'
  updateCartCount(); // Обновляем счётчик
}

// Обновление количества в корзине (использует ключ 'cart')
function updateQuantity(attractionsId, change) {
  const cart = getCart();
  const item = cart.find(item => item.attractions.id === attractionsId);

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

// Очистка корзины (использует ключ 'cart')
function clearCart() {
  localStorage.removeItem('cart'); // <-- Используем ключ 'cart'
  updateCartCount();
}

// Обновление счетчика корзины
function updateCartCount() {
  const cart = getCart();
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartCountEls = document.querySelectorAll('#cart-count, #cart-count-header'); // Используем селекторы из state.js/main.js

  cartCountEls.forEach(el => {
    if (el) {
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none'; // Используем display: flex; как в state.js
    }
  });
}

  // --- Utility Functions (перенесены из utils.js) ---
  // Форматирование цены
  function formatPrice(price) {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
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

  // --- Modals (только корзина) ---
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
          // Обеспечиваем наличие изображения в данных корзины
          const imageUrl = item.product.image || 
                           (item.product.images && item.product.images[0] ? item.product.images[0].url : '/assets/icons/placeholder1.webp') ||
                           '/assets/icons/placeholder1.webp';
          const row = document.createElement('div');
          row.className = 'cart-item';
          row.innerHTML = `
            <img src="${imageUrl}" alt="" onerror="this.onerror=null; this.src='/assets/icons/placeholder1.webp';"/>
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
    // Проверяем, что jQuery и maskedinput доступны, и элемент существует
    if (typeof $ !== 'undefined' && $.fn.mask && phoneInput) {
      // Сначала удаляем любую существующую маску, чтобы избежать конфликтов
      $(phoneInput).unmask();
      // Применяем маску
      $(phoneInput).mask("+7 (999) 999-99-99", { placeholder: "+7 (___) ___-__-__" });
    } else {
      console.warn("jQuery, maskedinput или элемент #phone не найдены. Маска не применена.");
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
      } else {
        const closeButton = cartModal.querySelector('.modal-close');
        if (closeButton && typeof closeButton.focus === 'function') {
          closeButton.focus();
        } else {
          cartModal.setAttribute('tabindex', '-1');
          cartModal.focus();
        }
      }
    }, 0);
    if (typeof $ !== 'undefined' && $.fn.mask && phoneInput) {
      $(phoneInput).unmask();
      $(phoneInput).mask("+7 (999) 999-99-99", { placeholder: "+7 (___) ___-__-__" });
    } else {
      console.warn("jQuery, maskedinput или элемент #phone не найдены. Маска не применена.");
      if (phoneInput) {
         phoneInput.removeEventListener('input', sanitizePhoneInput);
         phoneInput.addEventListener('input', sanitizePhoneInput);
      }
    }
  }

  function sanitizePhoneInput(event) {
    event.target.value = event.target.value.replace(/[^0-9+]/g, '');
  }

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

  function closeModals() {
    const modal = document.querySelector('.modal.open');
    if (modal) modal.classList.remove('open');
    // Восстанавливаем позицию прокрутки
    const scrollY = document.body.getAttribute('data-scroll-position');
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('--scrollbar-width');
    document.body.style.removeProperty('top');
    if (scrollY) {
      window.scrollTo(0, parseInt(scrollY));
      document.body.removeAttribute('data-scroll-position');
    }
  }

  // --- Event Listeners ---
  function setupEventListeners() {
    // Поиск
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(renderAttractions, 300); // Debounce
      });
    }

    // Фильтрация по категориям
    if (categoryButtons.length > 0) {
      categoryButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          categoryButtons.forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');
          currentCategory = e.target.dataset.category || 'все';
          renderAttractions();
        });
      });
    }

    // Кнопка корзины
    if (cartBtn) {
        cartBtn.addEventListener('click', () => {
             const scrollY = window.scrollY || window.pageYOffset;
             document.body.setAttribute('data-scroll-position', scrollY);
             document.body.classList.add('modal-open');
             const scrollbarWidth = getScrollbarWidth();
             document.body.style.setProperty('--scrollbar-width', scrollbarWidth + 'px');
             document.body.style.top = `-${scrollY}px`;

             // Открываем модалку корзины
             openCartModal();
        });
    }

    // Обработчики для формы заказа
    phoneInput?.addEventListener('input', () => {
      phoneInput.value = phoneInput.value.replace(/[^0-9+]/g, '');
    });
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
         
          if (result.success) {
            clearCart();
            phoneInput.value = '';
            commentInput.value = '';
            successMessage.style.display = 'block';
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

    // Закрытие модалок
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', closeModals);
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModals();
            }
        });
    });
  }


})();