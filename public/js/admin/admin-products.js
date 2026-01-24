// admin-products.js

// Глобальные переменные для товаров
let productImages = [];
let allProductsCache = [];
let selectedVariants = [];

// Инициализация вкладки товаров
async function loadProductsTab() {
    await loadProducts();
    await loadCategoriesForSelect(); // Загружаем категории для селекта в форме
    await loadAllProductsCache();
    setupVariantsFunctionality();
}

// Делаем функцию доступной глобально
window.loadProductsTab = loadProductsTab;

// --- Функции для работы с товарами ---

async function loadProducts() {
    try {
        console.log('Загрузка товаров...');
        const response = await fetchWithAuth('/api/products?admin=true&show_all=true');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // API возвращает объект с полями products и pagination, извлекаем массив
        const products = Array.isArray(data) ? data : (data.products || []);
        
        renderProducts(products);
    } catch (error) {
        console.error('Ошибка загрузки товаров:', error);
        adminPanel.showMessage('Не удалось загрузить товары', 'error');
    }
}

// Вспомогательная функция для получения URL изображения (поддержка разных форматов)
function getImageUrl(images) {
    if (!images || images.length === 0) return '/assets/icons/placeholder1.webp';
    const firstImage = images[0];
    if (typeof firstImage === 'string') return firstImage;
    if (typeof firstImage === 'object' && firstImage.url) return firstImage.url;
    return '/assets/icons/placeholder1.webp';
}

function renderProducts(products) {
    // Теперь используем tbody таблицы
    const container = document.getElementById('admin-products-list');
    if (!container) {
        console.error('Контейнер таблицы товаров не найден');
        return;
    }

    container.innerHTML = '';

    if (!products || products.length === 0) {
        container.innerHTML = '<tr><td colspan="7" class="empty">Нет товаров для отображения</td></tr>';
        return;
    }

    products.forEach(product => {
        const tr = document.createElement('tr');
        
        const imageUrl = getImageUrl(product.images);
        
        const statusClass = product.available ? 'success' : 'error';
        const statusText = product.available ? 'В наличии' : 'Недоступен';

        tr.innerHTML = `
            <td>
                <img src="${imageUrl}" alt="${adminPanel.escapeHtml(product.title)}" class="product-thumb" onerror="this.src='/assets/icons/placeholder1.webp'">
            </td>
            <td>${product.id}</td>
            <td><strong>${adminPanel.escapeHtml(product.title)}</strong></td>
            <td>${adminPanel.escapeHtml(product.category || '—')}</td>
            <td>${adminPanel.formatPrice(product.price)}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <div class="action-buttons">
                    <button onclick="openProductModal(${product.id})" class="btn-icon" title="Редактировать">
                        ✏️
                    </button>
                    <button onclick="deleteProduct(${product.id})" class="btn-icon delete" title="Удалить">
                        🗑️
                    </button>
                </div>
            </td>
        `;

        container.appendChild(tr);
    });
}

// --- Модальное окно товара ---

function openProductModal(productId = null) {
    const modal = document.getElementById('product-modal');
    const title = document.getElementById('modal-title');
    const form = document.getElementById('product-form');

    if (!modal || !title || !form) {
        console.error('Элементы модального окна товара не найдены');
        return;
    }

    // Сброс формы и изображений
    form.reset();
    clearProductImageFields();
    selectedVariants = [];
    renderSelectedVariants();
    updateSelectedVariantsInput();

    if (productId) {
        // Редактирование
        loadProductForEdit(productId);
    } else {
        // Добавление нового
        title.textContent = 'Добавить товар';
        document.getElementById('product-id').value = '';
        document.getElementById('product-available').checked = true;
        modal.style.display = 'block';
        document.body.classList.add('modal-open');
    }
    
    // Скрываем секцию товаров комплекта - комплекты редактируются в отдельной вкладке
    const kitItemsSection = document.getElementById('kit-items-section');
    if (kitItemsSection) {
        kitItemsSection.style.display = 'none';
    }
}

