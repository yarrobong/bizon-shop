// js/productAttractions.js

document.addEventListener('DOMContentLoaded', async function () {
    const path = window.location.pathname; // Например, "/attraction/nazvanie_attrakciona"
    const pathSegments = path.split('/').filter(segment => segment !== ''); // Убираем пустые сегменты

    let itemData = null;
    let isAttractionPage = false;

    if (pathSegments.length >= 2 && pathSegments[0] === 'attraction') {
        // Это страница аттракциона
        isAttractionPage = true;
        const slug = pathSegments[1]; // "nazvanie_attrakciona"
        console.log('Загрузка аттракциона по slug:', slug);

        try {
            // Загрузка данных конкретного аттракциона по slug
            const response = await fetch(`/api/attractions/slug/${slug}`); // ИСПОЛЬЗУЕМ НОВЫЙ ENDPOINT

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Аттракцион не найден.');
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            }

            itemData = await response.json();
            console.log('Данные аттракциона:', itemData);

        } catch (error) {
            console.error('Ошибка загрузки данных аттракциона:', error);
            document.querySelector('.product-page-container').innerHTML = `<p>${error.message}</p>`;
            // Убедимся, что сплеш-скрин скрыт даже при ошибке
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                loadingScreen.style.display = 'none';
            }
            return;
        }
    } else if (pathSegments.length >= 2 && pathSegments[0] === 'product') {
        // Это страница товара (реализуйте аналогично, если нужно)
        // ... (ваша текущая логика для /product/:slug, если есть) ...
        // Пока что просто покажем ошибку, если /product/:slug не реализован
        console.warn('Страница /product/:slug не реализована в этом примере.');
        document.querySelector('.product-page-container').innerHTML = '<p>Страница товара не найдена.</p>';
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        return;
    } else {
        // Неверный путь
        console.error('Неверный путь для страницы товара/аттракциона');
        document.querySelector('.product-page-container').innerHTML = '<p>Неверный путь.</p>';
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        return;
    }

    if (!itemData) {
        console.error('Данные аттракциона не были загружены');
        document.querySelector('.product-page-container').innerHTML = '<p>Ошибка загрузки данных.</p>';
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        return;
    }

    // --- СКРЫВАЕМ СПЛЕШ-СКРИН ---
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }

    // --- Заполнение страницы информацией об аттракционе ---
    // Основное изображение или видео
    const mainImageContainer = document.querySelector('.product-page-image'); // Или отдельный контейнер для видео/изображения
    if (mainImageContainer) {
        mainImageContainer.innerHTML = ''; // Очищаем

        let mediaElement = null;
        // Проверяем, есть ли главное (primary) видео
        const primaryVideo = itemData.videos?.find(v => v.is_primary);
        if (primaryVideo) {
            // Создаем тег <video>
            mediaElement = document.createElement('video');
            mediaElement.controls = true; // Показываем элементы управления
            mediaElement.preload = "metadata"; // Загружаем метаданные для отображения превью
            mediaElement.playsInline = true; // Полезно для мобильных
            // Устанавливаем превью (poster) на первое изображение, если оно есть
            if (itemData.images && itemData.images.length > 0) {
                mediaElement.poster = itemData.images[0].url;
            } else {
                mediaElement.poster = '/assets/icons/placeholder1.webp';
            }
            const source = document.createElement('source');
            source.src = primaryVideo.url;
            // Попробуйте определить тип на основе URL или храните тип в БД
            // source.type = 'video/mp4'; // Укажите тип, соответствующий вашему формату, если известен
            mediaElement.appendChild(source);
            mediaElement.alt = primaryVideo.alt || itemData.title || 'Видео аттракциона';
        } else if (itemData.images && itemData.images.length > 0) {
            // Если видео нет, используем первое изображение
            mediaElement = document.createElement('img');
            mediaElement.src = itemData.images[0].url;
            mediaElement.alt = itemData.images[0].alt || itemData.title || 'Изображение аттракциона';
            mediaElement.onerror = () => { mediaElement.src = '/assets/icons/placeholder1.webp'; };
        } else {
            // Если нет ни видео, ни изображений
            mediaElement = document.createElement('img');
            mediaElement.src = '/assets/icons/placeholder1.webp';
            mediaElement.alt = 'Нет изображения';
        }

        if (mediaElement) {
            mainImageContainer.appendChild(mediaElement);
        }
    } else {
         console.error('❌ Контейнер .product-page-image не найден в DOM');
    }

    // --- НОВОЕ: Отображение миниатюр (изображений и видео) ---
    const thumbnailsContainer = document.getElementById('product-page-thumbnails'); // Убедитесь, что ID правильный
    if (thumbnailsContainer) {
        thumbnailsContainer.innerHTML = ''; // Очищаем

        // Объединяем изображения и видео для галереи
        const allMedia = [];
        if (itemData.images && itemData.images.length > 0) {
            itemData.images.forEach(img => {
                allMedia.push({ type: 'image', ...img });
            });
        }
        if (itemData.videos && itemData.videos.length > 0) {
            itemData.videos.forEach(vid => {
                allMedia.push({ type: 'video', ...vid });
            });
        }

        // Сортируем по sort_order, если поле есть, иначе порядок добавления
        allMedia.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

        allMedia.forEach((media, index) => {
            const thumbDiv = document.createElement('div');
            thumbDiv.className = 'product-page-thumbnail';
            if (index === 0) thumbDiv.classList.add('active'); // Первая миниатюра активна

            if (media.type === 'image') {
                const thumbImg = document.createElement('img');
                thumbImg.src = media.url;
                thumbImg.alt = media.alt || 'Миниатюра';
                thumbImg.dataset.index = index;
                thumbImg.dataset.type = 'image';
                thumbImg.dataset.src = media.url; // Для подстановки в главное окно
                thumbDiv.appendChild(thumbImg);
            } else if (media.type === 'video') {
                // Для миниатюры видео можно использовать превью или просто иконку
                // Пока используем превью из основного изображения или заглушку
                const thumbImg = document.createElement('img');
                // Используем poster видео или первое изображение аттракциона
                const posterUrl = itemData.images && itemData.images.length > 0 ? itemData.images[0].url : '/assets/icons/placeholder1.webp';
                thumbImg.src = posterUrl;
                thumbImg.alt = media.alt || 'Миниатюра видео';
                thumbImg.dataset.index = index;
                thumbImg.dataset.type = 'video';
                thumbImg.dataset.src = media.url; // URL видео для подстановки
                thumbImg.dataset.isVideo = "true"; // Флаг для JS
                // Добавим визуальный индикатор, что это видео
                const videoIcon = document.createElement('div');
                videoIcon.className = 'video-icon'; // Добавьте CSS для .video-icon
                videoIcon.innerHTML = '▶'; // Или используйте SVG иконку
                thumbDiv.appendChild(videoIcon);
                thumbDiv.appendChild(thumbImg);
            }

            thumbnailsContainer.appendChild(thumbDiv);
        });

        // Добавляем обработчик кликов по миниатюрам
        // ВАЖНО: используем делегирование событий
        thumbnailsContainer.addEventListener('click', (e) => {
            const clickedThumb = e.target.closest('.product-page-thumbnail');
            if (!clickedThumb) return;

            const index = parseInt(clickedThumb.querySelector('img').dataset.index);
            const type = clickedThumb.querySelector('img').dataset.type;
            const src = clickedThumb.querySelector('img').dataset.src;
            const isVideo = clickedThumb.querySelector('img').dataset.isVideo === "true";

            // Обновляем активную миниатюру
            thumbnailsContainer.querySelectorAll('.product-page-thumbnail').forEach(t => t.classList.remove('active'));
            clickedThumb.classList.add('active');

            // Обновляем главное окно (изображение или видео)
            const mainImageContainer = document.querySelector('.product-page-image');
            if (mainImageContainer) {
                mainImageContainer.innerHTML = ''; // Очищаем

                let newMediaElement;
                if (isVideo) {
                    newMediaElement = document.createElement('video');
                    newMediaElement.controls = true;
                    newMediaElement.preload = "metadata";
                    newMediaElement.playsInline = true;
                    // Используем тот же poster, что и для первой миниатюры
                    if (itemData.images && itemData.images.length > 0) {
                        newMediaElement.poster = itemData.images[0].url;
                    } else {
                        newMediaElement.poster = '/assets/icons/placeholder1.webp';
                    }
                    const source = document.createElement('source');
                    source.src = src; // URL видео
                    // source.type = 'video/mp4'; // Укажите, если нужно
                    newMediaElement.appendChild(source);
                    newMediaElement.alt = itemData.videos.find(v => v.url === src)?.alt || itemData.title || 'Видео аттракциона';
                } else {
                    newMediaElement = document.createElement('img');
                    newMediaElement.src = src; // URL изображения
                    newMediaElement.alt = itemData.images.find(i => i.url === src)?.alt || itemData.title || 'Изображение аттракциона';
                    newMediaElement.onerror = () => { newMediaElement.src = '/assets/icons/placeholder1.webp'; };
                }
                mainImageContainer.appendChild(newMediaElement);
            }
        });
    } else {
        console.warn('⚠️ Контейнер #product-page-thumbnails не найден в DOM. Галерея не будет отображена.');
    }


    // Заголовок
    const titleElement = document.getElementById('product-page-title-main');
    if (titleElement) {
        titleElement.textContent = itemData.title || 'Название недоступно';
    }

    // Обновление заголовка страницы
    const pageTitle = document.getElementById('product-page-title');
    if (pageTitle) {
        pageTitle.textContent = `${itemData.title || 'Аттракцион'} - BIZON`;
    }

    // Обновление Open Graph тегов (опционально)
    const ogTitle = document.getElementById('product-og-title');
    if (ogTitle) ogTitle.setAttribute('content', itemData.title || 'BIZON - Аттракцион');
    const ogDescription = document.getElementById('product-og-description');
    if (ogDescription) ogDescription.setAttribute('content', itemData.description || 'Информация об аттракциона на BIZON.');
    const ogImage = document.getElementById('product-og-image');
    if (ogImage) ogImage.setAttribute('content', (itemData.images && itemData.images[0].url) || '/assets/icons/placeholder1.webp');
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', window.location.href);


    // Описание
    const descriptionElement = document.getElementById('product-page-description-main');
    if (descriptionElement) {
        descriptionElement.textContent = itemData.description || 'Описание недоступно';
    }

    // Цена
    const priceElement = document.getElementById('product-page-price');
    if (priceElement) {
        priceElement.textContent = window.formatPrice ? window.formatPrice(itemData.price) : `${itemData.price || 0} ₽`;
    }

    // Бренд (если есть в данных, добавьте поле в БД и API)
    const brandElement = document.getElementById('product-page-brand');
    if (brandElement) {
        // Предположим, что бренд есть в данных, например, itemData.brand
        // brandElement.textContent = `Бренд: ${itemData.brand || 'Не указан'}`;
        brandElement.style.display = 'none'; // Скрываем, если нет бренда
    }

    // Навигационная цепочка (Breadcrumb)
    const breadcrumbCategory = document.getElementById('breadcrumb-category');
    if (breadcrumbCategory && breadcrumbCategory.querySelector('a')) {
        const categoryLink = breadcrumbCategory.querySelector('a');
        categoryLink.href = `/attractions?category=${encodeURIComponent(itemData.category)}`;
        categoryLink.textContent = itemData.category || 'Аттракционы';
    }

    // --- НОВОЕ: Отображение характеристик ---
    const infoSection = document.querySelector('.product-page-info'); // Контейнер, куда добавим характеристики
    if (infoSection && isAttractionPage) { // Только для страницы аттракциона
        const specsContainer = document.createElement('div');
        specsContainer.className = 'attraction-specs';
        specsContainer.innerHTML = '<h4>Характеристики:</h4>';

        const specsList = document.createElement('ul');
        specsList.className = 'specs-list';

        // Предполагаем, что у вас есть поля specs_*
        if (itemData.specs?.places) specsList.innerHTML += `<li><strong>Количество мест:</strong> ${itemData.specs.places}</li>`;
        if (itemData.specs?.power) specsList.innerHTML += `<li><strong>Потребляемая мощность:</strong> ${itemData.specs.power}</li>`;
        if (itemData.specs?.games) specsList.innerHTML += `<li><strong>Количество игр:</strong> ${itemData.specs.games}</li>`;
        if (itemData.specs?.area) specsList.innerHTML += `<li><strong>Требуемая площадь:</strong> ${itemData.specs.area}</li>`;
        if (itemData.specs?.dimensions) specsList.innerHTML += `<li><strong>Габариты:</strong> ${itemData.specs.dimensions}</li>`;

        if (specsList.children.length > 0) {
            specsContainer.appendChild(specsList);
            // Вставляем перед кнопками действий или в конец секции info
            const referenceElement = document.querySelector('.product-page-actions'); // Элемент, перед которым вставить
            // Проверяем, существует ли referenceElement и является ли он потомком infoSection
            if (referenceElement && infoSection.contains(referenceElement)) {
                 infoSection.insertBefore(specsContainer, referenceElement); // Вставляем перед кнопками
            } else {
                 infoSection.appendChild(specsContainer); // Вставляем в конец, если кнопки не найдены или не в нужном месте
            }
        }
    }

    // --- Заполнение характеристик ---
    const specsContainer = document.getElementById('specs-container');
    if (specsContainer && itemData.specs) {
        const specsData = [
            { label: 'Количество мест', key: 'places' },
            { label: 'Мощность', key: 'power' },
            { label: 'Количество игр', key: 'games' },
            { label: 'Площадь', key: 'area' },
            { label: 'Габариты', key: 'dimensions' }
        ];

        specsContainer.innerHTML = specsData
            .filter(spec => itemData.specs[spec.key])
            .map(spec => `
                <div class="spec-item">
                    <span class="spec-label">${spec.label}:</span>
                    <span class="spec-value">${itemData.specs[spec.key]}</span>
                </div>
            `).join('');
    }

    // --- Заполнение видео секции ---
    const videosSectionNew = document.getElementById('videos-section');
    const videosContainerNew = document.getElementById('videos-container');
    
    if (itemData.videos && itemData.videos.length > 0) {
        if (videosSectionNew) {
            videosSectionNew.style.display = 'block';
        }
        
        if (videosContainerNew) {
            videosContainerNew.innerHTML = itemData.videos.map((video, index) => `
                <div class="video-item">
                    <video controls preload="metadata" playsinline>
                        <source src="${video.url}" type="video/mp4">
                        Ваш браузер не поддерживает видео.
                    </video>
                    ${video.alt ? `<p style="margin-top: 0.5rem; text-align: center; color: rgba(255, 255, 255, 0.7); font-size: 0.875rem;">${video.alt}</p>` : ''}
                </div>
            `).join('');
        }
    }

    // --- Инициализация аккордеона ---
    const accordionHeadersNew = document.querySelectorAll('.accordion-header');
    accordionHeadersNew.forEach(header => {
        header.addEventListener('click', () => {
            const isExpanded = header.getAttribute('aria-expanded') === 'true';
            header.setAttribute('aria-expanded', !isExpanded);
        });
    });

    // --- Кнопки "Добавить в корзину" и "Купить" ---
    // Проверяем, доступен ли аттракцион для покупки
    const addToCartBtn = document.getElementById('product-page-add-to-cart-btn');
    const buyNowBtn = document.getElementById('product-page-buy-now-btn');

    if (addToCartBtn && buyNowBtn) {
        if (itemData.available !== false) { // Если available не false (т.е. true или null/undefined и считаем как true)
            addToCartBtn.disabled = false;
            buyNowBtn.disabled = false;
            addToCartBtn.title = '';
            buyNowBtn.title = '';
        } else {
            addToCartBtn.disabled = true;
            buyNowBtn.disabled = true;
            const unavailableText = 'Товар временно недоступен';
            addToCartBtn.title = unavailableText;
            buyNowBtn.title = unavailableText;
            // Можно изменить текст кнопок
            // addToCartBtn.textContent = unavailableText;
            // buyNowBtn.textContent = unavailableText;
        }
    }

    // --- КОНЕЦ: Заполнение страницы ---

    // Сохраняем текущий отображаемый элемент (для совместимости с корзиной)
    window.currentDisplayedVariant = itemData;

    // Настраиваем кнопки корзины
    setupCartButtons(itemData);

    // Обновляем счётчик корзины при загрузке
    if (typeof window.updateCartCount === 'function') {
        window.updateCartCount();
    }

});

