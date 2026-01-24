// admin-kits.js

// Глобальные переменные для комплектов (с уникальными именами)
let kitsManagerImages = [];
let kitsManagerAllProductsCache = [];
let kitsManagerKitItems = [];

// Инициализация вкладки комплектов
async function loadKitsTab() {
    await kitsManagerLoadKits();
    await kitsManagerLoadAllProductsCache();
    kitsManagerSetupItemsFunctionality();
}

// Делаем функцию доступной глобально
window.loadKitsTab = loadKitsTab;

// --- Функции для работы с комплектами ---

async function kitsManagerLoadKits() {
    try {
        console.log('Загрузка комплектов...');
        const response = await fetchWithAuth('/api/products?admin=true&show_all=true');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        const products = Array.isArray(data) ? data : (data.products || []);
        // Фильтруем только комплекты
        const kits = products.filter(p => p.category === 'Готовые комплекты');
        
        kitsManagerRenderKits(kits);
    } catch (error) {
        console.error('Ошибка загрузки комплектов:', error);
        adminPanel.showMessage('Не удалось загрузить комплекты', 'error');
    }
}

function getImageUrl(images) {
    if (!images || images.length === 0) return '/assets/icons/placeholder1.webp';
    const firstImage = images[0];
    if (typeof firstImage === 'string') return firstImage;
    if (typeof firstImage === 'object' && firstImage.url) return firstImage.url;
    return '/assets/icons/placeholder1.webp';
}

function kitsManagerRenderKits(kits) {
    const container = document.getElementById('admin-kits-grid');
    if (!container) {
        console.error('Контейнер для комплектов не найден');
        return;
    }

    container.innerHTML = '';

    if (!kits || kits.length === 0) {
        container.innerHTML = '<div class="empty">Нет комплектов для отображения</div>';
        return;
    }

    kits.forEach(kit => {
        const card = document.createElement('div');
        card.className = 'product-card';

        const imageUrl = getImageUrl(kit.images);

        card.innerHTML = `
            <img src="${imageUrl}" alt="${adminPanel.escapeHtml(kit.title)}" onerror="this.src='/assets/icons/placeholder1.webp'">
            <h3>${adminPanel.escapeHtml(kit.title)}</h3>
            <p>Цена: ${adminPanel.formatPrice(kit.price)}</p>
            <p>Доступность: ${kit.available !== undefined ? (kit.available ? 'Да' : 'Нет') : 'Не указано'}</p>
            <div class="product-actions">
                <button onclick="kitsManagerOpenModal(${kit.id})" class="btn-primary">Редактировать</button>
                <button onclick="kitsManagerDeleteKit(${kit.id})" class="btn-danger">Удалить</button>
            </div>
        `;

        container.appendChild(card);
    });
}

// --- Модальное окно комплекта ---

function kitsManagerOpenModal(kitId = null) {
    const modal = document.getElementById('kit-modal');
    const title = document.getElementById('kit-modal-title');
    const form = document.getElementById('kit-form');

    if (!modal || !title || !form) {
        console.error('Элементы модального окна комплекта не найдены');
        return;
    }

    // Сброс формы и изображений
    form.reset();
    kitsManagerClearImageFields();
    kitsManagerKitItems = [];
    kitsManagerRenderKitItems();
    kitsManagerUpdateItemsInput();

    if (kitId) {
        // Редактирование
        kitsManagerLoadKitForEdit(kitId);
    } else {
        // Добавление нового
        title.textContent = 'Добавить комплект';
        document.getElementById('kit-id').value = '';
        document.getElementById('kit-available').checked = true;
        // При создании нового комплекта цена 0
        document.getElementById('kit-price').value = 0;
        modal.style.display = 'block';
        document.body.classList.add('modal-open');
    }
}

async function kitsManagerLoadKitForEdit(kitId) {
    try {
        // Используем прямой запрос через админский API
        const response = await fetchWithAuth(`/api/products/${kitId}`);
        if (!response.ok) {
            throw new Error('Комплект не найден');
        }
        const kit = await response.json();
        await kitsManagerPopulateForm(kit, kitId);
    } catch (error) {
        console.error('Ошибка загрузки комплекта для редактирования:', error);
        adminPanel.showMessage('Ошибка загрузки комплекта для редактирования', 'error');
    }
}