async function loadProductForEdit(productId) {
    try {
        const response = await fetchWithAuth(`/api/products/${productId}`);
        if (response.ok) {
            const product = await response.json();
            const title = document.getElementById('modal-title');
            title.textContent = 'Редактировать товар';
            document.getElementById('product-id').value = product.id || '';
            document.getElementById('product-title').value = product.title || '';
            document.getElementById('product-description').value = product.description || '';
            document.getElementById('product-price').value = product.price || '';
            document.getElementById('product-supplier-link').value = product.supplier_link || '';
            document.getElementById('product-supplier-notes').value = product.supplier_notes || '';

            const categoryInput = document.getElementById('product-category');
            const productCategory = product.category || '';
            if (categoryInput) {
                categoryInput.value = productCategory;
            }

            const brandInput = document.getElementById('product-brand');
            if (brandInput) {
                brandInput.value = product.brand || '';
            }

            const tagSelect = document.getElementById('product-tag');
            if (tagSelect) {
                tagSelect.value = product.tag || '';
            }

            const compatibilityInput = document.getElementById('product-compatibility');
            if (compatibilityInput) {
                // Если compatibility - массив, объединяем в строку через запятую
                if (Array.isArray(product.compatibility)) {
                    compatibilityInput.value = product.compatibility.join(', ');
                } else if (product.compatibility) {
                    compatibilityInput.value = product.compatibility;
                } else {
                    compatibilityInput.value = '';
                }
            }

            document.getElementById('product-available').checked = product.available !== false;

            loadProductImagesToForm(product.images || []);

            if (product.id) {
                await loadLinkedVariants(product.id);
            }

            // Скрываем секцию товаров комплекта - комплекты редактируются в отдельной вкладке
            const kitItemsSection = document.getElementById('kit-items-section');
            if (kitItemsSection) {
                kitItemsSection.style.display = 'none';
            }

            const modal = document.getElementById('product-modal');
            modal.style.display = 'block';
            document.body.classList.add('modal-open');
            
            // Убеждаемся, что секция товаров комплекта видна если это комплект
            setTimeout(() => {
                const categoryInput = document.getElementById('product-category');
                if (categoryInput && categoryInput.value.trim() === 'Готовые комплекты') {
                    updateKitItemsSectionVisibility('Готовые комплекты');
                }
            }, 100);
        } else {
            throw new Error('Товар не найден');
        }
    } catch (error) {
        console.error('Ошибка загрузки товара для редактирования:', error);
        adminPanel.showMessage('Ошибка загрузки товара для редактирования', 'error');
    }
}

document.getElementById('product-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveProduct();
});

document.getElementById('add-product-btn')?.addEventListener('click', () => {
    openProductModal();
});

// Закрытие модального окна товара
document.querySelector('#product-modal .close')?.addEventListener('click', () => {
    adminPanel.closeModal('product-modal');
});
document.getElementById('cancel-btn')?.addEventListener('click', () => {
    adminPanel.closeModal('product-modal');
});

// --- Работа с изображениями товаров ---

function setupProductImageEventListeners() {
    const addImageBtn = document.getElementById('add-image-btn');
    if (addImageBtn) {
        addImageBtn.addEventListener('click', () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.multiple = true;
            fileInput.style.display = 'none';
            fileInput.addEventListener('change', (e) => {
                handleProductFileSelect(e.target.files);
            });
            document.body.appendChild(fileInput);
            fileInput.click();
            document.body.removeChild(fileInput);
        });
    }

    const dropZone = document.getElementById('images-drop-zone');
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
                handleProductFileSelect(files);
            }
        });
    }
}