/**
 * Настройка кнопок корзины и покупки
 */
function setupCartButtons(itemData) {
    const addToCartBtn = document.getElementById('product-page-add-to-cart-btn');
    const buyNowBtn = document.getElementById('product-page-buy-now-btn');
    const cartBtn = document.getElementById('cart-btn');

    // Кнопка корзины в хедере
    if (cartBtn) {
        cartBtn.addEventListener('click', () => {
            window.location.href = '/cart';
        });
    }

    // Добавить в корзину
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', () => {
            // Если товар уже в корзине, переходим на страницу корзины
            if (addToCartBtn.classList.contains('in-cart')) {
                window.location.href = '/cart';
                return;
            }
            
            const itemToAdd = window.currentDisplayedVariant || itemData;
            if (typeof window.addToCart === 'function') {
                // addToCart теперь автоматически показывает мини-корзину и обновляет кнопку
                window.addToCart(itemToAdd);
            }
        });
    }

    // Купить сейчас
    if (buyNowBtn) {
        buyNowBtn.addEventListener('click', () => {
            const itemToAdd = window.currentDisplayedVariant || itemData;
            if (typeof window.addToCart === 'function') {
                window.addToCart(itemToAdd);
            }
            if (typeof window.updateCartCount === 'function') {
                window.updateCartCount();
            }
            window.location.href = '/cart';
        });
    }
}