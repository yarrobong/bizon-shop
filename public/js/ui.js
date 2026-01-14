// ui.js
// DOM-элементы (только для главной/каталога)
const productsContainer = document.getElementById('products');
const searchInput = document.getElementById('search-input');
const categoryButtons = document.querySelectorAll('.tag-btn');
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

// Форматирование цены
function formatPrice(price) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
}

// Функция генерации slug из названия товара
function generateSlug(title) {
  return encodeURIComponent(
    title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
  );
}

// Получение корзины из localStorage (использует ключ 'cart')
function getCart() {
  const cart = localStorage.getItem('cart'); // <-- Используем ключ 'cart'
  return cart ? JSON.parse(cart) : [];
}

// Добавление в корзину (использует ключ 'cart')
// Если доступна глобальная функция из state.js, используем её
function addToCart(product) {
  console.log("ui.js: Вызов addToCart для товара:", product.id, product.title);
  
  // Если доступна глобальная функция из state.js, используем её
  if (typeof window.addToCart === 'function' && window.addToCart !== addToCart) {
    console.log("ui.js: Используем глобальную функцию addToCart из state.js");
    return window.addToCart(product);
  }
  
  // Fallback: локальная реализация (для обратной совместимости)
  console.log("ui.js: Используем локальную реализацию addToCart");
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

// Глобальные переменные для фильтров и сортировки
let ALL_PRODUCTS = [];
let useLocalData = false;

// Переменные для пагинации
let currentPage = 1;
let isLoading = false;
let hasMorePages = true;
const PRODUCTS_PER_PAGE = 20;

// Получение активных фильтров
function getActiveFilters() {
  const filters = {
    categories: Array.from(document.querySelectorAll('input[name="category"]:checked')).map(cb => cb.value),
    priceMin: parseFloat(document.getElementById('price-min')?.value) || 0,
    priceMax: parseFloat(document.getElementById('price-max')?.value) || Infinity,
    brands: Array.from(document.querySelectorAll('input[name="brand"]:checked')).map(cb => cb.value),
    tags: Array.from(document.querySelectorAll('input[name="tag"]:checked')).map(cb => cb.value),
  };
  return filters;
}

// Получение типа сортировки
function getSortType() {
  // Проверяем оба select (мобильный и десктопный)
  const desktopSelect = document.getElementById('sort-select');
  const mobileSelect = document.getElementById('sort-select-mobile');
  return desktopSelect?.value || mobileSelect?.value || 'default';
}

// Применение фильтров
function applyFilters(products) {
  const filters = getActiveFilters();
  const query = (searchInput?.value || '').toLowerCase();

  return products.filter(p => {
    // Доступность
    if (p.available === false) return false;

    // Категория (если выбраны категории, фильтруем по ним, иначе показываем все)
    if (filters.categories.length > 0 && (!p.category || !filters.categories.includes(p.category))) return false;

    // Цена
    if (p.price < filters.priceMin || p.price > filters.priceMax) return false;

    // Бренд
    if (filters.brands.length > 0 && (!p.brand || !filters.brands.includes(p.brand))) return false;

    // Теги
    if (filters.tags.length > 0) {
      const productTag = p.tag ? p.tag.toLowerCase().trim() : '';
      if (!productTag) return false; // Если у товара нет тега, пропускаем при фильтрации по тегам
      
      // Проверяем, совпадает ли тег товара с выбранными фильтрами
      const matches = filters.tags.some(filterTag => {
        const normalizedFilterTag = filterTag.toLowerCase().trim();
        // Точное совпадение
        if (productTag === normalizedFilterTag) return true;
        // Частичное совпадение (для случаев типа "скидка" и "акция")
        if (productTag.includes(normalizedFilterTag) || normalizedFilterTag.includes(productTag)) return true;
        return false;
      });
      
      if (!matches) return false;
    }

    // Поиск
    if (query) {
      const titleMatch = p.title.toLowerCase().includes(query);
      const descMatch = p.description && p.description.toLowerCase().includes(query);
      if (!titleMatch && !descMatch) return false;
    }

    return true;
  });
}

// Применение сортировки
function applySort(products) {
  const sortType = getSortType();
  const sorted = [...products];

  switch (sortType) {
    case 'price-asc':
      return sorted.sort((a, b) => a.price - b.price);
    case 'price-desc':
      return sorted.sort((a, b) => b.price - a.price);
    case 'name-asc':
      return sorted.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    case 'name-desc':
      return sorted.sort((a, b) => b.title.localeCompare(a.title, 'ru'));
    case 'newest':
      return sorted.sort((a, b) => {
        const aIsNew = a.tag && a.tag.toLowerCase().includes('новинка');
        const bIsNew = b.tag && b.tag.toLowerCase().includes('новинка');
        if (aIsNew && !bIsNew) return -1;
        if (!aIsNew && bIsNew) return 1;
        return 0;
      });
    default:
      return sorted;
  }
}

// Заполнение фильтров по брендам
function populateBrandFilters(products) {
  const brandFiltersContainer = document.getElementById('brand-filters');
  if (!brandFiltersContainer || brandFiltersContainer.dataset.populated === 'true') return;

  const brands = [...new Set(products.map(p => p.brand).filter(Boolean))].sort();
  
  brandFiltersContainer.innerHTML = brands.map(brand => `
    <label class="filter-option">
      <input type="checkbox" name="brand" value="${brand}" class="filter-input">
      <span class="filter-checkbox"></span>
      <span class="filter-label">${brand}</span>
    </label>
  `).join('');

  // Отмечаем, что фильтры заполнены
  brandFiltersContainer.dataset.populated = 'true';

  // Добавляем обработчики для новых чекбоксов
  brandFiltersContainer.querySelectorAll('input[name="brand"]').forEach(input => {
    input.addEventListener('change', () => renderProducts(true));
  });
}

function populateTagFilters(products) {
  const tagFiltersContainer = document.getElementById('tag-filters');
  if (!tagFiltersContainer || tagFiltersContainer.dataset.populated === 'true') return;

  // Получаем только те теги, которые реально есть у товаров
  const tags = [...new Set(products.map(p => p.tag).filter(Boolean))].sort();
  
  // Маппинг тегов на читаемые названия
  const tagLabels = {
    'новинка': 'Новинка',
    'хит': 'Хит',
    'скидка': 'Скидка',
    'акция': 'Акция',
    'стандарт': 'Стандарт',
    'премиум': 'Премиум',
    'эксклюзив': 'Эксклюзив'
  };
  
  tagFiltersContainer.innerHTML = tags.map(tag => {
    const label = tagLabels[tag.toLowerCase()] || tag;
    return `
      <label class="filter-option">
        <input type="checkbox" name="tag" value="${tag}" class="filter-input">
        <span class="filter-checkbox"></span>
        <span class="filter-label">${label}</span>
      </label>
    `;
  }).join('');

  // Отмечаем, что фильтры заполнены
  tagFiltersContainer.dataset.populated = 'true';

  // Добавляем обработчики для новых чекбоксов
  tagFiltersContainer.querySelectorAll('input[name="tag"]').forEach(input => {
    input.addEventListener('change', () => renderProducts(true));
  });
}

function populateCategoryFilters(products) {
  const categoryFiltersContainer = document.getElementById('category-filters');
  if (!categoryFiltersContainer || categoryFiltersContainer.dataset.populated === 'true') return;

  // Получаем только те категории, которые реально есть у товаров
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
  
  categoryFiltersContainer.innerHTML = categories.map(category => `
    <label class="filter-option">
      <input type="checkbox" name="category" value="${category}" class="filter-input">
      <span class="filter-checkbox"></span>
      <span class="filter-label">${category}</span>
    </label>
  `).join('');

  // Отмечаем, что фильтры заполнены
  categoryFiltersContainer.dataset.populated = 'true';

  // Добавляем обработчики для новых чекбоксов
  categoryFiltersContainer.querySelectorAll('input[name="category"]').forEach(input => {
    input.addEventListener('change', () => {
      // При изменении фильтров сбрасываем пагинацию
      ALL_PRODUCTS = [];
      currentPage = 1;
      hasMorePages = true;
      loadProducts(1, true);
    });
  });
}

// Загрузка товаров с сервера с пагинацией
async function loadProducts(page = 1, reset = false) {
  if (isLoading) return;
  if (!hasMorePages && page > 1) return;
  
  isLoading = true;
  
  try {
    const res = await fetch(`/api/products?page=${page}&limit=${PRODUCTS_PER_PAGE}`);
    if (!res.ok) {
      throw new Error('Не удалось загрузить товары');
    }
    
    const data = await res.json();
    
    // Проверяем формат ответа (новый с пагинацией или старый массив)
    let products = [];
    let pagination = null;
    
    if (data.products && Array.isArray(data.products)) {
      // Новый формат с пагинацией
      products = data.products;
      pagination = data.pagination;
      hasMorePages = pagination && pagination.hasNextPage === true;
      
      // Если загрузили меньше товаров, чем запросили - значит это последняя страница
      if (products.length < PRODUCTS_PER_PAGE) {
        hasMorePages = false;
      }
    } else if (Array.isArray(data)) {
      // Старый формат (массив) - для обратной совместимости
      products = data;
      hasMorePages = false;
    } else {
      throw new Error('Неверный формат ответа сервера');
    }
    
    if (reset) {
      ALL_PRODUCTS = [];
      currentPage = 1;
      if (productsContainer) {
        productsContainer.innerHTML = '';
      }
    }
    
    if (products.length === 0 && ALL_PRODUCTS.length === 0) {
      console.warn('Сервер вернул пустой массив товаров, используем локальные данные');
      ALL_PRODUCTS = LOCAL_PRODUCTS;
      useLocalData = true;
      hasMorePages = false;
    } else {
      ALL_PRODUCTS = [...ALL_PRODUCTS, ...products];
      currentPage = page;
      
      // Дополнительная проверка: если загрузили 0 товаров и это не первая страница - больше страниц нет
      if (products.length === 0 && page > 1) {
        hasMorePages = false;
      }
    }
    
    // Заполняем фильтры только при первой загрузке
    if (ALL_PRODUCTS.length === products.length || reset) {
      populateBrandFilters(ALL_PRODUCTS);
      populateTagFilters(ALL_PRODUCTS);
      populateCategoryFilters(ALL_PRODUCTS);
    }
    
    // Рендерим товары
    renderProducts();
    
    // Обновляем кнопку "Загрузить еще"
    updateLoadMoreButton();
    
  } catch (err) {
    console.error('Ошибка загрузки товаров с сервера:', err);
    if (ALL_PRODUCTS.length === 0) {
      console.warn('Используем локальные данные как резервный вариант');
      ALL_PRODUCTS = LOCAL_PRODUCTS;
      useLocalData = true;
      hasMorePages = false;
      renderProducts();
    }
  } finally {
    isLoading = false;
  }
}

// Создание кнопки "Загрузить еще"
function createLoadMoreButton() {
  const existingButton = document.getElementById('load-more-btn');
  if (existingButton) return existingButton;
  
  const button = document.createElement('button');
  button.id = 'load-more-btn';
  button.className = 'load-more-btn';
  button.textContent = 'Загрузить еще';
  button.style.cssText = `
    display: block;
    margin: 2rem auto;
    padding: 1rem 2rem;
    font-size: 1rem;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(0, 0, 0, 0));
    border: 2px solid rgba(59, 130, 246, 1);
    color: rgba(59, 130, 246, 1);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
  `;
  
  button.addEventListener('click', () => {
    if (!isLoading && hasMorePages) {
      loadProducts(currentPage + 1);
    }
  });
  
  button.addEventListener('mouseenter', () => {
    button.style.background = 'rgba(59, 130, 246, 0.25)';
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(0, 0, 0, 0))';
  });
  
  if (productsContainer) {
    productsContainer.parentNode.appendChild(button);
  }
  
  return button;
}

