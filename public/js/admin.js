// admin.js

// Проверка авторизации
if (localStorage.getItem('isAdmin') !== 'true') {
    window.location.href = '../login.html'; // Предполагаем, что login.html находится на уровень выше
}

class AdminPanel {
    constructor() {
        this.currentTab = 'products';
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
            const response = await fetch('/api/categories');
            if (response.ok) {
                const categories = await response.json();
                this.renderCategories(categories);
                this.loadCategoryOptions(categories); // Загружаем опции для селекта
            } else {
                console.warn('API категорий недоступен, используем стандартные');
                const defaultCategories = ['электроника', 'одежда', 'аксессуары', 'другое'];
                this.renderCategories(defaultCategories.map((name, id) => ({id, name})));
                this.loadCategoryOptions(defaultCategories.map((name, id) => ({id, name})));
            }
        } catch (error) {
            console.error('Ошибка загрузки категорий:', error);
            const defaultCategories = ['электроника', 'одежда', 'аксессуары', 'другое'];
            this.renderCategories(defaultCategories.map((name, id) => ({id, name})));
            this.loadCategoryOptions(defaultCategories.map((name, id) => ({id, name})));
        }
    }

    renderCategories(categories) {
        const container = document.getElementById('categories-list');
        if (!container) return;

        container.innerHTML = '';

        if (!categories || categories.length === 0) {
            container.innerHTML = '<div class="empty">Нет категорий</div>';
            return;
        }

        // Предполагаем, что categories - это массив объектов {id, name}
        categories.forEach(category => {
            const item = document.createElement('div');
            item.className = 'category-item';
            item.innerHTML = `
                <span>${this.escapeHtml(category.name)}</span>
                <button onclick="adminPanel.deleteCategory(${category.id})" class="btn-danger">Удалить</button>
            `;
            container.appendChild(item);
        });
    }

     loadCategoryOptions(categories) {
        const categorySelect = document.getElementById('product-category');
        if (!categorySelect) return;

        categorySelect.innerHTML = '';
        // Предполагаем, что categories - это массив объектов {id, name}
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.name; // Используем имя категории как value
            option.textContent = category.name;
            categorySelect.appendChild(option);
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
            // Предполагаем, что заказ имеет поля: id, phone, comment, created_at, status, cart
            const itemsList = order.cart && Array.isArray(order.cart) ? 
                order.cart.map(item => `${item.product.title} (x${item.qty})`).join(', ') : 'Нет данных';

            card.innerHTML = `
                <h4>Заказ #${order.id || 'Неизвестен'}</h4>
                <p><strong>Телефон:</strong> ${this.escapeHtml(order.phone || 'Не указан')}</p>
                <p><strong>Комментарий:</strong> ${this.escapeHtml(order.comment || 'Нет')}</p>
                <p><strong>Дата:</strong> ${order.created_at ? new Date(order.created_at).toLocaleString('ru-RU') : 'Не указана'}</p>
                <p><strong>Статус:</strong> ${this.escapeHtml(order.status || 'Новый')}</p>
                <p><strong>Товары:</strong> ${itemsList}</p>
            `;
            container.appendChild(card);
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
            title.textContent = 'Редактировать товар';
            document.getElementById('product-id').value = product.id || '';
            document.getElementById('product-title').value = product.title || '';
            document.getElementById('product-description').value = product.description || '';
            document.getElementById('product-price').value = product.price || '';
            
            // Установка категории
            const categorySelect = document.getElementById('product-category');
            if (categorySelect) {
                // Ищем опцию с нужным значением
                const optionToSelect = Array.from(categorySelect.options).find(option => option.value === product.category);
                if (optionToSelect) {
                    categorySelect.value = product.category;
                } else {
                    // Если категория не найдена в списке, добавим её временно
                    const newOption = new Option(product.category, product.category, true, true);
                    categorySelect.add(newOption);
                    categorySelect.value = product.category;
                }
            }
            
            document.getElementById('product-available').checked = product.available !== false;
            // Предполагаем, что images - массив
            const imageUrl = product.images && product.images.length > 0 ? product.images[0].url : '';
            document.getElementById('product-image').value = imageUrl || '';
        } else {
            title.textContent = 'Добавить товар';
            form.reset();
            document.getElementById('product-id').value = '';
            document.getElementById('product-available').checked = true;
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
            const form = document.getElementById('product-form');
            if (!form) return;

            const formData = new FormData(form);
            
            const productData = {
                title: formData.get('product-title')?.trim(),
                description: formData.get('product-description')?.trim(),
                price: parseFloat(formData.get('product-price')) || 0,
                category: formData.get('product-category')?.trim(),
                available: formData.get('product-available') === 'on',
                images: []
            };

            const imageUrl = formData.get('product-image')?.trim();
            if (imageUrl) {
                productData.images = [{ url: imageUrl, alt: productData.title || 'Изображение товара' }];
            }

            // Валидация
            if (!productData.title) {
                alert('Пожалуйста, укажите название товара');
                return;
            }

            if (productData.price <= 0) {
                alert('Пожалуйста, укажите корректную цену');
                return;
            }

            if (!productData.category) {
                alert('Пожалуйста, выберите категорию');
                return;
            }

            const productId = formData.get('product-id');
            const method = productId ? 'PUT' : 'POST';
            const url = productId ? `/api/products/${productId}` : '/api/products';

            console.log('Отправка данных товара:', { method, url, productData });

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(productData)
            });

            if (response.ok) {
                this.closeModal('product-modal');
                await this.loadProducts();
                this.showMessage('Товар сохранен успешно!', 'success');
            } else {
                const errorText = await response.text();
                throw new Error(`Ошибка сохранения товара: ${response.status} - ${errorText}`);
            }
        } catch (error) {
            console.error('Ошибка сохранения товара:', error);
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