// js/attractions.js

(function () {
  'use strict';

  // --- DOM Elements ---
  const attractionsContainer = document.getElementById('attractions-container');
  const searchInput = document.getElementById('search-input');
  const categoryButtons = document.querySelectorAll('.tag-btn');
  const attractionModal = document.getElementById('attraction-modal');
  const cartBtn = document.getElementById('cart-btn');
  const cartModal = document.getElementById('cart-modal');

  // --- State ---
  let currentCategory = 'все';
  let ATTRACTIONS = []; // Будет заполнен данными

  // --- Инициализация ---
  document.addEventListener('DOMContentLoaded', async function () {
    console.log('Attractions page loaded');
    await loadAttractions(); // Загружаем данные
    renderAttractions(); // Рендерим карточки
    setupEventListeners(); // Навешиваем обработчики
    if (window.updateCartCount) window.updateCartCount(); // Обновляем счетчик корзины (из state.js)
  });

  // --- Data Loading ---
  async function loadAttractions() {
    // Всегда пытаемся загрузить данные с сервера
    try {
      console.log('Запрос аттракционов с сервера...');
      const response = await fetch('/api/attractions');

      if (!response.ok) {
        // Если статус не 2xx, генерируем ошибку
        const errorData = await response.json().catch(() => ({})); // Пытаемся получить JSON ошибки
        throw new Error(`HTTP error! status: ${response.status}. ${errorData.error || ''} Details: ${errorData.details || ''}`);
      }

      const data = await response.json();
      console.log('Данные аттракционов успешно получены:', data);
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

  // --- Функция для создания карточки аттракциона ---
  // Эта функция должна быть определена здесь, выше, чем она используется
  function createAttractionCard(attraction) {
    // Извлекаем спецификации из объекта
    const specs = attraction.specs || {};
    const places = specs.places || 'N/A';
    const power = specs.power || 'N/A';
    const games = specs.games || 'N/A';
    const area = specs.area || 'N/A';
    const dimensions = specs.dimensions || 'N/A';

    const card = document.createElement('div');
    card.className = 'attraction-card';
    card.innerHTML = `
      <div class="attraction-image">
        <img src="${attraction.image}" onerror="this.onerror=null; this.src='/assets/placeholder.png';" alt="${attraction.title}" />
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
        <div class="attraction-description">${attraction.description ? (attraction.description.substring(0, 100) + (attraction.description.length > 100 ? '...' : '')) : ''}</div>
        <div class="product-actions">
          <button class="btn-details" data-id="${attraction.id}">Подробнее</button>
          <button class="btn-cart" data-id="${attraction.id}">В корзину</button>
        </div>
      </div>
    `;
    return card;
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
    // Используем функцию createAttractionCard, которая теперь определена выше
    filtered.forEach(attraction => {
      const card = createAttractionCard(attraction);
      attractionsContainer.appendChild(card);
    });

    // Навешивание обработчиков событий на вновь созданные элементы
    document.querySelectorAll('.attraction-card').forEach(card => {
      const detailsBtn = card.querySelector('.btn-details');
      const cartBtn = card.querySelector('.btn-cart');
      const attractionId = detailsBtn?.dataset.id || cartBtn?.dataset.id; // Получаем ID из кнопки

      // Находим объект аттракциона по ID
      const attraction = ATTRACTIONS.find(a => a.id == attractionId);

      if (attraction) { // Убедимся, что аттракцион найден
        if (detailsBtn) {
          // Предотвращаем всплытие клика с кнопки на карточку
          detailsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openAttractionModal(attraction); // Открытие модального окна
          });
        }

        if (cartBtn) {
          // Предотвращаем всплытие клика с кнопки на карточку
          cartBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Добавление в корзину (предполагается, что функция доступна глобально из state.js)
            if (window.addToCart) {
              window.addToCart(attraction);
              // Обновление счетчика корзины (предполагается, что функция доступна глобально из state.js)
              if (window.updateCartCount) window.updateCartCount();
            } else {
              console.error('Функция window.addToCart не найдена. Проверьте подключение state.js.');
            }
          });
        }

        // Клик по всей карточке открывает модальное окно
        card.addEventListener('click', () => openAttractionModal(attraction));
      } else {
        console.error(`Аттракцион с ID ${attractionId} не найден в данных ATTRACTIONS.`);
      }
    });
  }

  // --- Modals ---
  function openAttractionModal(attraction) {
    // Извлекаем спецификации из объекта
    const specs = attraction.specs || {};
    const places = specs.places || 'N/A';
    const power = specs.power || 'N/A';
    const games = specs.games || 'N/A';
    const area = specs.area || 'N/A';
    const dimensions = specs.dimensions || 'N/A';

    // Сохраняем позицию скролла
    const scrollY = window.scrollY || window.pageYOffset;
    document.body.setAttribute('data-scroll-position', scrollY);
    // Блокируем скролл, но сохраняем позицию
    document.body.classList.add('modal-open');
    // Убедитесь, что getScrollbarWidth доступна, или определите её здесь
    const scrollbarWidth = window.getScrollbarWidth ? window.getScrollbarWidth() : (function() {
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
    })();
    document.body.style.setProperty('--scrollbar-width', scrollbarWidth + 'px');
    document.body.style.top = `-${scrollY}px`;

    const titleElement = document.getElementById('attraction-title');
    const descriptionElement = document.getElementById('attraction-description');
    const priceElement = document.getElementById('attraction-price');
    const mainImageElement = document.getElementById('attraction-main-image');
    const specsContainer = document.getElementById('attraction-specs'); // Используем существующий контейнер
    const thumbnailsContainer = document.getElementById('attraction-thumbnails');
    const addToCartBtn = document.getElementById('add-attraction-to-cart-btn');
    const buyNowBtn = document.getElementById('buy-attraction-now-btn');

    if (titleElement) titleElement.textContent = attraction.title;
    if (descriptionElement) descriptionElement.textContent = attraction.description || '';
    if (priceElement) priceElement.textContent = window.formatPrice ? window.formatPrice(attraction.price) : `${attraction.price}₽`;
    if (mainImageElement) {
        mainImageElement.src = attraction.image;
        mainImageElement.alt = attraction.title;
        mainImageElement.onerror = function() {
            this.onerror = null;
            this.src = '/assets/placeholder.png';
        };
    }

    // Рендерим спецификации в модальном окне
    if (specsContainer) {
        specsContainer.innerHTML = `
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
        `;
    }

    // Упрощенный вариант для миниатюр - просто показываем главное изображение
    if (thumbnailsContainer) {
        thumbnailsContainer.innerHTML = '';
        const thumb = document.createElement('img');
        thumb.src = attraction.image;
        thumb.alt = `Миниатюра ${attraction.title}`;
        thumb.className = 'thumbnail active';
        thumb.onerror = function() {
            this.onerror = null;
            this.src = '/assets/placeholder.png';
        };
        thumb.addEventListener('click', () => {
             if(mainImageElement) {
                 mainImageElement.src = attraction.image;
                 document.querySelectorAll('#attraction-thumbnails .thumbnail').forEach(t => t.classList.remove('active'));
                 thumb.classList.add('active');
             }
        });
        thumbnailsContainer.appendChild(thumb);
    }

    if (addToCartBtn) {
        addToCartBtn.dataset.id = attraction.id;
        addToCartBtn.onclick = () => {
            if (window.addToCart) {
                window.addToCart(attraction);
            }
            if (window.updateCartCount) {
                window.updateCartCount();
            }
             closeModals();
        };
    }

    if (buyNowBtn) {
        buyNowBtn.dataset.id = attraction.id;
        buyNowBtn.onclick = () => {
            if (window.addToCart) {
                window.addToCart(attraction);
            }
            if (window.updateCartCount) {
                window.updateCartCount();
            }
            closeModals();
            if (cartBtn) cartBtn.click();
        };
    }

    if (attractionModal) {
        attractionModal.classList.add('open');
        attractionModal.setAttribute('aria-hidden', 'false');
    }
  }

  function closeModals() {
    const openModal = document.querySelector('.modal.open');
    if (openModal) openModal.classList.remove('open');

    // Восстанавливаем позицию скролла
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
             const scrollbarWidth = window.getScrollbarWidth ? window.getScrollbarWidth() : 0;
             document.body.style.setProperty('--scrollbar-width', scrollbarWidth + 'px');
             document.body.style.top = `-${scrollY}px`;

             // Открываем модалку корзины
             if (window.openCartModal) {
                 window.openCartModal();
             } else if(cartModal) {
                 cartModal.classList.add('open');
                 cartModal.setAttribute('aria-hidden', 'false');
             } else {
                 console.warn('Не найдена функция openCartModal или элемент cartModal');
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