// Обновление кнопки "Загрузить еще"
function updateLoadMoreButton() {
  const button = document.getElementById('load-more-btn');
  
  // Если товары закончились, скрываем кнопку
  if (!hasMorePages || useLocalData) {
    if (button) {
      button.style.display = 'none';
    }
    return;
  }
  
  // Если кнопки нет, но есть еще страницы - создаем её
  if (!button) {
    createLoadMoreButton();
    return;
  }
  
  // Обновляем состояние кнопки
  if (isLoading) {
    button.textContent = 'Загрузка...';
    button.disabled = true;
    button.style.display = 'block';
  } else {
    button.textContent = 'Загрузить еще';
    button.disabled = false;
    button.style.display = 'block';
  }
}

// Асинхронная загрузка и рендеринг товаров
async function renderProducts(resetPagination = false) {
  if (renderProductsTimeout) {
    clearTimeout(renderProductsTimeout);
  }

  renderProductsTimeout = setTimeout(() => {
    // Загружаем первую страницу, если товары еще не загружены
    if (ALL_PRODUCTS.length === 0 && !isLoading) {
      loadProducts(1, true);
      return;
    }

    // Применяем фильтры и сортировку к уже загруженным товарам
    let filtered = applyFilters(ALL_PRODUCTS);
    filtered = applySort(filtered);

    // Отображение товаров
    if (!productsContainer) return;

    // Очищаем контейнер при фильтрации/сортировке или при сбросе пагинации
    const hasActiveFilters = document.getElementById('search-input')?.value ||
                             document.querySelectorAll('input:checked').length > 0 ||
                             getSortType() !== 'default';
    
    if (resetPagination || hasActiveFilters) {
      productsContainer.innerHTML = '';
    }

    if (filtered.length === 0 && ALL_PRODUCTS.length > 0) {
      productsContainer.innerHTML = `
        <div class="empty">
          <div class="text-6xl">🔍</div>
          <h3>Товары не найдены</h3>
          <p>Попробуйте изменить параметры поиска или фильтры</p>
          ${useLocalData ? '<small class="text-muted">Отображаются локальные данные</small>' : ''}
        </div>
      `;
      return;
    }

    // Рендеринг карточек (только новых, если это пагинация)
    const existingIds = new Set(Array.from(productsContainer.querySelectorAll('.product-card'))
      .map(card => card.dataset.productId));
    
    filtered.forEach((product) => {
      // Пропускаем уже отображенные товары при пагинации
      if (existingIds.has(String(product.id))) return;
      
      const card = document.createElement('div');
      card.className = 'product-card';
      card.dataset.productId = product.id;
      
      // Формируем плашки для совместимости (креплений)
      let compatibilityBadges = '';
      if (product.compatibility) {
        // Если compatibility - это строка, разбиваем по запятой или используем как есть
        const compatibilities = typeof product.compatibility === 'string' 
          ? product.compatibility.split(',').map(c => c.trim()).filter(c => c)
          : Array.isArray(product.compatibility) 
            ? product.compatibility 
            : [];
        
        if (compatibilities.length > 0) {
          const compatibilityText = compatibilities.join(', ');
          compatibilityBadges = '<div class="product-compatibility-badges">' +
            `<span class="compatibility-badge">Для ${compatibilityText}</span>` +
            '</div>';
        }
      }
      
      card.innerHTML = `
        <div class="product-content">
          <h3 class="product-title">${product.title}</h3>
          <div class="product-image">
            <img src="${product.images[0]?.url?.trim() || '/assets/icons/placeholder1.webp'}" alt="${product.title}" />
            ${product.tag ? `<div class="product-badge" data-tag="${product.tag.toLowerCase()}">${product.tag}</div>` : ''}
            ${compatibilityBadges}
          </div>
          <div class="product-footer">
            <div class="product-price">${formatPrice(product.price)}</div>
            <div class="product-actions">
             <button class="btn-details" data-id="${product.id}" data-slug="${product.slug}">Подробнее</button>
              <button class="btn-cart" data-id="${product.id}">В корзину</button>
            </div>
          </div>
        </div>
      `;
      productsContainer.appendChild(card);
    });

    // Обработчики для кликов по всей карточке товара (только для новых карточек)
    productsContainer.querySelectorAll('.product-card:not([data-handlers-attached])').forEach(card => {
      card.dataset.handlersAttached = 'true';
      
      card.addEventListener('click', (event) => {
        if (event.target.classList.contains('btn-cart')) return;
        if (event.target.classList.contains('btn-details')) return;

        const buttonDetails = card.querySelector('.btn-details');
        if (!buttonDetails) return;
        const slug = buttonDetails.dataset.slug;
        if (slug) {
          window.location.href = `/product/${slug}`;
        }
      });
    });

    // Обработчики для кнопок "Подробнее" (только для новых)
    productsContainer.querySelectorAll('.btn-details:not([data-handler-attached])').forEach(button => {
      button.dataset.handlerAttached = 'true';
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const slug = button.dataset.slug;
        window.location.href = `/product/${slug}`;
      });
    });

    // Обработчики для кнопок "В корзину" (только для новых)
    productsContainer.querySelectorAll('.btn-cart:not([data-cart-handler-attached])').forEach(button => {
      button.dataset.cartHandlerAttached = 'true';
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const productId = parseInt(button.dataset.id);
        const product = ALL_PRODUCTS.find(p => p.id === productId);
        
        if (!product) return;
        
        // Если товар уже в корзине, переходим на страницу корзины
        if (button.classList.contains('in-cart')) {
          window.location.href = '/cart';
          return;
        }
        
        // Если товара нет в корзине, добавляем его
        addToCart(product);
      });
    });
    
    // Обновляем все кнопки корзины при рендеринге товаров
    if (typeof window.updateAllCartButtons === 'function') {
      window.updateAllCartButtons();
    }


    // Добавляем визуальный индикатор, если используются локальные данные
    if (useLocalData) {
      const existingIndicator = document.querySelector('.local-data-indicator');
      if (!existingIndicator) {
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

        setTimeout(() => {
          if (indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
          }
        }, 5000);
      }
    }

  }, 300);
}

