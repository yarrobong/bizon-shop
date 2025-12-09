// admin-attractions.js

// Глобальные переменные для аттракционов
let attractionImages = []; // Массив для хранения изображений аттракциона
let attractionVideos = []; // Массив для хранения видео аттракциона

// Инициализация вкладки аттракционов
async function loadAttractionsTab() {
    await loadAttractions();
    await loadAttractionCategoryOptions();
}

// Делаем функцию доступной глобально
window.loadAttractionsTab = loadAttractionsTab;

// --- Функции для работы с аттракционами ---

async function loadAttractions() {
    try {
        console.log('Загрузка аттракционов... (админ)');
        const sessionId = localStorage.getItem('sessionId');
        console.log('sessionId:', sessionId ? 'найден' : 'НЕ НАЙДЕН');
        
        // Возвращаем адрес API, который есть на сервере
        const response = await fetchWithAuth('/api/attractions/public'); // <-- Вот эту строку восстанавливаем
        
        if (response.ok) {
            const attractions = await response.json();
            
            renderAttractions(attractions);
        } else {
            console.error('Ошибка загрузки аттракционов (админ):', response.status);
            if (response.status === 401) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Детали ошибки 401:', errorData);
                adminPanel.showMessage('Сессия истекла. Пожалуйста, войдите снова.', 'error');
                setTimeout(() => {
                    window.location.href = '../login.html';
                }, 2000);
            }
            renderAttractions([]);
        }
    } catch (error) {
        console.error('Ошибка загрузки аттракционов (админ):', error);
        renderAttractions([]);
    }
}

function renderAttractions(attractions) {
    const container = document.getElementById('admin-attractions-grid');
    if (!container) {
        console.error('Контейнер для аттракционов не найден');
        return;
    }

    container.innerHTML = '';

    // --- НЕТ ФИЛЬТРАЦИИ ПО available ЗДЕСЬ ---
    // НЕ ДОЛЖНО БЫТЬ ЧЕГО-ТО ТАКОГО:
    // if (!attractions || attractions.length === 0 || !attractions.some(a => a.available)) {
    //     container.innerHTML = '<div class="empty">Нет доступных аттракционов для отображения</div>';
    //     return;
    // }
    // attractions = attractions.filter(a => a.available); // <-- ЭТО НЕ НУЖНО
    // --- КОНЕЦ НЕПРАВИЛЬНОЙ ФИЛЬТРАЦИИ ---

    // Должно быть просто проверка на пустой массив:
    if (!attractions || attractions.length === 0) {
        container.innerHTML = '<div class="empty">Нет аттракционов для отображения</div>';
        return;
    }

    attractions.forEach(attraction => {
        // Используем первое изображение из массива images, если оно есть
        const imageUrl = (attraction.images && attraction.images.length > 0) ?
            attraction.images[0].url :
            (attraction.image || '/assets/icons/placeholder1.webp');

        const card = document.createElement('div');
        card.className = 'product-card';
        
        // Можно добавить визуальный индикатор доступности
        if (attraction.available === false) {
             card.classList.add('unavailable'); // Добавим класс для стилизации
             // Или просто добавим информацию в HTML
        }
        
        card.innerHTML = `
            <img src="${imageUrl}" alt="${escapeHtml(attraction.title)}" onerror="this.src='/assets/icons/placeholder1.webp'">
            <h3>${escapeHtml(attraction.title)}</h3>
            <p>Цена: ${formatPrice(attraction.price)}</p>
            <p>Категория: ${escapeHtml(attraction.category || 'Не указана')}</p>
            <!-- Отображаем статус доступности -->
            <p>Доступность: ${attraction.available !== false ? 'Да' : 'Нет (только в админке)'}</p> 
            <div class="product-actions">
                <button onclick="openAttractionModal(${attraction.id})" class="btn-primary">Редактировать</button>
                <button onclick="deleteAttraction(${attraction.id})" class="btn-danger">Удалить</button>
            </div>
        `;
        container.appendChild(card);
    });
}
// --- Модальное окно аттракциона ---

