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
        this.draggedImage = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadProducts();
        await this.loadCategories(); // Загружаем категории для селекта
        await this.loadOrders();
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

        // Форма категории
        document.getElementById('category-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCategory();
        });

        // Настройка drag & drop для изображений
        this.setupImageEventListeners();
    }

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

    // Обработка выбранных файлов (и через drag & drop, и через файловый диалог)
    async handleFileSelect(files) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith('image/')) {
                try {
                    // Здесь должна быть логика загрузки файла на сервер
                    // Пока используем временный URL для предпросмотра
                    const imageUrl = URL.createObjectURL(file);
                    this.addImageField({ url: imageUrl, alt: file.name });
                } catch (error) {
                    console.error('Ошибка при обработке файла:', error);
                    this.showMessage('Ошибка при обработке изображения', 'error');
                }
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

        const imageId = Date.now() + Math.floor(Math.random() * 1000); // Уникальный ID
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';
        imageItem.dataset.id = imageId;
        imageItem.draggable = true;

        const imageUrl = imageData?.url || '';
        const imageAlt = imageData?.alt || '';

        imageItem.innerHTML = `
            ${imageUrl ? 
                `<img src="${imageUrl}" alt="${imageAlt}" class="image-preview" onerror="this.src='/assets/placeholder.png'">` :
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
            setTimeout(() => imageItem.classList.add('dragging'), 0);
        });

        imageItem.addEventListener('dragend', () => {
            imageItem.classList.remove('dragging');
            this.draggedImage = null;
        });

        const container = document.getElementById('images-container');
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = this.getDragAfterElement(container, e.clientX);
            const draggable = this.draggedImage;
            if (draggable && afterElement !== draggable && afterElement !== draggable.nextSibling) {
                if (afterElement == null) {
                    container.appendChild(draggable);
                } else {
                    container.insertBefore(draggable, afterElement);
                }
            }
        });
    }

    // Получение элемента после которого нужно вставить перетаскиваемый элемент (горизонтальная сортировка)
    getDragAfterElement(container, x) {
        const draggableElements = [...container.querySelectorAll('.image-item:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = x - box.left - box.width / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
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
            const response = await fetch('/api/products');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const products = await response.json();
            console.log('Товары загружены:', products);
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

        products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';
            // Предполагаем, что у товара есть поле images - массив объектов {url, alt}
            const imageUrl = product.images && product.images.length > 0 ? product.images[0].url : '/assets/placeholder.png';
            card.innerHTML = `
                <img src="${imageUrl}" alt="${product.title}" onerror="this.src='/assets/placeholder.png'">
                <h3>${this.escapeHtml(product.title)}</h3>
                <p>Цена: ${this.formatPrice(product.price)}</p>
                <p>Категория: ${this.escapeHtml(product.category || 'Не указана')}</p>
                <p>Доступен: ${product.available !== false ? 'Да' : 'Нет'}</p>
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
        } else {
            title.textContent = 'Добавить товар';
            form.reset();
            document.getElementById('product-id').value = '';
            document.getElementById('product-available').checked = true;
            
            // Очистка и показ подсказки для нового товара
            this.clearImageFields();
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

        // 4. Получаем изображения из формы
        const images = this.getImagesFromForm();
        console.log('Полученные изображения:', images);

        // 5. Формируем объект productData
        const productData = {
            title: title,
            description: description,
            price: price,
            category: category,
            available: available,
            images: images
        };

        console.log('Сформированный productData для отправки:', productData);

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

        // 7. Определяем метод и URL для fetch
        const productId = formData.get('product-id'); // Скрытое поле с ID
        const isUpdate = productId && productId.trim() !== '';
        
        const method = isUpdate ? 'PUT' : 'POST';
        const url = isUpdate ? `/api/products/${productId.trim()}` : '/api/products';

        console.log(`Отправка данных товара: ${method} ${url}`, productData);

        // 8. Отправляем данные на сервер
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(productData)
        });

        console.log('Ответ от сервера:', response.status, response.statusText);

        // 9. Обрабатываем ответ
        if (response.ok) {
            // Успех
            this.closeModal('product-modal');
            await this.loadProducts(); // Перезагружаем список товаров
            this.showMessage(
                isUpdate ? 'Товар обновлен успешно!' : 'Товар создан успешно!', 
                'success'
            );
        } else {
            // Ошибка от сервера
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
    } catch (error) {
        // 10. Обрабатываем любые ошибки (сетевые, логические, от сервера)
        console.error('Ошибка в функции saveProduct:', error);
        this.showMessage(`Ошибка сохранения товара: ${error.message}`, 'error');
    }
}

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
        if (typeof price !== 'number' || isNaN(price)) return 'Цена не указана';
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB'
        }).format(price);
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
        return text.toString().replace(/[&<>"']/g, function(m) { return map[m]; });
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