// Сброс фильтров
function resetFilters() {
  // Сбрасываем категории (убираем checked со всех чекбоксов - показываем все категории)
  document.querySelectorAll('input[name="category"]').forEach(checkbox => {
    checkbox.checked = false;
  });

  // Сбрасываем цену
  const priceMin = document.getElementById('price-min');
  const priceMax = document.getElementById('price-max');
  if (priceMin) priceMin.value = '';
  if (priceMax) priceMax.value = '';

  // Сбрасываем бренды
  document.querySelectorAll('input[name="brand"]').forEach(cb => cb.checked = false);

  // Сбрасываем теги
  document.querySelectorAll('input[name="tag"]').forEach(cb => cb.checked = false);

  // Сбрасываем сортировку
  const sortSelect = document.getElementById('sort-select');
  const sortSelectMobile = document.getElementById('sort-select-mobile');
  if (sortSelect) sortSelect.value = 'default';
  if (sortSelectMobile) sortSelectMobile.value = 'default';

  renderProducts();
}

// Управление мобильными фильтрами
function setupMobileFilters() {
  const filtersToggle = document.getElementById('mobile-filters-toggle');
  const filtersSidebar = document.getElementById('filters-sidebar');
  const filtersOverlay = document.getElementById('filters-overlay');
  const filtersClose = document.getElementById('filters-close');

  function openFilters() {
    filtersSidebar?.classList.add('active');
    filtersOverlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeFilters() {
    filtersSidebar?.classList.remove('active');
    filtersOverlay?.classList.remove('active');
    document.body.style.overflow = '';
  }

  filtersToggle?.addEventListener('click', openFilters);
  filtersClose?.addEventListener('click', closeFilters);
  filtersOverlay?.addEventListener('click', closeFilters);
}

// Привязка событий (только для главной/каталога)
function setupEventListeners() {
  const searchInput = document.getElementById('search-input');

  if (searchInput) {
    searchInput.removeEventListener('input', renderProducts);
    searchInput.addEventListener('input', renderProducts);
  }

  // Обработчики для фильтров категорий
  document.querySelectorAll('input[name="category"]').forEach(input => {
    input.addEventListener('change', renderProducts);
  });

  // Обработчики для фильтров по цене
  const priceMin = document.getElementById('price-min');
  const priceMax = document.getElementById('price-max');
  if (priceMin) {
    priceMin.addEventListener('input', renderProducts);
    priceMin.addEventListener('blur', renderProducts);
  }
  if (priceMax) {
    priceMax.addEventListener('input', renderProducts);
    priceMax.addEventListener('blur', renderProducts);
  }

  // Обработчики для фильтров по тегам
  document.querySelectorAll('input[name="tag"]').forEach(input => {
    input.addEventListener('change', renderProducts);
  });

  // Обработчик для сортировки (десктоп и мобильная версия)
  const sortSelect = document.getElementById('sort-select');
  const sortSelectMobile = document.getElementById('sort-select-mobile');
  
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      // Синхронизируем значение с мобильной версией
      if (sortSelectMobile) {
        sortSelectMobile.value = sortSelect.value;
      }
      renderProducts();
    });
  }
  
  if (sortSelectMobile) {
    sortSelectMobile.addEventListener('change', () => {
      // Синхронизируем значение с десктопной версией
      if (sortSelect) {
        sortSelect.value = sortSelectMobile.value;
      }
      renderProducts();
    });
  }

  // Обработчик для кнопки сброса фильтров
  const resetBtn = document.getElementById('reset-filters');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetFilters);
  }

  // Добавляем обработчик для кнопки корзины
  const cartBtn = document.getElementById('cart-btn');
  if (cartBtn) {
    cartBtn.addEventListener('click', () => {
      window.location.href = '/cart';
    });
  }

  // Настройка мобильных фильтров
  setupMobileFilters();
  
  // Настройка аккордеона для групп фильтров
  setupFilterAccordion();
}