function openAttractionModal(attractionId = null) {
    const modal = document.getElementById('attraction-modal');
    const title = document.getElementById('attraction-modal-title');
    const form = document.getElementById('attraction-form');
    const idInput = document.getElementById('attraction-id');

    if (!modal || !title || !form || !idInput) {
        console.error('Элементы модального окна аттракциона не найдены');
        return;
    }

    // Сброс формы и изображений
    form.reset();
    clearAttractionImageFields(); // Очищает массив attractionImages и DOM

    if (attractionId) {
        // Редактирование
        loadAttractionForEdit(attractionId);
    } else {
        // Добавление нового
        title.textContent = 'Добавить аттракцион';
        idInput.value = '';
        modal.style.display = 'block';
        document.body.classList.add('modal-open');
    }
}

// --- Функция загрузки аттракциона для редактирования ---
async function loadAttractionForEdit(attractionId) {
    try {
        const response = await fetchWithAuth(`/api/attractions/${attractionId}`); // Используем существующий API
        if (response.ok) {
            const attraction = await response.json();
            const title = document.getElementById('attraction-modal-title');
            title.textContent = 'Редактировать аттракцион';
            document.getElementById('attraction-id').value = attraction.id || '';
            document.getElementById('attraction-title').value = attraction.title || '';
            document.getElementById('attraction-description').value = attraction.description || '';
            document.getElementById('attraction-price').value = attraction.price || '';
            document.getElementById('attraction-category').value = attraction.category || '';

            // --- Загрузка состояния доступности ---
            const availableCheckbox = document.getElementById('attraction-available');
            if (availableCheckbox) {
                availableCheckbox.checked = attraction.available !== false;
            }

            // --- Загрузка произвольных характеристик (JSON строка) ---
            const specsTextarea = document.getElementById('attraction-specs');
            if (specsTextarea) {
                // Превращаем объект specs в JSON строку для отображения в textarea
                const specsString = JSON.stringify(attraction.specs || {}, null, 2);
                specsTextarea.value = specsString;
            }

            // --- Загрузка изображений ---
            // Совместимость со старым форматом (поле image)
            let imagesToLoad = [];
            if (attraction.images && Array.isArray(attraction.images)) {
                imagesToLoad = attraction.images;
            } else if (attraction.image) {
                imagesToLoad = [{ url: attraction.image, alt: attraction.title || 'Изображение' }];
            }
            loadAttractionImagesToForm(imagesToLoad);

            // --- Загрузка видео ---
            // Предполагаем, что attraction.videos - это массив объектов {url, alt, sort_order, is_primary}
            loadAttractionVideosToForm(attraction.videos || []);

            const modal = document.getElementById('attraction-modal');
            modal.style.display = 'block';
            document.body.classList.add('modal-open');
        } else {
            throw new Error(`Ошибка загрузки аттракциона: ${response.status}`);
        }
    } catch (error) {
        console.error('Ошибка загрузки аттракциона для редактирования:', error);
        showMessage(`Ошибка загрузки аттракциона: ${error.message}`, 'error');
    }
}
// --- Функция очистки видео ---
function clearAttractionVideoFields() {
    const container = document.getElementById('attraction-videos-container');
    if (container) {
        container.innerHTML = '';
    }
    attractionVideos = [];
}

// --- Функция загрузки видео в форму ---
function loadAttractionVideosToForm(videos) {
    clearAttractionVideoFields();
    if (videos && Array.isArray(videos) && videos.length > 0) {
        videos.forEach(video => {
            addAttractionVideoField(video);
        });
    }
}

