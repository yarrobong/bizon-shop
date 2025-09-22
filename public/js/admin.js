// В самом начале admin.js, замените старую проверку на эту:
// Проверка авторизации
if (localStorage.getItem('isAdmin') !== 'true') {
    // Проверяем, не находится ли пользователь уже на странице логина
    if (!window.location.pathname.includes('login.html')) {
        window.location.href = '../login.html'; // Убедитесь, что путь правильный
    }
}

class AdminPanel {
    constructor() {
        this.currentTab = 'products';
        this.images = []; // Массив для хранения изображений
        this.attractionImages = [];
        this.draggedImage = null;
        this.allProductsCache = []; // Инициализация кэша
        this.selectedVariants = []; // Инициализация выбранных вариантов
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadProducts();
        await this.loadAttractions();
        await this.loadCategories(); // Загружаем категории для селекта
        await this.setupAttractionEventListeners();
        await this.loadOrders();
        await this.loadSupplierCatalog(); // Загружаем каталог при инициализации
        await this.loadAllProductsCache();
        this.setupVariantsFunctionality();
    }

    setupEventListeners() {
        // Навигация по вкладкам
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Кнопки действий
        document.getElementById('add-product-btn')?.addEventListener('click', () => {
            this.openProductModal();
        });

        document.getElementById('add-category-btn')?.addEventListener('click', () => {
            this.openCategoryModal();
        });

        document.getElementById('logout-btn')?.addEventListener('click', () => {
            this.logout();
        });

        // Модальное окно товара
        document.querySelector('.close')?.addEventListener('click', () => {
            this.closeModal('product-modal');
        });

        document.getElementById('cancel-btn')?.addEventListener('click', () => {
            this.closeModal('product-modal');
        });

        document.querySelector('.close-attraction-modal')?.addEventListener('click', () => {
            this.closeModal('attraction-modal');
        });
        document.getElementById('cancel-attraction-btn')?.addEventListener('click', () => {
            this.closeModal('attraction-modal');
        });

        // Модальное окно категории
        document.querySelector('.close-category-modal')?.addEventListener('click', () => {
            this.closeModal('category-modal');
        });

        document.getElementById('cancel-category-btn')?.addEventListener('click', () => {
            this.closeModal('category-modal');
        });

        // Закрытие модального окна по клику вне его
        window.addEventListener('click', (e) => {
            if (e.target.id === 'product-modal') {
                this.closeModal('product-modal');
            }
            if (e.target.id === 'category-modal') {
                this.closeModal('category-modal');
            }
        });

        // Форма товара
        document.getElementById('product-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProduct();
        });
        // Новая форма для аттракциона
        document.getElementById('attraction-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveAttraction();
        });
        // Форма категории
        document.getElementById('category-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCategory();
        });

        // Настройка drag & drop для изображений
        this.setupImageEventListeners();

        const searchInput = document.getElementById('supplier-catalog-search');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                const term = e.target.value.trim();
                // Добавляем небольшую задержку, чтобы не делать запрос на каждое нажатие клавиши
                searchTimeout = setTimeout(() => {
                    this.loadSupplierCatalog(term);
                }, 300);
            });
        }
    }



    setupImageEventListeners() {
        // Кнопка добавления изображения через файловый диалог
        const addImageBtn = document.getElementById('add-image-btn');
        if (addImageBtn) {
            addImageBtn.addEventListener('click', () => {
                // Создаем скрытый input для файлов
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/*';
                fileInput.multiple = true;
                fileInput.style.display = 'none';

                fileInput.addEventListener('change', (e) => {
                    this.handleFileSelect(e.target.files);
                });

                document.body.appendChild(fileInput);
                fileInput.click();
                document.body.removeChild(fileInput);
            });
        }

        // Настройка drag & drop
        const dropZone = document.getElementById('images-drop-zone');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                dropZone.classList.add('drag-over');
            });

            dropZone.addEventListener('dragleave', (e) => {
                // Проверяем, действительно ли курсор вышел за пределы drop zone
                if (!dropZone.contains(e.relatedTarget)) {
                    dropZone.classList.remove('drag-over');
                }
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');

                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleFileSelect(files);
                }
            });
        }
    }

    async loadSupplierCatalog(searchTerm = '') {
        const tab = document.getElementById('supplier-catalog-tab');
        if (!tab) return;

        const container = document.getElementById('supplier-catalog-grid');
        if (!container) return;

        try {
            // Показываем индикатор загрузки
            container.innerHTML = '<div class="empty">Загрузка товаров...</div>';

            // Загружаем все товары (включая недоступные, так как они тоже могут быть у поставщика)
            const response = await fetch('/api/products?admin=true');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const products = await response.json();

            // Фильтруем товары на стороне клиента
            let filteredProducts = products;
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                filteredProducts = products.filter(product =>
                    (product.title && product.title.toLowerCase().includes(term)) ||
                    (product.supplier_link && product.supplier_link.toLowerCase().includes(term))
                );
            }

            this.renderSupplierCatalog(filteredProducts);
        } catch (error) {
            console.error('Ошибка загрузки каталога для поставщика:', error);
            container.innerHTML = '<div class="empty">Ошибка загрузки товаров</div>';
        }
    }

    renderSupplierCatalog(products) {
        const container = document.getElementById('supplier-catalog-grid');
        if (!container) return;

        container.innerHTML = '';

        if (!products || products.length === 0) {
            container.innerHTML = '<div class="empty">Нет товаров для отображения</div>';
            return;
        }

        products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card'; // Используем существующий класс для сетки

            // Получаем изображение (первое из списка или заглушку)
            const imageUrl = product.images && product.images.length > 0 ?
                product.images[0].url : '/assets/placeholder.png';

            // Формируем содержимое ссылки/текста поставщика
            let supplierContent = 'Информация отсутствует';
            let displayLink = '';
            let isUrl = false;

            if (product.supplier_link) {
                // Проверяем, является ли supplier_link URL
                try {
                    new URL(product.supplier_link);
                    isUrl = true;
                    // Для отображения обрезаем длинные URL
                    displayLink = product.supplier_link.length > 50 ?
                        product.supplier_link.substring(0, 47) + '...' :
                        product.supplier_link;
                    supplierContent = `<a href="${product.supplier_link}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(displayLink)}</a>`;
                } catch (e) {
                    // Не URL, отображаем как текст
                    displayLink = product.supplier_link.length > 50 ?
                        product.supplier_link.substring(0, 47) + '...' :
                        product.supplier_link;
                    supplierContent = `<span class="supplier-truncated-text" title="${this.escapeHtml(product.supplier_link)}">${this.escapeHtml(displayLink)}</span>`;
                }
            }

            const copyText = product.supplier_link || '';

            card.innerHTML = `
            <div class="supplier-product-card">
                <img src="${imageUrl}" alt="${this.escapeHtml(product.title)}" 
                     class="supplier-product-image" 
                     onerror="this.src='/assets/placeholder.png'">
                <div class="supplier-product-info">
                    <h3 class="supplier-product-title">${this.escapeHtml(product.title)}</h3>
                    <div class="supplier-link-section">
                        <div class="supplier-link-label">Где купить:</div>
                        <div class="supplier-link-content">
                            ${supplierContent}
                            ${product.supplier_link ? `<button class="supplier-copy-btn" data-copy-text="${this.escapeHtml(copyText)}" title="Копировать информацию о поставщике">Копировать</button>` : ''}
                        </div>
                        ${product.supplier_notes ?
                    `<div class="supplier-notes">${this.escapeHtml(product.supplier_notes)}</div>` :
                    ''
                }
                    </div>
                </div>
            </div>
        `;
            container.appendChild(card);
        });

        // Добавляем обработчики событий для кнопок копирования
        container.querySelectorAll('.supplier-copy-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const textToCopy = button.getAttribute('data-copy-text');
                if (textToCopy) {
                    navigator.clipboard.writeText(textToCopy).then(() => {
                        // Визуальная обратная связь
                        const originalText = button.textContent;
                        button.textContent = 'Скопировано!';
                        button.classList.add('copied');
                        setTimeout(() => {
                            button.textContent = originalText;
                            button.classList.remove('copied');
                        }, 2000);
                    }).catch(err => {
                        console.error('Ошибка копирования текста: ', err);
                        this.showMessage('Не удалось скопировать текст', 'error');
                    });
                }
            });
        });
    }


    async loadAllProductsCache() {
        try {
            const response = await fetch('/api/products?admin=true'); // Загружаем все, включая недоступные
            if (!response.ok) {
                console.warn('Не удалось загрузить полный список товаров для поиска вариантов.');
                return [];
            }
            this.allProductsCache = await response.json();
            console.log('Кэш всех товаров загружен для поиска вариантов:', this.allProductsCache.length, 'товаров');
        } catch (error) {
            console.error('Ошибка при загрузке кэша товаров:', error);
            this.allProductsCache = [];
        }
    }

    setupVariantsFunctionality() {
        const searchInput = document.getElementById('variant-search');
        const searchResults = document.getElementById('variant-search-results');
        const selectedList = document.getElementById('selected-variants-list');
        const selectedIdsInput = document.getElementById('selected-variant-ids');

        if (!searchInput || !searchResults || !selectedList || !selectedIdsInput) {
            console.warn('Не найдены элементы для функционала вариантов в модальном окне.');
            return;
        }

        // Обработчик ввода в поле поиска
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const term = e.target.value.trim();

            if (term.length < 2) {
                searchResults.classList.add('hidden');
                return;
            }

            // Добавляем небольшую задержку, чтобы не делать запрос на каждое нажатие клавиши
            searchTimeout = setTimeout(() => {
                this.performVariantSearch(term, searchResults);
            }, 300);
        });

        // Закрытие результатов поиска при клике вне поля
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.classList.add('hidden');
            }
        });
    }

    async loadAttractions() {
        try {
            console.log('Загрузка аттракционов...');
            const response = await fetch('/api/attractions');
            console.log('Ответ от /api/attractions:', response.status);
            if (response.ok) {
                const attractions = await response.json();
                console.log('Аттракционы загружены:', attractions);
                this.renderAttractions(attractions);
            } else {
                console.error('Ошибка загрузки аттракционов:', response.status);
                this.renderAttractions([]);
            }
        } catch (error) {
            console.error('Ошибка загрузки аттракционов:', error);
            this.renderAttractions([]);
        }
    }

    renderAttractions(attractions) {
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
        console.log('Проверка структуры первого аттракциона:', attractions[0]);
        attractions.forEach(attraction => {
            const card = document.createElement('div');
            card.className = 'product-card'; // Используем тот же класс, что и для товаров

            // Предполагаем, что у аттракциона есть поле image
            const imageUrl = attraction.image || '/assets/placeholder.png';

            card.innerHTML = `
        <img src="${imageUrl}" alt="${attraction.title}" onerror="this.src='/assets/placeholder.png'">
        <h3>${this.escapeHtml(attraction.title)}</h3>
        <p>Цена: ${this.formatPrice(attraction.price)}</p>
        <p>Категория: ${this.escapeHtml(attraction.category || 'Не указана')}</p>
        <div class="product-actions">
            <button onclick="adminPanel.editAttraction(${attraction.id})" class="btn-primary">Редактировать</button>
            <button onclick="adminPanel.deleteAttraction(${attraction.id})" class="btn-danger">Удалить</button>
        </div>
      `;
            container.appendChild(card);
        });
    }

    openAttractionModal(attraction = null) {
        const modal = document.getElementById('attraction-modal');
        const title = document.getElementById('attraction-modal-title');
        const form = document.getElementById('attraction-form');
        const idInput = document.getElementById('attraction-id');

        if (attraction) {
            // Редактирование
            title.textContent = 'Редактировать аттракцион';
            idInput.value = attraction.id;
            document.getElementById('attraction-title').value = attraction.title || '';
            document.getElementById('attraction-description').value = attraction.description || '';
            document.getElementById('attraction-price').value = attraction.price || '';
            document.getElementById('attraction-category').value = attraction.category || '';
            

            // Заполняем спецификации
            const specs = attraction.specs || {};
            document.getElementById('attraction-specs-places').value = specs.places || '';
            document.getElementById('attraction-specs-power').value = specs.power || '';
            document.getElementById('attraction-specs-games').value = specs.games || '';
            document.getElementById('attraction-specs-area').value = specs.area || '';
            document.getElementById('attraction-specs-dimensions').value = specs.dimensions || '';

            // Загружаем изображение
            if (attraction.image) {
                this.loadAttractionImageToForm({ url: attraction.image, alt: attraction.title });
            } else {
                this.clearAttractionImageFields();
            }
        } else {
            // Добавление нового
            title.textContent = 'Добавить аттракцион';
            form.reset();
            idInput.value = '';
            this.clearAttractionImageFields();
        }

        // Загружаем категории в datalist
        this.loadAttractionCategoryOptions();

        modal.style.display = 'block';
        document.body.classList.add('modal-open');
    }

    closeAttractionModal() {
        const modal = document.getElementById('attraction-modal');
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
        // Очищаем поля формы и изображения
        document.getElementById('attraction-form').reset();
        this.clearAttractionImageFields();
        document.getElementById('attraction-id').value = '';
    }

    async saveAttraction() {
        const form = document.getElementById('attraction-form');
        const id = document.getElementById('attraction-id').value;
        const isEdit = !!id;

        const formData = new FormData(form);
        const attractionData = {
            title: formData.get('attraction-title'),
            description: formData.get('attraction-description'),
            price: parseFloat(formData.get('attraction-price')),
            category: formData.get('attraction-category'),
            
            specs: {
                places: formData.get('attraction-specs-places'),
                power: formData.get('attraction-specs-power'),
                games: formData.get('attraction-specs-games'),
                area: formData.get('attraction-specs-area'),
                dimensions: formData.get('attraction-specs-dimensions')
            }
        };

        // Получаем изображение
        if (this.attractionImages.length > 0) {
            // Если изображение было загружено, используем его URL
            // Если нет, оставляем старое значение (при редактировании) или null (при создании)
            if (this.attractionImages[0] && this.attractionImages[0].url) {
                attractionData.image = this.attractionImages[0].url;
            }
        }

        try {
            let response;
            if (isEdit) {
                // Редактирование
                response = await fetch(`/api/attractions/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(attractionData)
                });
            } else {
                // Создание нового
                response = await fetch('/api/attractions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(attractionData)
                });
            }

            if (response.ok) {
                const result = await response.json();
                console.log(`${isEdit ? 'Аттракцион обновлен' : 'Аттракцион создан'}:`, result);
                this.showMessage(`${isEdit ? 'Аттракцион обновлен' : 'Аттракцион создан'} успешно!`, 'success');
                this.closeAttractionModal();
                await this.loadAttractions(); // Перезагружаем список
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Ошибка ${isEdit ? 'обновления' : 'создания'}: ${response.status}`);
            }
        } catch (error) {
            console.error(`Ошибка ${isEdit ? 'обновления' : 'создания'} аттракциона:`, error);
            this.showMessage(`Ошибка: ${error.message}`, 'error');
        }
    }

    async editAttraction(id) {
        try {
            const response = await fetch(`/api/attractions/${id}`);
            if (response.ok) {
                const attraction = await response.json();
                this.openAttractionModal(attraction);
            } else {
                throw new Error(`Ошибка загрузки аттракциона: ${response.status}`);
            }
        } catch (error) {
            console.error('Ошибка загрузки аттракциона для редактирования:', error);
            this.showMessage(`Ошибка загрузки аттракциона: ${error.message}`, 'error');
        }
    }

    async deleteAttraction(id) {
        if (!confirm('Вы уверены, что хотите удалить этот аттракцион?')) {
            return;
        }

        try {
            const response = await fetch(`/api/attractions/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                console.log('Аттракцион удален');
                this.showMessage('Аттракцион удален успешно!', 'success');
                await this.loadAttractions(); // Перезагружаем список
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Ошибка удаления: ${response.status}`);
            }
        } catch (error) {
            console.error('Ошибка удаления аттракциона:', error);
            this.showMessage(`Ошибка удаления: ${error.message}`, 'error');
        }
    }

    // Методы для работы с изображениями аттракционов
    setupAttractionEventListeners() {
        // Кнопка добавления изображения через файловый диалог
        const addImageBtn = document.getElementById('add-attraction-image-btn');
        if (addImageBtn) {
            addImageBtn.addEventListener('click', () => {
                // Создаем скрытый input для файлов
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/*';
                fileInput.multiple = false; // Только одно изображение для аттракциона
                fileInput.style.display = 'none';

                fileInput.addEventListener('change', async (e) => {
                    const files = e.target.files;
                    if (files.length > 0) {
                        await this.handleAttractionImageUpload(files[0]);
                    }
                });

                document.body.appendChild(fileInput);
                fileInput.click();
                document.body.removeChild(fileInput);
            });
        }

        // Drag and Drop для изображения аттракциона
        const dropZone = document.getElementById('attraction-images-drop-zone');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('drag-over');
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('drag-over');
            });

            dropZone.addEventListener('drop', async (e) => { 
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                const files = e.dataTransfer.files;
                if (files.length > 0 && files[0].type.startsWith('image/')) {
                    await this.handleAttractionImageUpload(files[0]);
                } else {
                    this.showMessage('Пожалуйста, перетащите изображение', 'error');
                }
            });
        }
    }

    async handleAttractionImageUpload(file) {
        if (!file.type.startsWith('image/')) {
            this.showMessage('Пожалуйста, выберите файл изображения', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Ошибка загрузки: ${response.status}`);
            }

            const data = await response.json();
            // data.url - это путь к изображению на сервере, возвращаемый из /api/upload
            this.loadAttractionImageToForm({ url: data.url, alt: file.name });
        } catch (error) {
            console.error('Ошибка при загрузке файла:', error);
            this.showMessage(`Ошибка загрузки ${file.name}: ${error.message}`, 'error');
        }
    }

    loadAttractionImageToForm(imageData) {
        this.clearAttractionImageFields(); // Очищаем предыдущее изображение
        this.addAttractionImageField(imageData);
    }

    addAttractionImageField(imageData = null) {
        const container = document.getElementById('attraction-images-container');
        const dropHint = document.getElementById('attraction-drop-hint');
        if (!container) return;

        // Скрываем подсказку, если есть изображения
        if (dropHint) {
            dropHint.classList.remove('show');
        }

        const imageId = Date.now() + Math.floor(Math.random() * 10000); // Уникальный ID
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';
        imageItem.dataset.id = imageId;
        // Для аттракциона разрешаем перетаскивание, но в UI будет только одно изображение
        // imageItem.draggable = true;

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

        // Сохраняем информацию об изображении
        this.attractionImages.push({
            id: imageId,
            url: imageUrl,
            alt: imageAlt
        });

        // Показываем кнопку удаления при наведении
        imageItem.addEventListener('mouseenter', () => {
            const deleteBtn = imageItem.querySelector('.delete-image-btn');
            if (deleteBtn) {
                deleteBtn.style.opacity = '1';
            }
        });
        imageItem.addEventListener('mouseleave', () => {
            const deleteBtn = imageItem.querySelector('.delete-image-btn');
            if (deleteBtn) {
                deleteBtn.style.opacity = '0';
            }
        });

        // Обработчик удаления изображения
        const deleteBtn = imageItem.querySelector('.delete-image-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.removeAttractionImage(imageId);
            });
        }
    }

    removeAttractionImage(imageId) {
        // Удаляем из DOM
        const imageItem = document.querySelector(`.image-item[data-id="${imageId}"]`);
        if (imageItem) {
            imageItem.remove();
        }

        // Удаляем из массива attractionImages
        this.attractionImages = this.attractionImages.filter(img => img.id != imageId);

        // Показываем подсказку, если нет изображений
        if (this.attractionImages.length === 0) {
            const dropHint = document.getElementById('attraction-drop-hint');
            if (dropHint) {
                dropHint.classList.add('show');
            }
        }
    }

    clearAttractionImageFields() {
        const container = document.getElementById('attraction-images-container');
        const dropHint = document.getElementById('attraction-drop-hint');
        if (container) {
            container.innerHTML = '';
        }
        if (dropHint) {
            dropHint.classList.add('show');
        }
        this.attractionImages = [];
    }

    // Загрузка категорий в datalist для аттракционов
    async loadAttractionCategoryOptions() {
        try {
            const response = await fetch('/api/attractions/categories'); // Новый endpoint для получения уникальных категорий аттракционов
            if (response.ok) {
                const categories = await response.json();
                const datalist = document.getElementById('attraction-categories');
                if (datalist) {
                    datalist.innerHTML = ''; // Очищаем существующие опции
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

    // Обновленный метод switchTab для новой вкладки
    switchTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        this.currentTab = tabName;

        // Добавь перезагрузку каталога при переходе на вкладку
        if (tabName === 'supplier-catalog') {
            // Сбрасываем поиск при переходе на вкладку
            const searchInput = document.getElementById('supplier-catalog-search');
            if (searchInput) {
                searchInput.value = '';
            }
            this.loadSupplierCatalog(); // Перезагружаем каталог
        }
        // Добавляем перезагрузку аттракционов при переходе на вкладку
        if (tabName === 'attractions') {
            this.loadAttractions();
        }
    }
    /**
     * Выполняет поиск товаров для добавления в качестве вариантов.
     * @param {string} term - Поисковый запрос.
     * @param {HTMLElement} container - Контейнер для отображения результатов.
     */
    performVariantSearch(term, container) {
        const currentProductId = document.getElementById('product-id').value;
        const lowerTerm = term.toLowerCase();

        // Фильтруем товары из кэша
        const filteredProducts = this.allProductsCache.filter(p =>
            p.id != currentProductId && // Исключаем текущий товар
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

            // Получаем изображение
            const imageUrl = product.images && product.images.length > 0 ?
                product.images[0].url : '/assets/icons/placeholder1.webp';

            item.innerHTML = `
            <img src="${imageUrl}" alt="${this.escapeHtml(product.title)}" onerror="this.src='/assets/icons/placeholder1.webp">
            <span class="variant-title">${this.escapeHtml(product.title)}</span>
            <span class="variant-price">${this.formatPrice(product.price)}</span>
        `;

            item.addEventListener('click', () => {
                this.addVariantToSelection(product);
                document.getElementById('variant-search').value = ''; // Очищаем поле поиска
                container.classList.add('hidden'); // Скрываем результаты
            });

            container.appendChild(item);
        });

        container.classList.remove('hidden');
    }

    /**
     * Добавляет товар в список выбранных вариантов.
     * @param {Object} product - Объект товара.
     */
    addVariantToSelection(product) {
        // Проверяем, не добавлен ли уже
        if (this.selectedVariants.some(v => v.id === product.id)) {
            console.log('Товар уже выбран как вариант:', product.id);
            return;
        }

        this.selectedVariants.push(product);
        this.renderSelectedVariants();
        this.updateSelectedVariantsInput();
        console.log('Вариант добавлен:', product.id, this.selectedVariants);
    }

    /**
     * Удаляет товар из списка выбранных вариантов.
     * @param {number} productId - ID товара для удаления.
     */
    removeVariantFromSelection(productId) {
        this.selectedVariants = this.selectedVariants.filter(v => v.id !== productId);
        this.renderSelectedVariants();
        this.updateSelectedVariantsInput();
        console.log('Вариант удален:', productId, this.selectedVariants);
    }

    /**
     * Отображает список выбранных вариантов в модальном окне.
     */
    renderSelectedVariants() {
        const container = document.getElementById('selected-variants-list');
        if (!container) return;

        container.innerHTML = '';

        if (this.selectedVariants.length === 0) {
            // container.innerHTML = '<p class="hint">Нет выбранных вариантов.</p>';
            return; // Просто оставляем пустым
        }

        this.selectedVariants.forEach(variant => {
            const item = document.createElement('div');
            item.className = 'selected-variant-item';
            item.dataset.variantId = variant.id;

            item.innerHTML = `
            <span>${this.escapeHtml(variant.title)}</span>
            <button type="button" class="remove-variant-btn" data-id="${variant.id}" title="Удалить">&times;</button>
        `;

            const removeBtn = item.querySelector('.remove-variant-btn');
            removeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.removeVariantFromSelection(parseInt(e.target.dataset.id));
            });

            container.appendChild(item);
        });
    }

    /**
     * Обновляет скрытое поле ввода с ID выбранных вариантов.
     */
    updateSelectedVariantsInput() {
        const input = document.getElementById('selected-variant-ids');
        if (input) {
            input.value = JSON.stringify(this.selectedVariants.map(v => v.id));
        }
    }

    /**
     * Загружает и отображает уже привязанные варианты для редактируемого товара.
     * @param {number} productId - ID товара.
     */
    async loadLinkedVariants(productId) {
        try {
            // Сбрасываем список
            this.selectedVariants = [];

            // Получаем ID всех вариантов для этого товара из API
            // Поскольку API уже возвращает variants при запросе /api/products,
            // мы можем использовать это при загрузке списка товаров.
            // Но для конкретного товара по ID API пока не возвращает variants напрямую.
            // Поэтому делаем отдельный запрос к списку товаров и фильтруем.

            // Альтернатива: можно добавить эндпоинт /api/products/:id/variants
            // Пока используем кэш.

            // Найдем товар в кэше
            const productInCache = this.allProductsCache.find(p => p.id == productId);
            if (productInCache && productInCache.variants && productInCache.variants.length > 0) {
                // Загружаем полные объекты вариантов из кэша
                this.selectedVariants = productInCache.variants.map(variantIdOrObj => {
                    // API может возвращать как ID, так и полный объект. Уточняем.
                    // По коду из server.js, variants - это массив полных объектов.
                    if (typeof variantIdOrObj === 'object' && variantIdOrObj.id) {
                        return variantIdOrObj;
                    }
                    // Если по какой-то причине пришел ID, ищем в кэше
                    const id = typeof variantIdOrObj === 'object' ? variantIdOrObj.id : variantIdOrObj;
                    return this.allProductsCache.find(p => p.id == id);
                }).filter(v => v && v.id != productId); // Исключаем сам товар и null

                console.log('Загружены связанные варианты для товара', productId, ':', this.selectedVariants);
            } else {
                console.log('Для товара', productId, 'связанные варианты не найдены или отсутствуют.');
            }

            this.renderSelectedVariants();
            this.updateSelectedVariantsInput();

        } catch (error) {
            console.error('Ошибка при загрузке связанных вариантов:', error);
            this.selectedVariants = [];
            this.renderSelectedVariants();
            this.updateSelectedVariantsInput();
        }
    }

    // Обработка выбранных файлов (и через drag & drop, и через файловый диалог)

    async handleFileSelect(files) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith('image/')) {
                try {
                    // Создаем FormData для отправки файла
                    const formData = new FormData();
                    formData.append('image', file);

                    // Отправляем файл на сервер
                    const response = await fetch('/api/upload', {
                        method: 'POST',
                        body: formData
                        // НЕ устанавливаем Content-Type, браузер сделает это правильно с boundary
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error || `Ошибка загрузки: ${response.status}`);
                    }

                    const data = await response.json();
                    // data.url - это путь к изображению на сервере, возвращаемый из /api/upload
                    this.addImageField({ url: data.url, alt: file.name });

                } catch (error) {
                    console.error('Ошибка при загрузке файла:', error);
                    this.showMessage(`Ошибка загрузки ${file.name}: ${error.message}`, 'error');
                }
            } else {
                this.showMessage(`Файл ${file.name} не является изображением`, 'error');
            }
        }
    }
    // Добавить новое поле для изображения
    addImageField(imageData = null) {
        const container = document.getElementById('images-container');
        const dropHint = document.getElementById('drop-hint');

        if (!container) return;

        // Скрываем подсказку, если есть изображения
        if (dropHint) {
            dropHint.classList.remove('show');
        }

        const imageId = Date.now() + Math.floor(Math.random() * 10000); // Уникальный ID
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';
        imageItem.dataset.id = imageId;
        imageItem.draggable = true;

        const imageUrl = imageData?.url || '';
        const imageAlt = imageData?.alt || '';

        imageItem.innerHTML = `
            ${imageUrl ?
                `<img src="${imageUrl}" alt="${imageAlt}" class="image-preview" onerror="this.src='/assets/icons/placeholder1.webp'">` :
                `<div class="image-preview-placeholder">Нет изображения</div>`
            }
            <button type="button" class="delete-image-btn" onclick="adminPanel.deleteImage(${imageId})">×</button>
            <input type="hidden" class="image-input" value="${imageUrl}" data-id="${imageId}">
        `;

        container.appendChild(imageItem);

        // Добавляем drag & drop события
        this.setupDragEvents(imageItem);

        // Сохраняем изображение в массив
        this.images.push({
            id: imageId,
            url: imageUrl,
            alt: imageAlt
        });

        // Показываем кнопку удаления при наведении
        imageItem.addEventListener('mouseenter', () => {
            const deleteBtn = imageItem.querySelector('.delete-image-btn');
            if (deleteBtn) {
                deleteBtn.style.opacity = '1';
            }
        });

        imageItem.addEventListener('mouseleave', () => {
            const deleteBtn = imageItem.querySelector('.delete-image-btn');
            if (deleteBtn) {
                deleteBtn.style.opacity = '0';
            }
        });
    }

    // Настройка событий перетаскивания для изображения
    setupDragEvents(imageItem) {
        imageItem.addEventListener('dragstart', (e) => {
            this.draggedImage = imageItem;
            imageItem.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', imageItem.outerHTML);
        });

        imageItem.addEventListener('dragend', () => {
            imageItem.classList.remove('dragging');
            const container = document.getElementById('images-container');
            if (container) {
                const draggables = container.querySelectorAll('.image-item.drag-over');
                draggables.forEach(item => item.classList.remove('drag-over'));
            }
            this.draggedImage = null;
        });

        imageItem.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            if (this.draggedImage !== imageItem) {
                imageItem.classList.add('drag-over');
            }
        });

        imageItem.addEventListener('dragleave', () => {
            imageItem.classList.remove('drag-over');
        });

        imageItem.addEventListener('drop', (e) => {
            e.preventDefault();
            imageItem.classList.remove('drag-over');

            if (this.draggedImage && this.draggedImage !== imageItem) {
                const container = document.getElementById('images-container');
                if (container) {
                    // Определяем позицию для вставки
                    const rect = imageItem.getBoundingClientRect();
                    const nextSibling = e.clientX > rect.left + rect.width / 2 ?
                        imageItem.nextSibling : imageItem;

                    container.insertBefore(this.draggedImage, nextSibling);
                }
            }
        });
    }

    // Удалить изображение
    deleteImage(imageId) {
        const imageItem = document.querySelector(`.image-item[data-id="${imageId}"]`);
        if (imageItem) {
            imageItem.remove();
            // Удаляем из массива
            this.images = this.images.filter(img => img.id !== imageId);

            // Показываем подсказку, если нет изображений
            const container = document.getElementById('images-container');
            const dropHint = document.getElementById('drop-hint');
            if (container && dropHint && container.children.length === 0) {
                dropHint.classList.add('show');
            }
        }
    }

    // Очистить все поля изображений
    clearImageFields() {
        const container = document.getElementById('images-container');
        const dropHint = document.getElementById('drop-hint');

        if (container) {
            container.innerHTML = '';
        }

        if (dropHint) {
            dropHint.classList.add('show');
        }

        this.images = [];
    }

    // Загрузить изображения в форму
    loadImagesToForm(images) {
        this.clearImageFields();

        if (images && Array.isArray(images) && images.length > 0) {
            images.forEach(image => {
                this.addImageField(image);
            });

            // Скрываем подсказку, если есть изображения
            const dropHint = document.getElementById('drop-hint');
            if (dropHint) {
                dropHint.classList.remove('show');
            }
        } else {
            // Показываем подсказку для нового товара
            const dropHint = document.getElementById('drop-hint');
            if (dropHint) {
                dropHint.classList.add('show');
            }
        }
    }

    // Получить все изображения из формы
    getImagesFromForm() {
        const imageItems = document.querySelectorAll('.image-item');
        const images = [];

        imageItems.forEach((item, index) => {
            const input = item.querySelector('.image-input');
            const url = input ? input.value.trim() : '';
            if (url) {
                images.push({
                    url: url,
                    alt: `Изображение ${index + 1}`
                });
            }
        });

        return images;
    }

    async loadProducts() {
        try {
            console.log('Загрузка товаров...');
            const response = await fetch('/api/products?admin=true');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const products = await response.json();
            console.log('Все товары загружены (включая недоступные):', products);

            // Проверим, есть ли недоступные товары
            const unavailableProducts = products.filter(product => product.available === false);
            console.log('Недоступные товары найдены:', unavailableProducts);

            this.renderProducts(products);
        } catch (error) {
            console.error('Ошибка загрузки товаров:', error);
            this.showErrorMessage('Не удалось загрузить товары');
        }
    }

    renderProducts(products) {
        const container = document.getElementById('admin-products-grid');
        if (!container) {
            console.error('Контейнер для товаров не найден');
            return;
        }

        container.innerHTML = '';

        if (!products || products.length === 0) {
            container.innerHTML = '<div class="empty">Нет товаров для отображения</div>';
            return;
        }

        console.log('Проверка структуры первого товара:', products[0]);

        products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';

            // Предполагаем, что у товара есть поле images - массив объектов {url, alt}
            const imageUrl = product.images && product.images.length > 0 ? product.images[0].url : '/assets/icons/placeholder1.webp';

            // Временно показываем все поля товара для отладки
            card.innerHTML = `
            <img src="${imageUrl}" alt="${product.title}" onerror="this.src='/assets/icons/placeholder1.webp'">
            <h3>${this.escapeHtml(product.title)}</h3>
            <p>Цена: ${this.formatPrice(product.price)}</p>
            <p>Категория: ${this.escapeHtml(product.category || 'Не указана')}</p>
            <p>Доступность: ${product.available !== undefined ? (product.available ? 'Да' : 'Нет') : 'Не указано'}</p>
            <div class="product-actions">
                <button onclick="adminPanel.editProduct(${product.id})" class="btn-primary">Редактировать</button>
                <button onclick="adminPanel.deleteProduct(${product.id})" class="btn-danger">Удалить</button>
            </div>
        `;
            container.appendChild(card);
        });
    }

    async loadCategories() {
        try {
            console.log('Загрузка категорий...');
            const response = await fetch('/api/categories');
            console.log('Ответ от /api/categories:', response.status);

            if (response.ok) {
                const categories = await response.json();
                console.log('Категории загружены:', categories);
                this.renderCategories(categories);
                this.loadCategoryOptions(categories); // Загружаем опции для селекта
            } else {
                // Если сервер вернул ошибку (например, 404 или 500)
                console.warn(`API категорий вернул ошибку ${response.status}`);
                // Передаем пустой массив, чтобы показать "Нет категорий"
                this.renderCategories([]);
                this.loadCategoryOptions([]);
            }
        } catch (error) {
            // Если сетевая ошибка (например, нет соединения)
            console.error('Сетевая ошибка при загрузке категорий:', error);
            // Передаем пустой массив, чтобы показать "Нет категорий"
            this.renderCategories([]);
            this.loadCategoryOptions([]);
        }
    }

    renderCategories(categories) {
        const container = document.getElementById('categories-list');
        if (!container) {
            console.error('Контейнер #categories-list не найден в DOM');
            return;
        }

        container.innerHTML = '';

        if (!categories || !Array.isArray(categories) || categories.length === 0) {
            container.innerHTML = '<div class="empty">Нет категорий</div>';
            console.log('Нет категорий для отображения');
            return;
        }

        console.log('Отрисовка категорий:', categories);
        // Предполагаем, что categories - это массив объектов {id, name}
        categories.forEach(category => {
            // Проверка на существование обязательных полей
            if (category.hasOwnProperty('id') && category.hasOwnProperty('name')) {
                const item = document.createElement('div');
                item.className = 'category-item';
                item.innerHTML = `
                    <span>${this.escapeHtml(category.name)}</span>
                    <button onclick="adminPanel.deleteCategory(${category.id})" class="btn-danger">Удалить</button>
                `;
                container.appendChild(item);
            } else {
                console.warn('Некорректная структура категории:', category);
            }
        });
    }

    loadCategoryOptions(categories) {
        const categorySelect = document.getElementById('product-category');
        if (!categorySelect) {
            console.error('Элемент #product-category не найден в DOM');
            return;
        }

        categorySelect.innerHTML = '<option value="">Выберите категорию...</option>'; // Добавляем пустую опцию

        // Проверяем, что categories - это массив
        if (!categories || !Array.isArray(categories)) {
            console.warn('Категории не являются массивом:', categories);
            return;
        }

        console.log('Загрузка опций категорий в селект:', categories);
        // Предполагаем, что categories - это массив объектов {id, name}
        categories.forEach(category => {
            // Проверка на существование обязательных полей
            if (category.hasOwnProperty('id') && category.hasOwnProperty('name')) {
                const option = document.createElement('option');
                option.value = category.name; // Используем имя категории как value
                option.textContent = category.name;
                categorySelect.appendChild(option);
            } else {
                console.warn('Некорректная структура категории для селекта:', category);
            }
        });
    }

    async loadOrders() {
        try {
            const response = await fetch('/api/orders');
            if (response.ok) {
                const orders = await response.json();
                this.renderOrders(orders);
            } else {
                this.renderOrders([]);
            }
        } catch (error) {
            console.error('Ошибка загрузки заказов:', error);
            this.renderOrders([]);
        }
    }

    renderOrders(orders) {
        const container = document.getElementById('orders-list');
        if (!container) return;

        container.innerHTML = '';

        if (!orders || orders.length === 0) {
            container.innerHTML = '<div class="empty">Нет заказов</div>';
            return;
        }

        orders.forEach(order => {
            const card = document.createElement('div');
            card.className = 'order-card';

            // Форматируем дату
            const formatDate = (dateStr) => {
                if (!dateStr) return 'Не указана';
                const date = new Date(dateStr);
                return date.toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            };

            // Создаем таблицу товаров
            let itemsHTML = '';
            let orderTotal = parseFloat(order.total_amount) || 0;

            if (order.items && Array.isArray(order.items) && order.items.length > 0) {
                itemsHTML = `
    <table class="order-items-table">
        <thead>
            <tr>
                <th>Название</th>
                <th>Цена за ед.</th> <!-- Изменено название -->
                <th>Кол-во</th>
                <th>Сумма</th>
            </tr>
        </thead>
        <tbody>
            ${order.items.map(item => {
                    // Убедитесь, что используете price_per_unit из item
                    const pricePerUnit = parseFloat(item.price_per_unit) || 0;
                    const quantity = parseInt(item.quantity) || 0;
                    const itemTotal = pricePerUnit * quantity;
                    return `
                <tr>
                    <td>${this.escapeHtml(item.product_title || 'Неизвестный товар')}</td>
                    <td>${this.formatPrice(pricePerUnit)}</td> <!-- Показываем цену за единицу -->
                    <td>${quantity}</td>
                    <td>${this.formatPrice(itemTotal)}</td>
                </tr>
                `;
                }).join('')}
        </tbody>
    </table>
    `;
            } else {
                itemsHTML = '<p>Нет товаров</p>';
            }

            card.innerHTML = `
            <div class="order-header">
                <h4>Заказ #${order.id || 'Неизвестен'}</h4>
                <span class="order-status status-${(order.status || 'новый').replace(/\s+/g, '-').toLowerCase()}">
                    ${this.escapeHtml(order.status || 'Новый')}
                </span>
            </div>
            <div class="order-details">
                <p><strong>Телефон:</strong> ${this.escapeHtml(order.phone || 'Не указан')}</p>
                <p><strong>Комментарий:</strong> ${this.escapeHtml(order.comment || 'Нет')}</p>
                <p><strong>Дата:</strong> ${formatDate(order.created_at)}</p>
                <p><strong>Сумма заказа:</strong> ${this.formatPrice(orderTotal)}</p>
            </div>
            <div class="order-items">
                <h5>Товары:</h5>
                ${itemsHTML}
            </div>
            <div class="order-actions">
                <select class="status-select" data-order-id="${order.id}">
                    <option value="новый" ${order.status === 'новый' ? 'selected' : ''}>Новый</option>
                    <option value="в обработке" ${order.status === 'в обработке' ? 'selected' : ''}>В обработке</option>
                    <option value="отправлен" ${order.status === 'отправлен' ? 'selected' : ''}>Отправлен</option>
                    <option value="доставлен" ${order.status === 'доставлен' ? 'selected' : ''}>Доставлен</option>
                    <option value="отменен" ${order.status === 'отменен' ? 'selected' : ''}>Отменен</option>
                </select>
                <button class="btn-primary save-status-btn" data-order-id="${order.id}">Сохранить статус</button>
                <button class="btn-danger delete-order-btn" data-order-id="${order.id}">Удалить заказ</button>
            </div>
        `;
            container.appendChild(card);
        });

        // Добавляем обработчики для смены статуса
        document.querySelectorAll('.save-status-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const orderId = e.target.dataset.orderId;
                const select = document.querySelector(`.status-select[data-order-id="${orderId}"]`);
                const newStatus = select.value;

                if (!orderId) {
                    this.showMessage('Ошибка: не указан ID заказа', 'error');
                    return;
                }

                try {
                    const response = await fetch(`/api/orders/${orderId}/status`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ status: newStatus })
                    });

                    if (response.ok) {
                        this.showMessage('Статус заказа обновлен!', 'success');
                        await this.loadOrders(); // Перезагружаем список
                    } else {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error || 'Не удалось обновить статус');
                    }
                } catch (error) {
                    console.error('Ошибка обновления статуса:', error);
                    this.showMessage(`Ошибка обновления статуса: ${error.message}`, 'error');
                }
            });
        });

        // Добавляем обработчики для удаления заказов
        document.querySelectorAll('.delete-order-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const orderId = e.target.dataset.orderId;

                if (!orderId) {
                    this.showMessage('Ошибка: не указан ID заказа', 'error');
                    return;
                }

                if (!confirm(`Вы уверены, что хотите удалить заказ #${orderId}? Это действие нельзя отменить.`)) {
                    return;
                }

                try {
                    const response = await fetch(`/api/orders/${orderId}`, {
                        method: 'DELETE'
                    });

                    if (response.ok) {
                        this.showMessage('Заказ удален успешно!', 'success');
                        await this.loadOrders(); // Перезагружаем список
                    } else {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error || 'Не удалось удалить заказ');
                    }
                } catch (error) {
                    console.error('Ошибка удаления заказа:', error);
                    this.showMessage(`Ошибка удаления заказа: ${error.message}`, 'error');
                }
            });
        });
    }

    openProductModal(product = null) {
        const modal = document.getElementById('product-modal');
        const title = document.getElementById('modal-title');
        const form = document.getElementById('product-form');

        if (!modal || !title || !form) {
            console.error('Элементы модального окна товара не найдены');
            return;
        }

        if (product) {
            console.log('Редактируем товар:', product);
            title.textContent = 'Редактировать товар';
            document.getElementById('product-id').value = product.id || '';

            const titleValue = product.title || '';
            console.log('DEBUG openProductModal: Setting title to', `"${titleValue}"`);
            document.getElementById('product-title').value = titleValue;
            console.log('DEBUG openProductModal: Input value is now', `"${document.getElementById('product-title').value}"`);

            document.getElementById('product-description').value = product.description || '';
            document.getElementById('product-price').value = product.price || '';

            document.getElementById('product-supplier-link').value = product.supplier_link || '';
            document.getElementById('product-supplier-notes').value = product.supplier_notes || '';

            // Установка категории
            const categorySelect = document.getElementById('product-category');
            if (categorySelect) {
                console.log('Устанавливаем категорию в форму:', product.category);
                const optionToSelect = Array.from(categorySelect.options).find(option => option.value === product.category);
                if (optionToSelect) {
                    categorySelect.value = product.category;
                } else {
                    const newOption = new Option(product.category, product.category, true, true);
                    categorySelect.add(newOption);
                    categorySelect.value = product.category;
                }
            }

            document.getElementById('product-available').checked = product.available !== false;

            // Загрузка изображений
            this.loadImagesToForm(product.images || []);
            if (product.id) {
                this.loadLinkedVariants(product.id);
            }
        } else {
            title.textContent = 'Добавить товар';
            form.reset();
            document.getElementById('product-id').value = '';
            document.getElementById('product-available').checked = true;

            document.getElementById('product-supplier-link').value = '';
            document.getElementById('product-supplier-notes').value = '';

            // Очистка и показ подсказки для нового товара
            this.clearImageFields();
            this.selectedVariants = [];
            this.renderSelectedVariants();
            this.updateSelectedVariantsInput();
        }

        modal.style.display = 'block';
    }

    openCategoryModal() {
        const modal = document.getElementById('category-modal');
        const form = document.getElementById('category-form');

        if (!modal || !form) {
            console.error('Элементы модального окна категории не найдены');
            return;
        }

        form.reset();
        modal.style.display = 'block';
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // === ФУНКЦИЯ ИЗ admin.js (Pasted_Text_1758498726950.txt), ИСПРАВЛЕННАЯ ===
    async saveProduct() {
        try {
            console.log('Начало saveProduct');
            // 1. Получаем форму
            const form = document.getElementById('product-form');
            if (!form) {
                console.error('Форма product-form не найдена');
                this.showMessage('Ошибка: Форма товара не найдена', 'error');
                return;
            }
            // 2. Получаем данные из формы
            const formData = new FormData(form);
            console.log('Данные из формы (все):', Object.fromEntries(formData));
            // 3. Извлекаем и обрабатываем каждое поле
            // Название (title) - критически важное поле
            const rawTitle = formData.get('product-title');
            console.log('Полученное значение product-title (до обработки):', `"${rawTitle}"`, typeof rawTitle);
            // Обеспечиваем, что title будет непустой строкой
            let title = '';
            if (rawTitle !== null && rawTitle !== undefined) {
                title = String(rawTitle).trim();
            }
            console.log('Обработанный title:', `"${title}"`);
            // Остальные поля
            const description = (formData.get('product-description') || '').toString().trim();
            const rawPrice = formData.get('product-price');
            const price = rawPrice !== null && rawPrice !== '' ? parseFloat(rawPrice) : 0;
            const category = (formData.get('product-category') || '').toString().trim();
            const available = formData.get('product-available') === 'on';
            const supplier_link = (formData.get('product-supplier-link') || '').toString().trim();
            const supplier_notes = (formData.get('product-supplier-notes') || '').toString().trim();
            // 4. Получаем изображения из формы
            const images = this.getImagesFromForm();
            console.log('Полученные изображения:', images);

            // --- НОВОЕ: Получаем выбранные варианты ---
            let selectedVariantIds = [];
            try {
                const idsString = document.getElementById('selected-variant-ids')?.value;
                if (idsString) {
                    selectedVariantIds = JSON.parse(idsString);
                    console.log('Выбранные ID вариантов:', selectedVariantIds);
                }
            } catch (e) {
                console.error('Ошибка парсинга selected-variant-ids:', e);
                selectedVariantIds = [];
            }
            // --- КОНЕЦ НОВОГО ---

            // 5. Формируем объект productData
            const productData = {
                title: title,
                description: description,
                price: price,
                category: category,
                available: available,
                images: images,
                supplier_link: supplier_link,
                supplier_notes: supplier_notes
                // selectedVariantIds НЕ отправляем напрямую в основном запросе,
                // так как логика сохранения вариантов обрабатывается отдельно
            };

            console.log('Сформированный productData для отправки (без вариантов):', productData);

            // 6. ВАЛИДАЦИЯ
            if (!productData.title) {
                console.warn('Валидация не пройдена: productData.title пуст или состоит только из пробелов');
                this.showMessage('Пожалуйста, укажите название товара', 'error');
                return;
            }
            if (isNaN(productData.price) || productData.price <= 0) {
                this.showMessage('Пожалуйста, укажите корректную цену (больше 0)', 'error');
                return;
            }
            if (!productData.category) {
                this.showMessage('Пожалуйста, выберите категорию', 'error');
                return;
            }

            // 7. Определяем метод и URL для fetch (основной товар)
            const productId = formData.get('product-id'); // Скрытое поле с ID
            const isUpdate = productId && productId.trim() !== '';
            const method = isUpdate ? 'PUT' : 'POST';
            const url = isUpdate ? `/api/products/${productId.trim()}` : '/api/products';
            console.log(`Отправка данных товара: ${method} ${url}`, productData);

            // 8. Отправляем данные основного товара на сервер
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(productData)
            });
            console.log('Ответ от сервера (товар):', response.status, response.statusText);

            // 9. Обрабатываем ответ
            let savedProduct;
            if (response.ok) {
                // Успех при сохранении товара
                savedProduct = await response.json(); // Получаем сохраненный/обновленный товар с ID
                console.log('Товар сохранен:', savedProduct);
            } else {
                // Ошибка от сервера при сохранении товара
                let errorMessage = `Ошибка сохранения товара: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorData.error || errorMessage;
                } catch (e) {
                    // Если не удалось распарсить JSON, используем текст ответа
                    const errorText = await response.text().catch(() => '');
                    errorMessage = errorText || errorMessage;
                }
                throw new Error(errorMessage);
            }

            // --- НОВОЕ: Сохраняем связи с вариантами ---
            // После успешного сохранения/обновления товара, сохраняем его варианты
            // Предполагаем, что savedProduct.id содержит ID нового/обновленного товара
            if (savedProduct && savedProduct.id) {
                const variantLinkResponse = await fetch(`/api/products/${savedProduct.id}/variants`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ variantIds: selectedVariantIds })
                });
                if (!variantLinkResponse.ok) {
                    // Можно показать предупреждение, но не прерывать весь процесс
                    console.error('Ошибка при сохранении связей с вариантами:', variantLinkResponse.statusText);
                    this.showMessage('Товар сохранен, но возникла ошибка при сохранении вариантов. Проверьте связи.', 'warning');
                } else {
                    console.log('Связи с вариантами успешно сохранены.');
                }
            } else {
                console.error('Не удалось получить ID сохраненного товара для установки вариантов.');
                this.showMessage('Товар сохранен, но не удалось обновить связи с вариантами.', 'warning');
            }
            // --- КОНЕЦ НОВОГО ---

            // 10. Завершение
            this.closeModal('product-modal');
            await this.loadProducts(); // Перезагружаем список товаров
            // Также обновляем кэш, если это новый товар или изменились варианты
            await this.loadAllProductsCache(); // Убедитесь, что этот метод существует в вашем классе
            this.showMessage(
                isUpdate ? 'Товар и его варианты обновлены успешно!' : 'Товар и его варианты созданы успешно!',
                'success'
            );

        } catch (error) {
            // 11. Обрабатываем любые ошибки (сетевые, логические, от сервера)
            console.error('Ошибка в функции saveProduct:', error);
            this.showMessage(`Ошибка сохранения товара: ${error.message}`, 'error');
        }
    }
    // === КОНЕЦ ИСПРАВЛЕННОЙ ФУНКЦИИ ===

    async saveCategory() {
        try {
            const form = document.getElementById('category-form');
            if (!form) return;

            const categoryName = document.getElementById('category-name').value.trim();

            if (!categoryName) {
                alert('Пожалуйста, укажите название категории');
                return;
            }

            const response = await fetch('/api/categories', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: categoryName })
            });

            if (response.ok) {
                this.closeModal('category-modal');
                await this.loadCategories(); // Перезагружаем категории
                this.showMessage('Категория добавлена успешно!', 'success');
            } else {
                const errorText = await response.text();
                throw new Error(`Ошибка добавления категории: ${response.status} - ${errorText}`);
            }
        } catch (error) {
            console.error('Ошибка добавления категории:', error);
            this.showMessage(`Ошибка добавления категории: ${error.message}`, 'error');
        }
    }

    async editProduct(productId) {
        try {
            const response = await fetch(`/api/products/${productId}`);
            if (response.ok) {
                const product = await response.json();
                this.openProductModal(product);

            } else {
                throw new Error('Товар не найден');
            }
        } catch (error) {
            console.error('Ошибка загрузки товара для редактирования:', error);
            this.showMessage('Ошибка загрузки товара для редактирования', 'error');
        }
    }

    async deleteProduct(productId) {
        if (!confirm('Вы уверены, что хотите удалить этот товар?')) {
            return;
        }

        try {
            const response = await fetch(`/api/products/${productId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await this.loadProducts();
                this.showMessage('Товар удален успешно!', 'success');
            } else {
                const errorText = await response.text();
                throw new Error(`Ошибка удаления товара: ${response.status} - ${errorText}`);
            }
        } catch (error) {
            console.error('Ошибка удаления товара:', error);
            this.showMessage('Ошибка удаления товара: ' + error.message, 'error');
        }
    }

    async deleteCategory(categoryId) {
        if (!confirm('Вы уверены, что хотите удалить эту категорию? Все товары в этой категории останутся, но сама категория будет удалена.')) {
            return;
        }

        try {
            const response = await fetch(`/api/categories/${categoryId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await this.loadCategories();
                this.showMessage('Категория удалена успешно!', 'success');
            } else {
                const errorText = await response.text();
                throw new Error(`Ошибка удаления категории: ${response.status} - ${errorText}`);
            }
        } catch (error) {
            console.error('Ошибка удаления категории:', error);
            this.showMessage('Ошибка удаления категории: ' + error.message, 'error');
        }
    }

    logout() {
        localStorage.removeItem('isAdmin');
        window.location.href = '../login.html'; // Предполагаем, что login.html находится на уровень выше
    }

    formatPrice(price) {
        // Проверяем, является ли price null или undefined
        if (price === null || price === undefined) {
            return 'Цена не указана';
        }

        // Если price - строка, пытаемся преобразовать её в число
        let numericPrice;
        if (typeof price === 'string') {
            // Удаляем пробелы и заменяем запятую на точку (на случай, если формат другой)
            numericPrice = parseFloat(price.trim().replace(',', '.'));
        } else {
            numericPrice = price;
        }

        // Проверяем, является ли результат числом
        if (typeof numericPrice !== 'number' || isNaN(numericPrice)) {
            return 'Цена не указана';
        }

        // Форматируем число как валюту
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB'
        }).format(numericPrice);
    }

    escapeHtml(text) {
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

    showMessage(message, type = 'info') {
        // Создаем элемент для сообщения
        const messageEl = document.createElement('div');
        messageEl.className = `admin-message ${type}`;
        messageEl.textContent = message;

        document.body.appendChild(messageEl);

        // Удаляем сообщение через 3 секунды
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 3000);
    }

    showErrorMessage(message) {
        this.showMessage(message, 'error');
    }
}

// Инициализация админ-панели
let adminPanel;
document.addEventListener('DOMContentLoaded', () => {
    adminPanel = new AdminPanel();
    // Добавляем в глобальную область видимости для использования в onclick
    window.adminPanel = adminPanel;
});