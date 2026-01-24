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
  let currentSort = 'default';
  let priceMin = null;
  let priceMax = null;

  // --- Инициализация ---
  document.addEventListener('DOMContentLoaded', async function () {
    console.log('Attractions page loaded');
    await loadAttractions(); // Загружаем данные
    populateFilters(); // Заполняем фильтры
    renderAttractions(); // Рендерим карточки
    setupEventListeners(); // Навешиваем обработчики
    updateCartCount(); // Обновляем счетчик корзины
    // Установка года
    if (yearSpan) {
      yearSpan.textContent = new Date().getFullYear();
    }
  });

  // --- Заполнение фильтров ---
  function populateFilters() {
    // Получаем уникальные категории
    const categories = [...new Set(ATTRACTIONS.map(a => a.category))].filter(Boolean);
    
    const categoryFiltersContainer = document.getElementById('category-filters');
    if (categoryFiltersContainer && categories.length > 0) {
      categoryFiltersContainer.innerHTML = categories.map(category => `
        <label class="filter-option">
          <input type="checkbox" class="filter-input" name="category" value="${category}" />
          <div class="filter-checkbox"></div>
          <span class="filter-label">${category}</span>
        </label>
      `).join('');
      
      // Обработчик изменения чекбоксов категорий
      categoryFiltersContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
          const selectedCategories = Array.from(
            categoryFiltersContainer.querySelectorAll('input[type="checkbox"]:checked')
          ).map(cb => cb.value);
          
          if (selectedCategories.length === 0) {
            currentCategory = 'все';
          } else {
            // Для множественного выбора создаем массив
            currentCategory = selectedCategories;
          }
          renderAttractions();
        });
      });
    }
  }

  // --- Data Loading ---
  async function loadAttractions() {
    // Всегда пытаемся загрузить данные с сервера
    try {
      console.log('Запрос аттракционов с сервера...');
      const response = await fetch('/api/attractions');

      if (!response.ok) {
        // Если статус не 2xx, генерируем ошибку
        const errorData = typeof window.safeJsonParse === 'function' 
            ? await window.safeJsonParse(response, { defaultValue: {}, silent: true })
            : await response.json().catch(() => ({}));
        throw new Error(`HTTP error! status: ${response.status}. ${errorData.error || ''} Details: ${errorData.details || ''}`);
      }

      // Используем безопасный парсинг JSON
      const data = typeof window.safeJsonParse === 'function' 
          ? await window.safeJsonParse(response, { defaultValue: [] })
          : await response.json().catch(() => []);
      
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
  // --- Функция для создания карточки аттракциона ---
function createAttractionCard(attraction) {
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
  card.className = 'attraction-card'; // Убедитесь, что класс остался тем же
  card.dataset.id = attraction.id; // Добавляем ID аттракциона как data-атрибут для обработчика

  card.innerHTML = `
    <div class="attraction-card-content"> <!-- Обертка для внутреннего содержимого -->
      <h3 class="attraction-title">${attraction.title}</h3>
      ${attraction.category === 'Готовые комплекты' ? '<div style="font-size: 0.8em; color: #888; margin-bottom: 5px;">Пак из 10 комплектов</div>' : ''}
      <div class="attraction-image-container">
        <img class="attraction-image" src="${imagesArray[0].url}" onerror="this.onerror=null; this.src='/assets/icons/placeholder1.webp';" alt="${imagesArray[0].alt || attraction.title}" />
      </div>
      <div class="attraction-price">${window.formatPrice ? window.formatPrice(attraction.price) : `${attraction.price}₽`}</div>
      <div class="product-actions">
        <button class="btn-details" data-id="${attraction.id}">Подробнее</button>
        <button class="btn-cart" data-id="${attraction.id}">В корзину</button>
      </div>
    </div>
  `;

  // --- НОВОЕ: Обработчик клика по всей карточке ---
  card.addEventListener('click', (event) => {
    // Проверяем, не был ли клик по кнопке "В корзину" или "Подробнее"
    // Если был клик по кнопке, событие всплывет до карточки, но мы его проигнорируем
    // потому что обработчики для кнопок будут добавлены отдельно и остановят всплытие
    // или будут выполнены первыми. Проверим тут, если клик НЕ по кнопке, то переходим.
    if (!event.target.classList.contains('btn-cart') && !event.target.classList.contains('btn-details')) {
      // Переход на страницу товара. Здесь нужно указать путь к детальной странице.
      // Предположим, что путь /product/:id
      window.location.href =  `/attraction/${attraction.slug}`; // ИСПОЛЬЗУЕМ SLUG
    }
  });

  // --- НОВОЕ: Обработчик кнопки "В корзину" ---
  const addToCartBtn = card.querySelector('.btn-cart');
  if (addToCartBtn) {
    addToCartBtn.addEventListener('click', (event) => {
      event.stopPropagation(); // Останавливаем всплытие, чтобы не сработал обработчик клика по карточке
      
      // Если товар уже в корзине, переходим на страницу корзины
      if (addToCartBtn.classList.contains('in-cart')) {
        window.location.href = '/cart';
        return;
      }
      
      // Если товара нет в корзине, добавляем его
      // addToCart теперь автоматически показывает мини-корзину и обновляет кнопку
      addToCart(attraction);
    });
  }

  // --- НОВОЕ: Обработчик кнопки "Подробнее" ---
  const detailsBtn = card.querySelector('.btn-details');
  if (detailsBtn) {
    detailsBtn.addEventListener('click', (event) => {
      event.stopPropagation(); // Останавливаем всплытие
      // Переход на страницу аттракциона по slug
      window.location.href = `/attraction/${attraction.slug}`;
    });
  }

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
    let filtered = ATTRACTIONS.filter(attraction => {
      // Фильтр по категориям (поддержка множественного выбора)
      let matchesCategory = false;
      if (currentCategory === 'все') {
        matchesCategory = true;
      } else if (Array.isArray(currentCategory)) {
        matchesCategory = currentCategory.includes(attraction.category);
      } else {
        matchesCategory = attraction.category === currentCategory;
      }
      
      const matchesSearch = !query ||
        (attraction.title && attraction.title.toLowerCase().includes(query)) ||
        (attraction.description && attraction.description.toLowerCase().includes(query));
      
      // Фильтр по цене
      const price = parseFloat(attraction.price) || 0;
      const matchesMinPrice = priceMin === null || price >= priceMin;
      const matchesMaxPrice = priceMax === null || price <= priceMax;

      return matchesCategory && matchesSearch && matchesMinPrice && matchesMaxPrice;
    });

    // Сортировка
    if (currentSort === 'price-asc') {
      filtered.sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0));
    } else if (currentSort === 'price-desc') {
      filtered.sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0));
    } else if (currentSort === 'name-asc') {
      filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (currentSort === 'name-desc') {
      filtered.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
    }

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

  // Добавление в корзину (использует ключ 'cart')
  // Если доступна глобальная функция из state.js, используем её
  function addToCart(product) {
    console.log("attractions.js: Вызов addToCart для товара:", product.id, product.title);
    
    // Если доступна глобальная функция из state.js, используем её
    if (typeof window.addToCart === 'function' && window.addToCart !== addToCart) {
      console.log("attractions.js: Используем глобальную функцию addToCart из state.js");
      return window.addToCart(product);
    }
    
    // Fallback: локальная реализация (для обратной совместимости)
    console.log("attractions.js: Используем локальную реализацию addToCart");
    const cart = getCart();
    const existingItem = cart.find(item => item.product.id === product.id);

    if (existingItem) {
      existingItem.qty += 1;
    } else {
      cart.push({ product, qty: 1 });
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    
    // Пытаемся вызвать функции из state.js, если они доступны
    if (typeof window.showMiniCart === 'function') {
      window.showMiniCart();
    }
    if (typeof window.updateCartButton === 'function') {
      window.updateCartButton(product.id);
    }
  }

  // Обновление количества в корзине (использует ключ 'cart')
  function updateQuantity(productId, change) { // Исправлено: было attractionsId
    const cart = getCart();
    const item = cart.find(item => item.product.id === productId); // Исправлено: было attractions.id

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

    // Фильтрация по категориям (старые кнопки)
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

    // Сортировка (десктопная версия)
    const sortSelect = document.getElementById('sort-select');
    const sortSelectMobile = document.getElementById('sort-select-mobile');
    
    // Функция для синхронизации сортировки
    const handleSortChange = (value) => {
      currentSort = value;
      // Синхронизируем оба селекта
      if (sortSelect) sortSelect.value = value;
      if (sortSelectMobile) sortSelectMobile.value = value;
      renderAttractions();
    };
    
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        handleSortChange(e.target.value);
      });
    }
    
    // Сортировка (мобильная версия)
    if (sortSelectMobile) {
      sortSelectMobile.addEventListener('change', (e) => {
        handleSortChange(e.target.value);
      });
    }

    // Аккордеон фильтров
    const filterGroups = document.querySelectorAll('.filter-group');
    filterGroups.forEach(group => {
      group.addEventListener('click', (e) => {
        // Проверяем, что клик был не внутри filter-group-content
        // (чтобы не закрывать при клике на чекбоксы или инпуты)
        const content = group.querySelector('.filter-group-content');
        if (content && content.contains(e.target)) {
          return; // Игнорируем клики внутри контента
        }
        
        const header = group.querySelector('.filter-group-header');
        if (!header) return;
        
        const isExpanded = header.getAttribute('aria-expanded') === 'true';
        
        // Закрываем все другие фильтры
        filterGroups.forEach(g => {
          if (g !== group) {
            const otherHeader = g.querySelector('.filter-group-header');
            const otherContent = g.querySelector('.filter-group-content');
            if (otherHeader) {
              otherHeader.setAttribute('aria-expanded', 'false');
            }
            if (otherContent) {
              otherContent.style.display = 'none';
            }
          }
        });
        
        // Переключаем текущий
        header.setAttribute('aria-expanded', !isExpanded);
        if (content) {
          content.style.display = !isExpanded ? 'block' : 'none';
        }
      });
    });

    // Закрытие фильтров при клике вне их
    document.addEventListener('click', (e) => {
      const clickedFilterGroup = e.target.closest('.filter-group');
      
      if (!clickedFilterGroup) {
        filterGroups.forEach(group => {
          const header = group.querySelector('.filter-group-header');
          const content = group.querySelector('.filter-group-content');
          if (header) {
            header.setAttribute('aria-expanded', 'false');
          }
          if (content) {
            content.style.display = 'none';
          }
        });
      }
    });

    // Фильтр по цене
    const priceMinInput = document.getElementById('price-min');
    const priceMaxInput = document.getElementById('price-max');
    
    if (priceMinInput) {
      priceMinInput.addEventListener('input', () => {
        priceMin = priceMinInput.value ? parseFloat(priceMinInput.value) : null;
        clearTimeout(renderProductsTimeout);
        renderProductsTimeout = setTimeout(renderAttractions, 500);
      });
    }
    
    if (priceMaxInput) {
      priceMaxInput.addEventListener('input', () => {
        priceMax = priceMaxInput.value ? parseFloat(priceMaxInput.value) : null;
        clearTimeout(renderProductsTimeout);
        renderProductsTimeout = setTimeout(renderAttractions, 500);
      });
    }

    // Кнопка сброса фильтров
    const resetFiltersBtn = document.getElementById('reset-filters');
    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener('click', () => {
        currentCategory = 'все';
        currentSort = 'default';
        priceMin = null;
        priceMax = null;
        
        if (priceMinInput) priceMinInput.value = '';
        if (priceMaxInput) priceMaxInput.value = '';
        if (sortSelect) sortSelect.value = 'default';
        if (searchInput) searchInput.value = '';
        
        // Сбрасываем чекбоксы категорий
        document.querySelectorAll('#category-filters input[type="checkbox"]').forEach(cb => cb.checked = false);
        
        renderAttractions();
      });
    }

    // Мобильные фильтры
    const mobileFiltersToggle = document.getElementById('mobile-filters-toggle');
    const filtersSidebar = document.getElementById('filters-sidebar');
    const filtersClose = document.getElementById('filters-close');
    
    if (mobileFiltersToggle && filtersSidebar) {
      mobileFiltersToggle.addEventListener('click', () => {
        filtersSidebar.classList.add('open');
        document.body.style.overflow = 'hidden';
      });
    }
    
    if (filtersClose && filtersSidebar) {
      filtersClose.addEventListener('click', () => {
        filtersSidebar.classList.remove('open');
        document.body.style.overflow = '';
      });
    }

    // Добавляем обработчик для кнопки корзины, если она есть (альтернативный способ, если не в main.js)
  const cartBtn = document.getElementById('cart-btn'); // <-- Опционально, если нужно здесь
  if (cartBtn) {
  cartBtn.addEventListener('click', () => {
       window.location.href = '/cart'; // <-- Перенаправление
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
          // Получаем CSRF токен
          const csrfToken = typeof getCsrfToken === 'function' ? await getCsrfToken() : null;
          if (!csrfToken) {
            sendOrderBtn.disabled = false;
            sendOrderBtn.textContent = 'Оформить заказ';
            isSending = false;
            alert('Не удалось получить CSRF токен. Пожалуйста, обновите страницу.');
            return;
          }
          
          const response = await fetch('/api/order', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
              phone: phoneInput.value,
              comment: commentInput.value,
              cart: getCart(),
              _csrf: csrfToken
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