// --- Функция добавления поля видео ---
function addAttractionVideoField(videoData = null) {
    const container = document.getElementById('attraction-videos-container');
    if (!container) return;

    const videoId = Date.now() + Math.floor(Math.random() * 10000);
    const videoItem = document.createElement('div');
    videoItem.className = 'video-item';
    videoItem.dataset.id = videoId;

    const videoUrl = videoData?.url || '';
    const videoAlt = videoData?.alt || '';
    const isPrimary = videoData?.is_primary || false;

    videoItem.innerHTML = `
        <input type="text" class="video-input-url" value="${videoUrl}" placeholder="Ссылка на видео (YouTube/Vimeo/...)">
        <input type="text" class="video-input-alt" value="${videoAlt}" placeholder="Описание видео (alt)">
        <label>
            <input type="checkbox" class="video-input-primary" ${isPrimary ? 'checked' : ''}> Главное видео
        </label>
        <button type="button" class="delete-video-btn" data-id="${videoId}" title="Удалить видео">&times;</button>
    `;

    container.appendChild(videoItem);

    attractionVideos.push({
        id: videoId,
        url: videoUrl,
        alt: videoAlt,
        is_primary: isPrimary
    });

    const deleteBtn = videoItem.querySelector('.delete-video-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteAttractionVideo(videoId);
        });
    }

    // Обработчик для чекбокса "Главное видео"
    const primaryCheckbox = videoItem.querySelector('.video-input-primary');
    if (primaryCheckbox) {
        primaryCheckbox.addEventListener('change', () => {
            // Сбрасываем все остальные чекбоксы "Главное видео" в массиве
            attractionVideos.forEach(v => {
                if (v.id !== videoId) {
                    v.is_primary = false;
                }
            });
            // Обновляем состояние текущего
            const videoInArray = attractionVideos.find(v => v.id === videoId);
            if (videoInArray) {
                videoInArray.is_primary = primaryCheckbox.checked;
            }
        });
    }
}

// --- Функция удаления видео ---
function deleteAttractionVideo(videoId) {
    const videoItem = document.querySelector(`#attraction-videos-container .video-item[data-id="${videoId}"]`);
    if (videoItem) {
        videoItem.remove();
        attractionVideos = attractionVideos.filter(vid => vid.id !== videoId);
    }
}

// --- Функция получения видео из формы ---
function getAttractionVideosFromForm() {
    return attractionVideos.map(vid => ({
        url: vid.url,
        alt: vid.alt || '',
        is_primary: vid.is_primary || false
    })).filter(vid => vid.url); // Фильтруем пустые url
}

// Обработчики событий формы
document.getElementById('attraction-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveAttraction();
});

document.getElementById('add-attraction-btn')?.addEventListener('click', () => {
    openAttractionModal();
});

// Закрытие модального окна аттракциона
document.querySelector('#attraction-modal .close-attraction-modal')?.addEventListener('click', () => {
    closeModal('attraction-modal');
});
document.getElementById('cancel-attraction-btn')?.addEventListener('click', () => {
    closeModal('attraction-modal');
});

// --- Работа с изображениями аттракционов ---

function setupAttractionImageEventListeners() {
    const addImageBtn = document.getElementById('add-attraction-image-btn');
    if (addImageBtn) {
        addImageBtn.addEventListener('click', () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.multiple = true;
            fileInput.style.display = 'none';
            fileInput.addEventListener('change', (e) => {
                handleAttractionFileSelect(e.target.files);
            });
            document.body.appendChild(fileInput);
            fileInput.click();
            document.body.removeChild(fileInput);
        });
    }

    const dropZone = document.getElementById('attraction-images-drop-zone');
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', (e) => {
            if (!dropZone.contains(e.relatedTarget)) {
                dropZone.classList.remove('drag-over');
            }
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleAttractionFileSelect(files);
            }
        });
    }
}

async function handleAttractionFileSelect(files) {
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
            try {
                const formData = new FormData();
                formData.append('image', file);

                const response = await fetchWithAuth('/api/upload', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `Ошибка загрузки: ${response.status}`);
                }

                const data = await response.json();
                addAttractionImageField({ url: data.url, alt: file.name });
            } catch (error) {
                console.error('Ошибка при загрузке файла:', error);
                showMessage(`Ошибка загрузки ${file.name}: ${error.message}`, 'error');
            }
        } else {
            showMessage(`Файл ${file.name} не является изображением`, 'error');
        }
    }
}