async function handleProductFileSelect(files) {
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
                addProductImageField({ url: data.url, alt: file.name });
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
        // window.draggedImage = imageItem; // Устаревшая строка
        imageItem.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        // Используем 'text/plain' для обхода ограничений Chrome, передавая ID элемента
        e.dataTransfer.setData('text/plain', imageItem.dataset.id); 
    });

    imageItem.addEventListener('dragend', () => {
        imageItem.classList.remove('dragging');
        const container = document.getElementById('images-container');
        if (container) {
            const draggables = container.querySelectorAll('.image-item.drag-over');
            draggables.forEach(item => item.classList.remove('drag-over'));
        }
        // window.draggedImage = null; // Устаревшая строка
    });

    imageItem.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        // if (window.draggedImage !== imageItem) { // Устаревшая проверка
        // Получаем ID перетаскиваемого элемента из dataTransfer
        const draggedId = e.dataTransfer.getData('text/plain');
        const draggedElement = document.querySelector(`#images-container .image-item[data-id="${draggedId}"]`);
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

        // Получаем ID перетаскиваемого элемента из dataTransfer
        const draggedId = e.dataTransfer.getData('text/plain');
        // Находим сам элемент по ID
        const draggedElement = document.querySelector(`#images-container .image-item[data-id="${draggedId}"]`);
        
        // Проверяем, что перетаскиваемый элемент существует и это не тот же элемент
        if (draggedElement && draggedElement !== imageItem) {
            const container = document.getElementById('images-container');
            if (container) {
                // Определяем, куда вставлять: после imageItem или перед ним
                const rect = imageItem.getBoundingClientRect();
                const isAfter = e.clientX > rect.left + rect.width / 2;
                
                if (isAfter) {
                    // Вставляем ПОСЛЕ imageItem
                    container.insertBefore(draggedElement, imageItem.nextSibling);
                } else {
                    // Вставляем ПЕРЕД imageItem
                    container.insertBefore(draggedElement, imageItem);
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
        const response = await fetchWithAuth('/api/categories');
        if (response.ok) {
            const categories = await response.json();
            const categoryDatalist = document.getElementById('category-list');
            if (categoryDatalist) {
                categoryDatalist.innerHTML = '';
                categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.name;
                    categoryDatalist.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки категорий для datalist:', error);
    }
}

// --- Загрузка кэша всех товаров для поиска вариантов ---
// Обратите внимание: используем show_all=true, чтобы получить все товары, включая недоступные
async function loadAllProductsCache() {
    try {
        // Обновляем кэш, используя show_all=true
        const response = await fetchWithAuth('/api/products?admin=true&show_all=true');
        if (!response.ok) {
            console.warn('Не удалось загрузить полный список товаров для поиска вариантов.');
            allProductsCache = []; // Очищаем кэш в случае ошибки
            return;
        }
        const data = await response.json();
        // API возвращает объект с полями products и pagination, извлекаем массив
        allProductsCache = Array.isArray(data) ? data : (data.products || []);
        console.log(`Кэш товаров обновлён. Загружено ${allProductsCache.length} товаров.`);
    } catch (error) {
        console.error('Ошибка при загрузке кэша товаров:', error);
        allProductsCache = []; // Очищаем кэш в случае ошибки
    }
}

// --- Работа с вариантами товаров ---

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

// --- Сохранение/Удаление товара ---

async function saveProduct() {
    try {
        const form = document.getElementById('product-form');
        const formData = new FormData(form);

        let title = (formData.get('product-title') || '').toString().trim();
        const description = (formData.get('product-description') || '').toString().trim();
        const rawPrice = formData.get('product-price');
        const price = rawPrice !== null && rawPrice !== '' ? parseFloat(rawPrice) : 0;
        const category = (formData.get('product-category') || '').toString().trim();
        const brand = (formData.get('product-brand') || '').toString().trim();
        const tag = (formData.get('product-tag') || '').toString().trim();
        const available = formData.get('product-available') === 'on';
        const supplier_link = (formData.get('product-supplier-link') || '').toString().trim();
        const supplier_notes = (formData.get('product-supplier-notes') || '').toString().trim();
        const compatibility = (formData.get('product-compatibility') || '').toString().trim();
        const images = getProductImagesFromForm();

        let selectedVariantIds = [];
        try {
            const idsString = document.getElementById('selected-variant-ids')?.value;
            if (idsString) selectedVariantIds = JSON.parse(idsString);
        } catch (e) {
            console.error('Ошибка парсинга selected-variant-ids:', e);
            selectedVariantIds = [];
        }

        const productId = formData.get('product-id');
        const isUpdate = productId && productId.trim() !== '';
        const method = isUpdate ? 'PUT' : 'POST';
        const url = isUpdate ? `/api/products/${productId.trim()}` : '/api/products';

        // Для PUT запроса отправляем images, для POST - images_json
        const productData = {
            title: title,
            description: description,
            price: price,
            category: category,
            brand: brand || null,
            tag: tag || null,
            available: available,
            supplier_link: supplier_link,
            supplier_notes: supplier_notes,
            compatibility: compatibility || null
        };

        // Убеждаемся, что images всегда массив
        const imagesArray = Array.isArray(images) ? images : [];
        
        if (isUpdate) {
            // Для обновления отправляем images (сервер преобразует в images_json)
            productData.images = imagesArray;
        } else {
            // Для создания отправляем images_json
            productData.images_json = imagesArray.length > 0 ? JSON.stringify(imagesArray) : null;
        }

        if (!productData.title) {
            adminPanel.showMessage('Пожалуйста, укажите название товара', 'error');
            return;
        }
        if (isNaN(productData.price) || productData.price <= 0) {
            adminPanel.showMessage('Пожалуйста, укажите корректную цену (больше 0)', 'error');
            return;
        }
        if (!productData.category) {
            adminPanel.showMessage('Пожалуйста, выберите категорию', 'error');
            return;
        }

        const response = await fetchWithAuth(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(productData)
        });

        if (!response.ok) {
            let errorMessage = `Ошибка сохранения товара: ${response.status}`;
            let errorDetails = null;
            let errorCode = null;
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorData.error || errorMessage;
                errorDetails = errorData.details || errorData.detail || null;
            } catch (e) {
                const errorText = await response.text().catch(() => '');
                errorMessage = errorText || errorMessage;
            }
            throw new Error(errorMessage + (errorDetails ? `: ${errorDetails}` : ''));
        }

        const savedProduct = await response.json();

        if (savedProduct && savedProduct.id) {
            const variantLinkResponse = await fetchWithAuth(`/api/products/${savedProduct.id}/variants`, {
                method: 'PUT',
                body: JSON.stringify({ variantIds: selectedVariantIds })
            });

            if (!variantLinkResponse.ok) {
                console.error('Ошибка при сохранении связей с вариантами:', variantLinkResponse.statusText);
                adminPanel.showMessage('Товар сохранен, но возникла ошибка при сохранении вариантов. Проверьте связи.', 'warning');
            } else {
                console.log('Связи с вариантами успешно сохранены.');
            }

            // Комплекты редактируются в отдельной вкладке, поэтому здесь не сохраняем товары комплекта
        } else {
            console.error('Не удалось получить ID сохраненного товара для установки вариантов.');
            adminPanel.showMessage('Товар сохранен, но не удалось обновить связи с вариантами.', 'warning');
        }

        adminPanel.closeModal('product-modal');
        await loadProducts();
        await loadAllProductsCache();
        adminPanel.showMessage(
            isUpdate ? 'Товар и его варианты обновлены успешно!' : 'Товар и его варианты созданы успешно!',
            'success'
        );
    } catch (error) {
        console.error('Ошибка в функции saveProduct:', error);
        adminPanel.showMessage(`Ошибка сохранения товара: ${error.message}`, 'error');
    }
}

async function deleteProduct(productId) {
    if (!confirm('Вы уверены, что хотите удалить этот товар?')) return;
    try {
        const response = await fetchWithAuth(`/api/products/${productId}`, { method: 'DELETE' });
        if (response.ok) {
            await loadProducts();
            adminPanel.showMessage('Товар удален успешно!', 'success');
        } else {
            const errorText = await response.text();
            throw new Error(`Ошибка удаления товара: ${response.status} - ${errorText}`);
        }
    } catch (error) {
        console.error('Ошибка удаления товара:', error);
        adminPanel.showMessage('Ошибка удаления товара: ' + error.message, 'error');
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    setupProductImageEventListeners();
    // Если вкладка товаров активна при загрузке, загрузить данные
    if (document.getElementById('products-tab')?.classList.contains('active')) {
        loadProductsTab();
    }
});