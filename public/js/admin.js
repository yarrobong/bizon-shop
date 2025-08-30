// Проверка авторизации
if (localStorage.getItem('isAdmin') !== 'true') {
    window.location.href = 'login.html';
}

class AdminPanel {
    constructor() {
        this.currentTab = 'products';
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadProducts();
        await this.loadCategories();
        await this.loadOrders();
        this.loadCategoryOptions();
    }

    setupEventListeners() {
        // Навигация по вкладкам
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Кнопки действий
        document.getElementById('add-product-btn').addEventListener('click', () => {
            this.openProductModal();
        });

        document.getElementById('logout-btn').addEventListener('click', () => {
            this.logout();
        });

        // Модальное окно
        document.querySelector('.close').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('cancel-btn').addEventListener('click', () => {
            this.closeModal();
        });

        // Закрытие модального окна по клику вне его
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('product-modal');
            if (e.target === modal) {
                this.closeModal();
            }
        });

        // Форма товара
        document.getElementById('product-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProduct();
        });
    }

    switchTab(tabName) {
        // Скрыть все вкладки
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Убрать активный класс с кнопок
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Показать выбранную вкладку
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
            card.innerHTML = `
                <img src="${product.images && product.images[0] ? product.images[0].url : '/assets/placeholder.png'}" 
                     alt="${product.title}" 
                     onerror="this.src='/assets/placeholder.png'">
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
            } else {
                // Если API категорий недоступен, используем стандартные
                const defaultCategories = [
                    {id: 1, name: 'все'},
                    {id: 2, name: 'электроника'},
                    {id: 3, name: 'одежда'},
                    {id: 4, name: 'аксессуары'}
                ];
                this.renderCategories(defaultCategories);
            }
        } catch (error) {
            console.error('Ошибка загрузки категорий:', error);
            // Используем стандартные категории
            const defaultCategories = [
                {id: 1, name: 'все'},
                {id: 2, name: 'электроника'},
                {id: 3, name: 'одежда'},
                {id: 4, name: 'аксессуары'}
            ];
            this.renderCategories(defaultCategories);
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
            card.innerHTML = `
                <h4>Заказ #${order.id || 'Неизвестен'}</h4>
                <p>Телефон: ${this.escapeHtml(order.phone || 'Не указан')}</p>
                <p>Комментарий: ${this.escapeHtml(order.comment || 'Нет')}</p>
                <p>Дата: ${order.created_at ? new Date(order.created_at).toLocaleDateString('ru-RU') : 'Не указана'}</p>
                <p>Статус: ${this.escapeHtml(order.status || 'Новый')}</p>
            `;
            container.appendChild(card);
        });
    }

    loadCategoryOptions() {
        // Загружаем категории в селект формы
        const categorySelect = document.getElementById('product-category');
        if (!categorySelect) return;

        // Стандартные категории
        const categories = ['электроника', 'одежда', 'аксессуары', 'другое'];
        
        categorySelect.innerHTML = '';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categorySelect.appendChild(option);
        });
    }

    openProductModal(product = null) {
        const modal = document.getElementById('product-modal');
        const title = document.getElementById('modal-title');
        const form = document.getElementById('product-form');

        if (!modal || !title || !form) {
            console.error('Элементы модального окна не найдены');
            return;
        }

        if (product) {
            // Редактирование существующего товара
            title.textContent = 'Редактировать товар';
            document.getElementById('product-id').value = product.id || '';
            document.getElementById('product-title').value = product.title || '';
            document.getElementById('product-description').value = product.description || '';
            document.getElementById('product-price').value = product.price || '';
            document.getElementById('product-category').value = product.category || '';
            document.getElementById('product-available').checked = product.available !== false;
            document.getElementById('product-image').value = product.images && product.images[0] ? product.images[0].url : '';
        } else {
            // Создание нового товара
            title.textContent = 'Добавить товар';
            form.reset();
            document.getElementById('product-id').value = '';
            document.getElementById('product-available').checked = true;
        }

        modal.style.display = 'block';
    }

    closeModal() {
        const modal = document.getElementById('product-modal');
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

            // Добавляем изображение если указано
            const imageUrl = formData.get('product-image')?.trim();
            if (imageUrl) {
                productData.images = [{ url: imageUrl, alt: productData.title }];
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

            console.log('Отправка данных:', { method, url, productData });

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(productData)
            });

            if (response.ok) {
                this.closeModal();
                await this.loadProducts();
                this.showMessage('Товар сохранен успешно!', 'success');
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Ошибка сохранения товара: ${response.status}`);
            }
        } catch (error) {
            console.error('Ошибка сохранения товара:', error);
            this.showMessage(`Ошибка сохранения товара: ${error.message}`, 'error');
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
                throw new Error('Ошибка удаления товара');
            }
        } catch (error) {
            console.error('Ошибка удаления товара:', error);
            this.showMessage('Ошибка удаления товара', 'error');
        }
    }

    async deleteCategory(categoryId) {
        if (!confirm('Вы уверены, что хотите удалить эту категорию?')) {
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
                throw new Error('Ошибка удаления категории');
            }
        } catch (error) {
            console.error('Ошибка удаления категории:', error);
            this.showMessage('Ошибка удаления категории', 'error');
        }
    }

    logout() {
        // Удаляем информацию о входе
        localStorage.removeItem('isAdmin');
        // Перенаправляем на страницу входа
        window.location.href = 'login.html';
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
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            z-index: 10000;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;

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
});

// Добавляем в глобальную область видимости для использования в onclick
window.adminPanel = adminPanel;