function addAttractionImageField(imageData = null) {
    const container = document.getElementById('attraction-images-container');
    const dropHint = document.getElementById('attraction-drop-hint');

    if (!container) return;

    if (dropHint) {
        dropHint.classList.remove('show');
    }

    const imageId = Date.now() + Math.floor(Math.random() * 10000);
    const imageItem = document.createElement('div');
    imageItem.className = 'image-item';
    imageItem.dataset.id = imageId;
    imageItem.draggable = true;

    const imageUrl = imageData?.url || '';
    const imageAlt = imageData?.alt || '';

    imageItem.innerHTML = `
        ${imageUrl ?
            `<img src="${imageUrl}" alt="${imageAlt}" onerror="this.src='/assets/icons/placeholder1.webp'">` :
            `<div class="image-placeholder">Изображение не загружено</div>`
        }
        <input type="hidden" class="image-input" value="${imageUrl}">
        <button type="button" class="delete-image-btn" data-id="${imageId}" title="Удалить изображение">&times;</button>
    `;

    container.appendChild(imageItem);

    setupAttractionImageDragEvents(imageItem);

    attractionImages.push({
        id: imageId,
        url: imageUrl,
        alt: imageAlt
    });

    imageItem.addEventListener('mouseenter', () => {
        const deleteBtn = imageItem.querySelector('.delete-image-btn');
        if (deleteBtn) deleteBtn.style.opacity = '1';
    });

    imageItem.addEventListener('mouseleave', () => {
        const deleteBtn = imageItem.querySelector('.delete-image-btn');
        if (deleteBtn) deleteBtn.style.opacity = '0';
    });

    const deleteBtn = imageItem.querySelector('.delete-image-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteAttractionImage(imageId);
        });
    }
}

function setupAttractionImageDragEvents(imageItem) {
    imageItem.addEventListener('dragstart', (e) => {
        window.draggedAttractionImage = imageItem;
        imageItem.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        // Используем 'text/plain' для обхода ограничений Chrome, передавая ID элемента
        e.dataTransfer.setData('text/plain', imageItem.dataset.id); 
    });

    imageItem.addEventListener('dragend', () => {
        imageItem.classList.remove('dragging');
        const container = document.getElementById('attraction-images-container');
        if (container) {
            const draggables = container.querySelectorAll('.image-item.drag-over');
            draggables.forEach(item => item.classList.remove('drag-over'));
        }
        window.draggedAttractionImage = null;
    });

    imageItem.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (window.draggedAttractionImage !== imageItem) {
            imageItem.classList.add('drag-over');
        }
    });

    imageItem.addEventListener('dragleave', () => {
        imageItem.classList.remove('drag-over');
    });

    imageItem.addEventListener('drop', (e) => {
        e.preventDefault();
        imageItem.classList.remove('drag-over');

        // Получаем ID перетаскиваемого элемента из dataTransfer
        const draggedId = e.dataTransfer.getData('text/plain');
        // Находим сам элемент по ID на случай, если window.draggedAttractionImage стал недействительным
        const draggedElement = document.querySelector(`#attraction-images-container .image-item[data-id="${draggedId}"]`);
        
        // Проверяем, что перетаскиваемый элемент существует и это не тот же элемент
        if (draggedElement && draggedElement !== imageItem) {
            const container = document.getElementById('attraction-images-container');
            if (container) {
                // Определяем, куда вставлять: после imageItem или перед ним
                const rect = imageItem.getBoundingClientRect();
                const isAfter = e.clientX > rect.left + rect.width / 2;
                
                // --- ИСПРАВЛЕНИЕ ---
                // ВАЖНО: Сначала удаляем draggedElement из его текущего родителя
                // Метод insertBefore автоматически перемещает элемент, если он уже в DOM,
                // но для гарантии корректного поведения явно удалим его.
                // Однако стандартная практика с insertBefore - это просто вставить на новое место,
                // и элемент автоматически переместится.
                
                if (isAfter) {
                    // Вставляем ПОСЛЕ imageItem
                    // nextSibling - это следующий элемент или null (вставка в конец)
                    container.insertBefore(draggedElement, imageItem.nextSibling);
                } else {
                    // Вставляем ПЕРЕД imageItem
                    container.insertBefore(draggedElement, imageItem);
                }
                // --- КОНЕЦ ИСПРАВЛЕНИЯ ---
                
                updateAttractionImagesOrder();
            }
        }
    });
}