async function kitsManagerPopulateForm(kit, kitId) {
    const title = document.getElementById('kit-modal-title');
    title.textContent = 'Редактировать комплект';
    document.getElementById('kit-id').value = kitId;
    document.getElementById('kit-title').value = kit.title || '';
    document.getElementById('kit-description').value = kit.description || '';
    document.getElementById('kit-price').value = kit.price || '';
    
    const tagSelect = document.getElementById('kit-tag');
    if (tagSelect) {
        tagSelect.value = kit.tag || '';
    }

    document.getElementById('kit-available').checked = kit.available !== false;

    kitsManagerLoadImagesToForm(kit.images || []);

    // Загружаем товары комплекта
    await kitsManagerLoadKitItems(kitId);

    const modal = document.getElementById('kit-modal');
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
}


document.getElementById('kit-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await kitsManagerSaveKit();
});

document.getElementById('add-kit-btn')?.addEventListener('click', () => {
    kitsManagerOpenModal();
});

// Закрытие модального окна комплекта
document.querySelector('#kit-modal .close-kit-modal')?.addEventListener('click', () => {
    adminPanel.closeModal('kit-modal');
});
document.getElementById('cancel-kit-btn')?.addEventListener('click', () => {
    adminPanel.closeModal('kit-modal');
});

// --- Работа с изображениями комплекта ---

function kitsManagerSetupImageEventListeners() {
    const addImageBtn = document.getElementById('add-kit-image-btn');
    if (addImageBtn) {
        addImageBtn.addEventListener('click', () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.multiple = true;
            fileInput.style.display = 'none';
            fileInput.addEventListener('change', (e) => {
                kitsManagerHandleFileSelect(e.target.files);
            });
            document.body.appendChild(fileInput);
            fileInput.click();
            document.body.removeChild(fileInput);
        });
    }

    const dropZone = document.getElementById('kit-images-drop-zone');
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
                kitsManagerHandleFileSelect(files);
            }
        });
    }
}

async function kitsManagerHandleFileSelect(files) {
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
                kitsManagerAddImageField({ url: data.url, alt: file.name });
            } catch (error) {
                console.error('Ошибка при загрузке файла:', error);
                adminPanel.showMessage(`Ошибка загрузки ${file.name}: ${error.message}`, 'error');
            }
        } else {
            adminPanel.showMessage(`Файл ${file.name} не является изображением`, 'error');
        }
    }
}

function kitsManagerAddImageField(imageData = null) {
    const container = document.getElementById('kit-images-container');
    const dropHint = document.getElementById('kit-drop-hint');

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

    kitsManagerSetupImageDragEvents(imageItem);

    kitsManagerImages.push({
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
            kitsManagerDeleteImage(imageId);
        });
    }
}

function kitsManagerSetupImageDragEvents(imageItem) {
    imageItem.addEventListener('dragstart', (e) => {
        imageItem.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', imageItem.dataset.id);
    });

    imageItem.addEventListener('dragend', () => {
        imageItem.classList.remove('dragging');
        const container = document.getElementById('kit-images-container');
        if (container) {
            const draggables = container.querySelectorAll('.image-item.drag-over');
            draggables.forEach(item => item.classList.remove('drag-over'));
        }
    });

    imageItem.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const draggedId = e.dataTransfer.getData('text/plain');
        const draggedElement = document.querySelector(`#kit-images-container .image-item[data-id="${draggedId}"]`);
        if (draggedElement && draggedElement !== imageItem) {
            imageItem.classList.add('drag-over');
        }
    });

    imageItem.addEventListener('dragleave', () => {
        imageItem.classList.remove('drag-over');
    });

    imageItem.addEventListener('drop', (e) => {
        e.preventDefault();
        imageItem.classList.remove('drag-over');

        const draggedId = e.dataTransfer.getData('text/plain');
        const draggedElement = document.querySelector(`#kit-images-container .image-item[data-id="${draggedId}"]`);
        
        if (draggedElement && draggedElement !== imageItem) {
            const container = document.getElementById('kit-images-container');
            if (container) {
                const rect = imageItem.getBoundingClientRect();
                const isAfter = e.clientX > rect.left + rect.width / 2;
                
                if (isAfter) {
                    container.insertBefore(draggedElement, imageItem.nextSibling);
                } else {
                    container.insertBefore(draggedElement, imageItem);
                }
                
                kitsManagerUpdateImagesOrder();
            }
        }
    });
}

