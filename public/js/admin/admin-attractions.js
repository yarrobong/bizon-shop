// admin-attractions.js

let attractionImages = []; // Массив для хранения изображений аттракциона

async function loadAttractionsTab() {
    await loadAttractions();
    await loadAttractionCategoryOptions();
}

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
        // Используем первое изображение из массива, если оно есть
        const imageUrl = (attraction.images && attraction.images.length > 0) ? attraction.images[0].url : '/assets/icons/placeholder1.webp';

        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${imageUrl}" alt="${adminPanel.escapeHtml(attraction.title)}" onerror="this.src='/assets/icons/placeholder1.webp'">
            <h3>${adminPanel.escapeHtml(attraction.title)}</h3>
            <p>Цена: ${adminPanel.formatPrice(attraction.price)}</p>
            <p>Категория: ${adminPanel.escapeHtml(attraction.category || 'Не указана')}</p>
            <div class="product-actions">
                <button onclick="openAttractionModal(${attraction.id})" class="btn-primary">Редактировать</button>
                <button onclick="deleteAttraction(${attraction.id})" class="btn-danger">Удалить</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function openAttractionModal(attractionId = null) {
    const modal = document.getElementById('attraction-modal');
    const title = document.getElementById('attraction-modal-title');
    const form = document.getElementById('attraction-form');
    const idInput = document.getElementById('attraction-id');

    if (attractionId) {
        loadAttractionForEdit(attractionId);
    } else {
        title.textContent = 'Добавить аттракцион';
        form.reset();
        idInput.value = '';
        clearAttractionImageFields(); // Очищает массив attractionImages и DOM
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
            document.getElementById('attraction-id').value = attraction.id;
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
            if (attraction.images && Array.isArray(attraction.images)) {
                loadAttractionImagesToForm(attraction.images);
            } else {
                // Если images не массив, пытаемся обработать как одно изображение или очистить
                clearAttractionImageFields();
                if (attraction.image) { // Старый формат?
                     addAttractionImageField({ url: attraction.image, alt: attraction.title || 'Изображение' });
                }
            }

            const modal = document.getElementById('attraction-modal');
            modal.style.display = 'block';
            document.body.classList.add('modal-open');
        } else {
            throw new Error(`Ошибка загрузки аттракциона: ${response.status}`);
        }
    } catch (error) {
        console.error('Ошибка загрузки аттракциона для редактирования:', error);
        adminPanel.showMessage(`Ошибка загрузки аттракциона: ${error.message}`, 'error');
    }
}

// --- Обработчики событий формы ---
document.getElementById('attraction-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveAttraction();
});

document.getElementById('add-attraction-btn')?.addEventListener('click', () => {
    openAttractionModal();
});

// Закрытие модального окна
document.querySelector('#attraction-modal .close-attraction-modal')?.addEventListener('click', () => {
    adminPanel.closeModal('attraction-modal');
});
document.getElementById('cancel-attraction-btn')?.addEventListener('click', () => {
    adminPanel.closeModal('attraction-modal');
});

// --- Работа с изображениями аттракционов (МНОЖЕСТВЕННЫЕ) ---

function setupAttractionImageEventListeners() {
    const addImageBtn = document.getElementById('add-image-btn'); // Предполагаем, что ID такой же, как у товаров
    if (addImageBtn) {
        addImageBtn.addEventListener('click', () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.multiple = true; // Разрешаем множественный выбор
            fileInput.style.display = 'none';
            fileInput.addEventListener('change', async (e) => {
                const files = e.target.files;
                if (files.length > 0) await handleAttractionFilesSelect(files);
            });
            document.body.appendChild(fileInput);
            fileInput.click();
            document.body.removeChild(fileInput);
        });
    }

    const dropZone = document.getElementById('images-drop-zone'); // Предполагаем, что ID такой же
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy'; // Изменено на 'copy'
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', (e) => {
            // Проверяем, действительно ли курсор вышел за пределы drop zone
            if (!dropZone.contains(e.relatedTarget)) {
                dropZone.classList.remove('drag-over');
            }
        });

        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                // Фильтруем только изображения
                const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
                if (imageFiles.length > 0) {
                    await handleAttractionFilesSelect(imageFiles);
                } else {
                    adminPanel.showMessage('Пожалуйста, перетащите изображения', 'error');
                }
            }
        });
    }
}

async function handleAttractionFilesSelect(files) {
    // Обрабатываем файлы один за другим
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
                // Добавляем загруженное изображение в форму
                addAttractionImageField({ url: data.url, alt: file.name });
            } catch (error) {
                console.error('Ошибка при загрузке файла:', error);
                adminPanel.showMessage(`Ошибка загрузки ${file.name}: ${error.message}`, 'error');
            }
        } else {
            adminPanel.showMessage(`Файл ${file.name} не является изображением`, 'error');
        }
    }
}

function addProductImageField(imageData = null) {
    const container = document.getElementById('images-container');
    const dropHint = document.getElementById('drop-hint');

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

    setupProductImageDragEvents(imageItem);

    productImages.push({
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
            deleteProductImage(imageId);
        });
    }
}