function updateAttractionImagesOrder() {
    const imageItems = document.querySelectorAll('#attraction-images-container .image-item');
    const newImages = [];

    imageItems.forEach(item => {
        const id = parseInt(item.dataset.id);
        const image = attractionImages.find(img => img.id === id);
        if (image) {
            newImages.push(image);
        }
    });

    attractionImages = newImages;
}

function deleteAttractionImage(imageId) {
    const imageItem = document.querySelector(`#attraction-images-container .image-item[data-id="${imageId}"]`);
    if (imageItem) {
        imageItem.remove();
        attractionImages = attractionImages.filter(img => img.id !== imageId);

        // Показываем подсказку, если не осталось изображений
        const container = document.getElementById('attraction-images-container');
        const dropHint = document.getElementById('attraction-drop-hint');
        if (container && dropHint && container.children.length === 0) {
            dropHint.classList.add('show');
        }
    }
}

function clearAttractionImageFields() {
    const container = document.getElementById('attraction-images-container');
    const dropHint = document.getElementById('attraction-drop-hint');

    if (container) {
        container.innerHTML = '';
    }

    if (dropHint) {
        dropHint.classList.add('show');
    }

    attractionImages = [];
}

function loadAttractionImagesToForm(images) {
    clearAttractionImageFields();
    
    if (images && Array.isArray(images) && images.length > 0) {
        images.forEach(image => {
            addAttractionImageField(image);
        });
        
        const dropHint = document.getElementById('attraction-drop-hint');
        if (dropHint) {
            dropHint.classList.remove('show');
        }
    }
}

// --- Функция для получения данных изображений из формы ---
function getAttractionImagesFromForm() {
    // Так как мы храним изображения в глобальном массиве attractionImages,
    // мы можем просто вернуть его.
    // Убедимся, что возвращаем только url и alt, и что это массив объектов.
    return attractionImages.map(img => ({
        url: img.url,
        alt: img.alt || ''
    })).filter(img => img.url); // Фильтруем пустые url на всякий случай
}

// --- Сохранение/Удаление аттракциона ---