function kitsManagerUpdateImagesOrder() {
    const imageItems = document.querySelectorAll('#kit-images-container .image-item');
    const newImages = [];
    imageItems.forEach(item => {
        const id = parseInt(item.dataset.id);
        const image = kitsManagerImages.find(img => img.id === id);
        if (image) newImages.push(image);
    });
    kitsManagerImages = newImages;
}

function kitsManagerDeleteImage(imageId) {
    const imageItem = document.querySelector(`#kit-images-container .image-item[data-id="${imageId}"]`);
    if (imageItem) imageItem.remove();
    kitsManagerImages = kitsManagerImages.filter(img => img.id !== imageId);
    const container = document.getElementById('kit-images-container');
    const dropHint = document.getElementById('kit-drop-hint');
    if (container && dropHint && container.children.length === 0) {
        dropHint.classList.add('show');
    }
}

function kitsManagerClearImageFields() {
    const container = document.getElementById('kit-images-container');
    const dropHint = document.getElementById('kit-drop-hint');
    if (container) container.innerHTML = '';
    if (dropHint) dropHint.classList.add('show');
    kitsManagerImages = [];
}

function kitsManagerLoadImagesToForm(images) {
    kitsManagerClearImageFields();
    if (images && Array.isArray(images) && images.length > 0) {
        images.forEach(image => kitsManagerAddImageField(image));
        const dropHint = document.getElementById('kit-drop-hint');
        if (dropHint) dropHint.classList.remove('show');
    } else {
        const dropHint = document.getElementById('kit-drop-hint');
        if (dropHint) dropHint.classList.add('show');
    }
}

function kitsManagerGetImagesFromForm() {
    const imageItems = document.querySelectorAll('#kit-images-container .image-item');
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

// --- Загрузка кэша всех товаров для поиска ---
async function kitsManagerLoadAllProductsCache() {
    try {
        const response = await fetchWithAuth('/api/products?admin=true&show_all=true');
        if (!response.ok) {
            console.warn('Не удалось загрузить полный список товаров для поиска.');
            kitsManagerAllProductsCache = [];
            return;
        }
        const data = await response.json();
        kitsManagerAllProductsCache = Array.isArray(data) ? data : (data.products || []);
        console.log(`Кэш товаров комплектов обновлён. Загружено ${kitsManagerAllProductsCache.length} товаров.`);
    } catch (error) {
        console.error('Ошибка при загрузке кэша товаров комплектов:', error);
        kitsManagerAllProductsCache = [];
    }
}

// --- Работа с товарами комплекта ---

function kitsManagerSetupItemsFunctionality() {
    const searchInput = document.getElementById('kit-item-search');
    const searchResults = document.getElementById('kit-item-search-results');
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
            kitsManagerPerformItemSearch(term, searchResults);
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.add('hidden');
        }
    });
}

function kitsManagerPerformItemSearch(term, container) {
    const currentKitId = document.getElementById('kit-id').value;
    const lowerTerm = term.toLowerCase();
    const filteredProducts = kitsManagerAllProductsCache.filter(p =>
        p.id != currentKitId &&
        p.category !== 'Готовые комплекты' && // Не добавляем комплекты в комплекты
        !kitsManagerKitItems.some(ki => ki.product.id === p.id) && // Не добавляем уже добавленные
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
            kitsManagerAddKitItem(product);
            document.getElementById('kit-item-search').value = '';
            container.classList.add('hidden');
        });
        container.appendChild(item);
    });
    container.classList.remove('hidden');
}

function kitsManagerAddKitItem(product) {
    if (kitsManagerKitItems.some(ki => ki.product.id === product.id)) return;
    kitsManagerKitItems.push({
        product: product,
        quantity: 1,
        display_order: kitsManagerKitItems.length
    });
    kitsManagerRenderKitItems();
    kitsManagerUpdateItemsInput();
    kitsManagerCalculateTotalPrice();
}