function setupProductImageDragEvents(imageItem) {
    imageItem.addEventListener('dragstart', (e) => {
        adminPanel.draggedImage = imageItem;
        imageItem.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });

    imageItem.addEventListener('dragend', () => {
        imageItem.classList.remove('dragging');
        const container = document.getElementById('images-container');
        if (container) {
            const draggables = container.querySelectorAll('.image-item.drag-over');
            draggables.forEach(item => item.classList.remove('drag-over'));
        }
        adminPanel.draggedImage = null;
    });

    imageItem.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (adminPanel.draggedImage !== imageItem) {
            imageItem.classList.add('drag-over');
        }
    });

    imageItem.addEventListener('dragleave', () => {
        imageItem.classList.remove('drag-over');
    });

    imageItem.addEventListener('drop', (e) => {
        e.preventDefault();
        imageItem.classList.remove('drag-over');

        if (adminPanel.draggedImage && adminPanel.draggedImage !== imageItem) {
            const container = document.getElementById('images-container');
            if (container) {
                const rect = imageItem.getBoundingClientRect();
                const isAfter = e.clientX > rect.left + rect.width / 2;
                if (isAfter) {
                    container.insertBefore(adminPanel.draggedImage, imageItem.nextSibling);
                } else {
                    container.insertBefore(adminPanel.draggedImage, imageItem);
                }
                updateProductImagesOrder();
            }
        }
    });
}

function updateProductImagesOrder() {
    const imageItems = document.querySelectorAll('.image-item');
    const newImages = [];
    imageItems.forEach(item => {
        const id = parseInt(item.dataset.id);
        const image = productImages.find(img => img.id === id);
        if (image) newImages.push(image);
    });
    productImages = newImages;
}

function deleteProductImage(imageId) {
    const imageItem = document.querySelector(`.image-item[data-id="${imageId}"]`);
    if (imageItem) imageItem.remove();
    productImages = productImages.filter(img => img.id !== imageId);
    const container = document.getElementById('images-container');
    const dropHint = document.getElementById('drop-hint');
    if (container && dropHint && container.children.length === 0) {
        dropHint.classList.add('show');
    }
}

function clearProductImageFields() {
    const container = document.getElementById('images-container');
    const dropHint = document.getElementById('drop-hint');
    if (container) container.innerHTML = '';
    if (dropHint) dropHint.classList.add('show');
    productImages = [];
}

function loadProductImagesToForm(images) {
    clearProductImageFields();
    if (images && Array.isArray(images) && images.length > 0) {
        images.forEach(image => addProductImageField(image));
        const dropHint = document.getElementById('drop-hint');
        if (dropHint) dropHint.classList.remove('show');
    } else {
        const dropHint = document.getElementById('drop-hint');
        if (dropHint) dropHint.classList.add('show');
    }
}

function getProductImagesFromForm() {
    const imageItems = document.querySelectorAll('.image-item');
    const images = [];
    imageItems.forEach((item, index) => {
        const input = item.querySelector('.image-input');
        const url = input ? input.value.trim() : '';
        if (url) {
            images.push({ url: url, alt: `Изображение ${index + 1}` });
        }
    });
    return images;
}

// --- Работа с категориями в форме товара ---