// Настройка аккордеона для групп фильтров
function setupFilterAccordion() {
  const filterGroupHeaders = document.querySelectorAll('.filter-group-header');
  
  filterGroupHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const isExpanded = header.getAttribute('aria-expanded') === 'true';
      const content = header.nextElementSibling;
      
      if (isExpanded) {
        header.setAttribute('aria-expanded', 'false');
        if (content) {
          content.style.display = 'none';
        }
      } else {
        header.setAttribute('aria-expanded', 'true');
        if (content) {
          content.style.display = 'block';
        }
      }
    });
  });
}

// Бесконечная прокрутка
function setupInfiniteScroll() {
  let scrollTimeout;
  let lastScrollCheck = 0;
  
  window.addEventListener('scroll', () => {
    // Ограничиваем частоту проверок (не чаще раза в 200ms)
    const now = Date.now();
    if (now - lastScrollCheck < 200) {
      return;
    }
    lastScrollCheck = now;
    
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }
    
    scrollTimeout = setTimeout(() => {
      // Если нет больше страниц или идет загрузка - не проверяем
      if (!hasMorePages || isLoading || useLocalData) {
        return;
      }
      
      // Проверяем, достигли ли мы конца страницы
      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const clientHeight = window.innerHeight;
      
      // Загружаем следующую страницу, если осталось менее 500px до конца
      if (scrollHeight - scrollTop - clientHeight < 500) {
        loadProducts(currentPage + 1);
      }
    }, 100);
  });
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
  window.currentCategory = 'все';
  setupEventListeners();
  setupInfiniteScroll();
  createLoadMoreButton();
  await renderProducts();
  updateCartCount();
});

// Экспорт (только функции, не связанные с модальными окнами)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderProducts, setupEventListeners, getCart, addToCart, updateQuantity, clearCart, updateCartCount, formatPrice, generateSlug };
} else {
  window.renderProducts = renderProducts;
  window.setupEventListeners = setupEventListeners;

  // Экспортируем функции корзины
  window.getCart = getCart;
  window.addToCart = addToCart;
  window.updateQuantity = updateQuantity;
  window.clearCart = clearCart;
  window.updateCartCount = updateCartCount;
  window.formatPrice = formatPrice; // Если нужно глобально
  window.generateSlug = generateSlug;
}