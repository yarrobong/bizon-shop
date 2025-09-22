// admin-attractions.js

// Глобальные переменные для аттракционов
let attractionImages = []; // Массив для хранения изображений аттракциона

// Инициализация вкладки аттракционов
async function loadAttractionsTab() {
    await loadAttractions();
    await loadAttractionCategoryOptions();
}

// --- Функции для работы с аттракционами ---

async function loadAttractions() {
    try {
        console.log('Загрузка аттракционов...');
        const response = await fetch('/api/attractions');
        console.log('Ответ от /api/attractions:', response.status);
        if (response.ok) {
            const attractions = await response.json();
            console.log('Аттракционы загружены:', attractions);
            renderAttractions(attractions);
        } else {
            console.error('Ошибка загрузки аттракционов:', response.status);
            renderAttractions([]);
        }
    } catch (error) {
        console.error('Ошибка загрузки аттракционов:', error);
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

    if (!attractions || attractions.length === 0) {
        container.innerHTML = '<div class="empty">Нет аттракционов для отображения</div>';
        return;
    }

    attractions.forEach(attraction => {
        // Используем первое изображение из массива images, если оно есть
        // Совместимость со старым форматом (поле image)
        const imageUrl = (attraction.images && attraction.images.length > 0) ?
            attraction.images[0].url :
            (attraction.image || '/assets/icons/placeholder1.webp');

        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${imageUrl}" alt="${escapeHtml(attraction.title)}" onerror="this.src='/assets/icons/placeholder1.webp'">
            <h3>${escapeHtml(attraction.title)}</h3>
            <p>Цена: ${formatPrice(attraction.price)}</p>
            <p>Категория: ${escapeHtml(attraction.category || 'Не указана')}</p>
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

async function loadAttractionForEdit(attractionId) {
    try {
        const response = await fetch(`/api/attractions/${attractionId}`);
        if (response.ok) {
            const attraction = await response.json();
            const title = document.getElementById('attraction-modal-title');
            title.textContent = 'Редактировать аттракцион';
            document.getElementById('attraction-id').value = attraction.id || '';
            document.getElementById('attraction-title').value = attraction.title || '';
            document.getElementById('attraction-description').value = attraction.description || '';
            document.getElementById('attraction-price').value = attraction.price || '';
            document.getElementById('attraction-category').value = attraction.category || '';

            const specs = attraction.specs || {};
            document.getElementById('attraction-specs-places').value = specs.places || '';
            document.getElementById('attraction-specs-power').value = specs.power || '';
            document.getElementById('attraction-specs-games').value = specs.games || '';
            document.getElementById('attraction-specs-area').value = specs.area || '';
            document.getElementById('attraction-specs-dimensions').value = specs.dimensions || '';

            // Загружаем изображения в форму (массив)
            // Совместимость со старым форматом (поле image)
            let imagesToLoad = [];
            if (attraction.images && Array.isArray(attraction.images)) {
                imagesToLoad = attraction.images;
            } else if (attraction.image) {
                imagesToLoad = [{ url: attraction.image, alt: attraction.title || 'Изображение' }];
            }
            loadAttractionImagesToForm(imagesToLoad);

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

    // Исправлено: добавляем обработчики drag & drop к контейнеру изображений, а не к зоне дропа
    const imagesContainer = document.getElementById('attraction-images-container'); 
    if (imagesContainer) {
        // Обработчик dragover
        imagesContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            imagesContainer.classList.add('drag-over'); // Используем контейнер, а не зону дропа
        });

        // Обработчик dragleave
        imagesContainer.addEventListener('dragleave', (e) => {
            if (!imagesContainer.contains(e.relatedTarget)) {
                imagesContainer.classList.remove('drag-over');
            }
        });

        // Обработчик drop
        imagesContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            imagesContainer.classList.remove('drag-over');
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

                const response = await fetch('/api/upload', {
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

        if (window.draggedAttractionImage && window.draggedAttractionImage !== imageItem) {
            const container = document.getElementById('attraction-images-container');
            if (container) {
                const rect = imageItem.getBoundingClientRect();
                const isAfter = e.clientX > rect.left + rect.width / 2;
                if (isAfter) {
                    container.insertBefore(window.draggedAttractionImage, imageItem.nextSibling);
                } else {
                    container.insertBefore(window.draggedAttractionImage, imageItem);
                }
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



// --- Сохранение/Удаление аттракциона ---

async function saveAttraction() {
    const form = document.getElementById('attraction-form');
    const id = document.getElementById('attraction-id').value;
    const isEdit = !!id;

    const formData = new FormData(form);
    // Подготавливаем данные, включая массив изображений
    const attractionData = {
        title: formData.get('attraction-title'),
        description: formData.get('attraction-description'),
        price: parseFloat(formData.get('attraction-price')) || 0,
        category: formData.get('attraction-category'),
        specs: {
            places: formData.get('attraction-specs-places') || null,
            power: formData.get('attraction-specs-power') || null,
            games: formData.get('attraction-specs-games') || null,
            area: formData.get('attraction-specs-area') || null,
            dimensions: formData.get('attraction-specs-dimensions') || null
        },
        // Отправляем массив изображений
        images: getAttractionImagesFromForm()
    };

    try {
        let response;
        if (isEdit) {
            response = await fetch(`/api/attractions/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(attractionData)
            });
        } else {
            response = await fetch('/api/attractions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(attractionData)
            });
        }

        if (response.ok) {
            const result = await response.json();
            console.log(`${isEdit ? 'Аттракцион обновлен' : 'Аттракцион создан'}:`, result);
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

async function deleteAttraction(id) {
    if (!confirm('Вы уверены, что хотите удалить этот аттракцион?')) return;
    try {
        const response = await fetch(`/api/attractions/${id}`, { method: 'DELETE' });
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
        const response = await fetch('/api/attractions/categories');
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
    // Если вкладка аттракционов активна при загрузке, загрузить данные
    if (document.getElementById('attractions-tab')?.classList.contains('active')) {
        loadAttractionsTab();
    }
});