function kitsManagerRemoveKitItem(productId) {
    kitsManagerKitItems = kitsManagerKitItems.filter(ki => ki.product.id !== productId);
    kitsManagerKitItems.forEach((item, index) => {
        item.display_order = index;
    });
    kitsManagerRenderKitItems();
    kitsManagerUpdateItemsInput();
    kitsManagerCalculateTotalPrice();
}

function kitsManagerUpdateItemQuantity(productId, quantity) {
    const item = kitsManagerKitItems.find(ki => ki.product.id === productId);
    if (item) {
        item.quantity = Math.max(1, parseInt(quantity) || 1);
        kitsManagerUpdateItemsInput();
        kitsManagerCalculateTotalPrice();
    }
}

function kitsManagerCalculateTotalPrice() {
    const totalPrice = kitsManagerKitItems.reduce((sum, item) => {
        const price = parseFloat(item.product.price) || 0;
        const quantity = parseInt(item.quantity) || 1;
        return sum + (price * quantity);
    }, 0);
    
    const priceInput = document.getElementById('kit-price');
    if (priceInput) {
        priceInput.value = totalPrice;
    }
}

function kitsManagerRenderKitItems() {
    const container = document.getElementById('kit-items-list');
    if (!container) return;
    container.innerHTML = '';
    
    if (kitsManagerKitItems.length === 0) {
        container.innerHTML = '<div class="empty-kit-items">Товары комплекта не добавлены</div>';
        return;
    }

    kitsManagerKitItems.forEach((kitItem, index) => {
        const item = document.createElement('div');
        item.className = 'kit-item-row';
        item.dataset.productId = kitItem.product.id;
        const imageUrl = kitItem.product.images && kitItem.product.images.length > 0 ?
            kitItem.product.images[0].url : '/assets/icons/placeholder1.webp';
        item.innerHTML = `
            <div class="kit-item-info">
                <img src="${imageUrl}" alt="${adminPanel.escapeHtml(kitItem.product.title)}" onerror="this.src='/assets/icons/placeholder1.webp'">
                <div class="kit-item-details">
                    <span class="kit-item-title">${adminPanel.escapeHtml(kitItem.product.title)}</span>
                    <span class="kit-item-price">${adminPanel.formatPrice(kitItem.product.price)}</span>
                </div>
            </div>
            <div class="kit-item-controls">
                <label>
                    Количество:
                    <input type="number" class="kit-item-quantity" value="${kitItem.quantity}" min="1" 
                           data-product-id="${kitItem.product.id}">
                </label>
                <button type="button" class="remove-kit-item-btn" data-id="${kitItem.product.id}" title="Удалить">&times;</button>
            </div>
        `;
        
        const removeBtn = item.querySelector('.remove-kit-item-btn');
        removeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            kitsManagerRemoveKitItem(parseInt(e.target.dataset.id));
        });

        const quantityInput = item.querySelector('.kit-item-quantity');
        quantityInput.addEventListener('change', (e) => {
            kitsManagerUpdateItemQuantity(parseInt(e.target.dataset.productId), e.target.value);
        });

        container.appendChild(item);
    });
}

function kitsManagerUpdateItemsInput() {
    const input = document.getElementById('kit-items-data');
    if (input) {
        input.value = JSON.stringify(kitsManagerKitItems.map(ki => ({
            product_id: ki.product.id,
            quantity: ki.quantity,
            display_order: ki.display_order
        })));
    }
}

async function kitsManagerLoadKitItems(kitId) {
    try {
        kitsManagerKitItems = [];
        const response = await fetchWithAuth(`/api/kits/${kitId}/items`);
        if (response.ok) {
            const items = await response.json();
            kitsManagerKitItems = items.map(item => ({
                product: item.product,
                quantity: item.quantity || 1,
                display_order: item.display_order || 0
            }));
        }
        kitsManagerRenderKitItems();
        kitsManagerUpdateItemsInput();
    } catch (error) {
        console.error('Ошибка при загрузке товаров комплекта:', error);
        kitsManagerKitItems = [];
        kitsManagerRenderKitItems();
        kitsManagerUpdateItemsInput();
    }
}

// --- Сохранение/Удаление комплекта ---