async function loadCategoriesForSelect() {
    try {
        const response = await fetch('/api/categories');
        if (response.ok) {
            const categories = await response.json();
            const categorySelect = document.getElementById('product-category');
            if (categorySelect) {
                categorySelect.innerHTML = '<option value="">Выберите категорию...</option>';
                categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.name;
                    option.textContent = category.name;
                    categorySelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки категорий для селекта:', error);
    }
}

// --- Работа с вариантами товаров ---

async function loadAllProductsCache() {
    try {
        const response = await fetch('/api/products?admin=true');
        if (!response.ok) {
            console.warn('Не удалось загрузить полный список товаров для поиска вариантов.');
            return;
        }
        allProductsCache = await response.json();
        console.log('Кэш всех товаров загружен для поиска вариантов:', allProductsCache.length, 'товаров');
    } catch (error) {
        console.error('Ошибка при загрузке кэша товаров:', error);
        allProductsCache = [];
    }
}

function setupVariantsFunctionality() {
    const searchInput = document.getElementById('variant-search');
    const searchResults = document.getElementById('variant-search-results');
    if (!searchInput || !searchResults) return;

    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const term = e.target.value.trim();
        if (term.length < 2) {
            searchResults.classList.add('hidden');
            return;
        }
        searchTimeout = setTimeout(() => {
            performVariantSearch(term, searchResults);
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.add('hidden');
        }
    });
}

function performVariantSearch(term, container) {
    const currentProductId = document.getElementById('product-id').value;
    const lowerTerm = term.toLowerCase();
    const filteredProducts = allProductsCache.filter(p =>
        p.id != currentProductId &&
        (
            (p.title && p.title.toLowerCase().includes(lowerTerm)) ||
            (p.description && p.description.toLowerCase().includes(lowerTerm)) ||
            (p.category && p.category.toLowerCase().includes(lowerTerm))
        )
    );

    container.innerHTML = '';
    if (filteredProducts.length === 0) {
        container.innerHTML = '<div class="no-results">Товары не найдены</div>';
        container.classList.remove('hidden');
        return;
    }

    filteredProducts.forEach(product => {
        const item = document.createElement('div');
        item.className = 'variant-search-item';
        item.dataset.productId = product.id;
        const imageUrl = product.images && product.images.length > 0 ?
            product.images[0].url : '/assets/icons/placeholder1.webp';
        item.innerHTML = `
            <img src="${imageUrl}" alt="${adminPanel.escapeHtml(product.title)}" onerror="this.src='/assets/icons/placeholder1.webp'">
            <span class="variant-title">${adminPanel.escapeHtml(product.title)}</span>
            <span class="variant-price">${adminPanel.formatPrice(product.price)}</span>
        `;
        item.addEventListener('click', () => {
            addVariantToSelection(product);
            document.getElementById('variant-search').value = '';
            container.classList.add('hidden');
        });
        container.appendChild(item);
    });
    container.classList.remove('hidden');
}

function addVariantToSelection(product) {
    if (selectedVariants.some(v => v.id === product.id)) return;
    selectedVariants.push(product);
    renderSelectedVariants();
    updateSelectedVariantsInput();
}

function removeVariantFromSelection(productId) {
    selectedVariants = selectedVariants.filter(v => v.id !== productId);
    renderSelectedVariants();
    updateSelectedVariantsInput();
}

function renderSelectedVariants() {
    const container = document.getElementById('selected-variants-list');
    if (!container) return;
    container.innerHTML = '';
    selectedVariants.forEach(variant => {
        const item = document.createElement('div');
        item.className = 'selected-variant-item';
        item.dataset.variantId = variant.id;
        item.innerHTML = `
            <span>${adminPanel.escapeHtml(variant.title)}</span>
            <button type="button" class="remove-variant-btn" data-id="${variant.id}" title="Удалить">&times;</button>
        `;
        const removeBtn = item.querySelector('.remove-variant-btn');
        removeBtn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            removeVariantFromSelection(parseInt(e.target.dataset.id));
        });
        container.appendChild(item);
    });
}

function updateSelectedVariantsInput() {
    const input = document.getElementById('selected-variant-ids');
    if (input) input.value = JSON.stringify(selectedVariants.map(v => v.id));
}

async function loadLinkedVariants(productId) {
    try {
        selectedVariants = [];
        const productInCache = allProductsCache.find(p => p.id == productId);
        if (productInCache && productInCache.variants && productInCache.variants.length > 0) {
            selectedVariants = productInCache.variants.map(variantIdOrObj => {
                if (typeof variantIdOrObj === 'object' && variantIdOrObj.id) return variantIdOrObj;
                const id = typeof variantIdOrObj === 'object' ? variantIdOrObj.id : variantIdOrObj;
                return allProductsCache.find(p => p.id == id);
            }).filter(v => v && v.id != productId);
        }
        renderSelectedVariants();
        updateSelectedVariantsInput();
    } catch (error) {
        console.error('Ошибка при загрузке связанных вариантов:', error);
        selectedVariants = [];
        renderSelectedVariants();
        updateSelectedVariantsInput();
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
            adminPanel.showMessage(`${isEdit ? 'Аттракцион обновлен' : 'Аттракцион создан'} успешно!`, 'success');
            adminPanel.closeModal('attraction-modal');
            await loadAttractions(); // Перезагружаем список
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Ошибка ${isEdit ? 'обновления' : 'создания'}: ${response.status}`);
        }
    } catch (error) {
        console.error(`Ошибка ${isEdit ? 'обновления' : 'создания'} аттракциона:`, error);
        adminPanel.showMessage(`Ошибка: ${error.message}`, 'error');
    }
}

async function deleteAttraction(id) {
    if (!confirm('Вы уверены, что хотите удалить этот аттракцион?')) return;
    try {
        const response = await fetch(`/api/attractions/${id}`, { method: 'DELETE' });
        if (response.ok) {
            console.log('Аттракцион удален');
            adminPanel.showMessage('Аттракцион удален успешно!', 'success');
            await loadAttractions(); // Перезагружаем список
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Ошибка удаления: ${response.status}`);
        }
    } catch (error) {
        console.error('Ошибка удаления аттракциона:', error);
        adminPanel.showMessage(`Ошибка удаления: ${error.message}`, 'error');
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

// --- Инициализация после загрузки DOM ---
document.addEventListener('DOMContentLoaded', () => {
    setupAttractionImageEventListeners();
    // Если вкладка аттракционов активна при загрузке, загрузить данные
    if (document.getElementById('attractions-tab')?.classList.contains('active')) {
        loadAttractionsTab();
    }
});