async function saveAttraction() {
    const form = document.getElementById('attraction-form');
    const id = document.getElementById('attraction-id').value;
    const isEdit = !!id;

    // Подготавливаем данные
    const attractionData = {
        title: document.getElementById('attraction-title').value,
        description: document.getElementById('attraction-description').value,
        price: parseFloat(document.getElementById('attraction-price').value) || 0,
        category: document.getElementById('attraction-category').value,
        available: document.getElementById('attraction-available').checked,
        // --- НОВОЕ: Произвольные характеристики ---
        specs: {}, // Инициализируем пустым объектом
        // --- НОВОЕ: Изображения ---
        images: getAttractionImagesFromForm(),
        // --- НОВОЕ: Видео ---
        videos: getAttractionVideosFromForm()
    };

    // --- Парсим JSON из textarea ---
    const specsTextareaValue = document.getElementById('attraction-specs').value.trim();
    if (specsTextareaValue) {
        try {
            const parsedSpecs = JSON.parse(specsTextareaValue);
            if (typeof parsedSpecs === 'object' && parsedSpecs !== null) {
                attractionData.specs = parsedSpecs;
            } else {
                throw new Error('JSON характеристик должен быть объектом');
            }
        } catch (e) {
            console.error('Ошибка парсинга JSON характеристик:', e);
            showMessage(`Ошибка в формате характеристик: ${e.message}`, 'error');
            return; // Не отправляем, если JSON неверен
        }
    }

    
    try {
        let response;
        if (isEdit) {
            response = await fetchWithAuth(`/api/attractions/${id}`, {
                method: 'PUT',
                body: JSON.stringify(attractionData)
            });
        } else {
            response = await fetchWithAuth('/api/attractions', {
                method: 'POST',
                body: JSON.stringify(attractionData)
            });
        }

        if (response.ok) {
            const result = await response.json();
            showMessage(`${isEdit ? 'Аттракцион обновлен' : 'Аттракцион создан'} успешно!`, 'success');
            closeModal('attraction-modal');
            await loadAttractions(); // Перезагружаем список
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Ошибка ${isEdit ? 'обновления' : 'создания'}: ${response.status}`);
        }
    } catch (error) {
        console.error(`Ошибка ${isEdit ? 'обновления' : 'создания'} аттракциона:`, error);
        showMessage(`Ошибка: ${error.message}`, 'error');
    }
}
document.getElementById('add-attraction-video-btn')?.addEventListener('click', () => {
    addAttractionVideoField();
});

async function deleteAttraction(id) {
    if (!confirm('Вы уверены, что хотите удалить этот аттракцион?')) return;
    try {
        const response = await fetchWithAuth(`/api/attractions/${id}`, { method: 'DELETE' });
        if (response.ok) {
            console.log('Аттракцион удален');
            showMessage('Аттракцион удален успешно!', 'success');
            await loadAttractions(); // Перезагружаем список
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Ошибка удаления: ${response.status}`);
        }
    } catch (error) {
        console.error('Ошибка удаления аттракциона:', error);
        showMessage(`Ошибка удаления: ${error.message}`, 'error');
    }
}

// --- Категории аттракционов ---

async function loadAttractionCategoryOptions() {
    try {
        // Этот эндпоинт публичный, но используем fetchWithAuth для единообразия
        // Если sessionId отсутствует, просто используем обычный fetch
        const sessionId = localStorage.getItem('sessionId');
        const response = sessionId 
            ? await fetchWithAuth('/api/attractions/categories')
            : await fetch('/api/attractions/categories');
        if (response.ok) {
            const categories = await response.json();
            const datalist = document.getElementById('attraction-categories');
            if (datalist) {
                datalist.innerHTML = '';
                categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category;
                    datalist.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки категорий аттракционов для datalist:', error);
    }
}

// --- Вспомогательные функции (локальные копии из admin-core.js) ---
function formatPrice(price) {
    if (price === null || price === undefined) {
        return 'Цена не указана';
    }
    let numericPrice;
    if (typeof price === 'string') {
        numericPrice = parseFloat(price.trim().replace(',', '.'));
    } else {
        numericPrice = price;
    }
    if (typeof numericPrice !== 'number' || isNaN(numericPrice)) {
        return 'Цена не указана';
    }
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB'
    }).format(numericPrice);
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '<',
        '>': '>',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, function (m) { return map[m]; });
}

function showMessage(message, type = 'info') {
    const messageEl = document.createElement('div');
    messageEl.className = `admin-message ${type}`;
    messageEl.textContent = message;
    document.body.appendChild(messageEl);
    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.parentNode.removeChild(messageEl);
        }
    }, 3000);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    }
}

// --- Инициализация после загрузки DOM ---
document.addEventListener('DOMContentLoaded', () => {
    setupAttractionImageEventListeners();
    // Инициализация обработчика кнопки добавления видео
    document.getElementById('add-attraction-video-btn')?.addEventListener('click', () => {
        addAttractionVideoField();
    });

    // Если вкладка аттракционов активна при загрузке, загрузить данные
    if (document.getElementById('attractions-tab')?.classList.contains('active')) {
        loadAttractionsTab();
    }
});