async function kitsManagerSaveKit() {
    try {
        const form = document.getElementById('kit-form');
        const formData = new FormData(form);

        let title = (formData.get('kit-title') || '').toString().trim();
        const description = (formData.get('kit-description') || '').toString().trim();
        const rawPrice = formData.get('kit-price');
        const price = rawPrice !== null && rawPrice !== '' ? parseFloat(rawPrice) : 0;
        const tag = (formData.get('kit-tag') || '').toString().trim();
        const available = formData.get('kit-available') === 'on';
        const images = kitsManagerGetImagesFromForm();

        const kitId = formData.get('kit-id');
        const isUpdate = kitId && kitId.trim() !== '';
        const method = isUpdate ? 'PUT' : 'POST';
        const url = isUpdate ? `/api/products/${kitId.trim()}` : '/api/products';

        const kitData = {
            title: title,
            description: description,
            price: price,
            category: 'Готовые комплекты',
            tag: tag || null,
            available: available
        };

        const imagesArray = Array.isArray(images) ? images : [];
        
        if (isUpdate) {
            kitData.images = imagesArray;
        } else {
            kitData.images_json = imagesArray.length > 0 ? JSON.stringify(imagesArray) : null;
        }

        if (!kitData.title) {
            adminPanel.showMessage('Пожалуйста, укажите название комплекта', 'error');
            return;
        }
        if (isNaN(kitData.price) || kitData.price <= 0) {
            adminPanel.showMessage('Пожалуйста, укажите корректную цену (больше 0)', 'error');
            return;
        }

        const response = await fetchWithAuth(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(kitData)
        });

        if (!response.ok) {
            let errorMessage = `Ошибка сохранения комплекта: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorData.error || errorMessage;
            } catch (e) {
                const errorText = await response.text().catch(() => '');
                errorMessage = errorText || errorMessage;
            }
            throw new Error(errorMessage);
        }

        const savedKit = await response.json();
        const savedKitId = savedKit.id || kitId;

        // Сохраняем товары комплекта
        if (savedKitId) {
            const kitItemsData = kitsManagerKitItems.map((item, index) => ({
                product_id: item.product.id,
                quantity: item.quantity || 1,
                display_order: index
            }));

            const kitItemsResponse = await fetchWithAuth(`/api/kits/${savedKitId}/items`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ items: kitItemsData })
            });

            if (!kitItemsResponse.ok) {
                console.error('Ошибка при сохранении товаров комплекта:', kitItemsResponse.statusText);
                adminPanel.showMessage('Комплект сохранен, но возникла ошибка при сохранении товаров комплекта.', 'warning');
            } else {
                console.log('Товары комплекта успешно сохранены.');
            }
        }

        adminPanel.closeModal('kit-modal');
        await kitsManagerLoadKits();
        await kitsManagerLoadAllProductsCache();
        adminPanel.showMessage(
            isUpdate ? 'Комплект обновлен успешно!' : 'Комплект создан успешно!',
            'success'
        );
    } catch (error) {
        console.error('Ошибка в функции saveKit:', error);
        adminPanel.showMessage(`Ошибка сохранения комплекта: ${error.message}`, 'error');
    }
}

async function kitsManagerDeleteKit(kitId) {
    if (!confirm('Вы уверены, что хотите удалить этот комплект?')) return;
    try {
        const response = await fetchWithAuth(`/api/products/${kitId}`, { method: 'DELETE' });
        if (response.ok) {
            await kitsManagerLoadKits();
            adminPanel.showMessage('Комплект удален успешно!', 'success');
        } else {
            const errorText = await response.text();
            throw new Error(`Ошибка удаления комплекта: ${response.status} - ${errorText}`);
        }
    } catch (error) {
        console.error('Ошибка удаления комплекта:', error);
        adminPanel.showMessage('Ошибка удаления комплекта: ' + error.message, 'error');
    }
}

// Делаем функции доступными глобально
window.kitsManagerOpenModal = kitsManagerOpenModal;
window.kitsManagerDeleteKit = kitsManagerDeleteKit;
window.openKitModal = kitsManagerOpenModal;
window.deleteKit = kitsManagerDeleteKit;

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    kitsManagerSetupImageEventListeners();
    // Если вкладка комплектов активна при загрузке, загрузить данные
    if (document.getElementById('kits-tab')?.classList.contains('active')) {
        loadKitsTab();
    }
});
