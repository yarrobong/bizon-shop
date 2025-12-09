// admin-core.js

// Проверка авторизации
if (localStorage.getItem('isAdmin') !== 'true') {
    // Проверяем, не находится ли пользователь уже на странице логина
    if (!window.location.pathname.includes('login.html')) {
        window.location.href = '../login.html'; // Убедитесь, что путь правильный
    }
}

// Проверка наличия sessionId при загрузке страницы
if (localStorage.getItem('isAdmin') === 'true' && !localStorage.getItem('sessionId')) {
    console.warn('⚠️ Пользователь помечен как админ, но sessionId отсутствует. Перенаправление на страницу входа.');
    localStorage.removeItem('isAdmin');
    if (!window.location.pathname.includes('login.html')) {
        window.location.href = '../login.html';
    }
}

// Функция для получения заголовков с аутентификацией
function getAuthHeaders() {
    const headers = {
        'Content-Type': 'application/json'
    };
    const sessionId = localStorage.getItem('sessionId');
    if (sessionId) {
        headers['x-session-id'] = sessionId;
    }
    return headers;
}

// Обертка для fetch с автоматическим добавлением заголовков аутентификации
async function fetchWithAuth(url, options = {}) {
    const sessionId = localStorage.getItem('sessionId');
    const headers = {};
    
    // Для FormData не устанавливаем Content-Type (браузер установит автоматически с boundary)
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    
    // Всегда добавляем заголовок аутентификации
    if (sessionId) {
        headers['x-session-id'] = sessionId;
    } else {
        console.warn('⚠️ sessionId не найден в localStorage для запроса:', url);
        // Если нет sessionId, но пользователь должен быть авторизован, перенаправляем на логин
        if (localStorage.getItem('isAdmin') === 'true') {
            console.error('❌ Пользователь помечен как админ, но sessionId отсутствует. Перенаправление на страницу входа.');
            localStorage.removeItem('isAdmin');
            window.location.href = '../login.html';
            return Promise.reject(new Error('Session expired'));
        }
    }
    
    // Объединяем пользовательские заголовки с заголовками аутентификации
    const mergedHeaders = {
        ...headers,
        ...(options.headers || {})
    };
    
    return fetch(url, {
        ...options,
        headers: mergedHeaders
    });
}

// Делаем функцию доступной глобально
window.fetchWithAuth = fetchWithAuth;

class AdminPanel {
    constructor() {
        this.currentTab = 'products';
        this.draggedImage = null; // Базовая поддержка для drag & drop
        this.init();
    }

    async init() {
        this.setupEventListeners();
        // Данные для активной вкладки загружаются через DOMContentLoaded в каждом модуле
        // и при переключении вкладок через switchTab
    }

    setupEventListeners() {
        // Навигация по вкладкам
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Кнопка выхода
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            this.logout();
        });

        // Закрытие модальных окон по клику вне их
        window.addEventListener('click', (e) => {
            // Общая логика закрытия модальных окон может быть здесь
            // Или в каждом модуле отдельно
        });
    }

    switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const targetTab = document.getElementById(`${tabName}-tab`);
    const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);

    if (targetTab) targetTab.classList.add('active');
    if (targetBtn) targetBtn.classList.add('active');

    this.currentTab = tabName;

    // Исправленная проверка имени функции
    let functionName;
    if (tabName === 'supplier-catalog') {
        functionName = 'loadSupplierCatalogTab';
    } else {
        functionName = `load${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`;
    }
    
    if (typeof window[functionName] === 'function') {
        
        window[functionName]();
    } else {
        console.warn(`Функция ${functionName} не найдена`);
    }
}

    logout() {
        localStorage.removeItem('isAdmin');
        localStorage.removeItem('sessionId');
        window.location.href = '../login.html'; // Предполагаем, что login.html находится на уровень выше
    }

    // Общие вспомогательные функции
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

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }
    }

    // Базовая функция для drag & drop (может быть расширена в модулях)
    setupDragEvents(imageItem) {
        // Базовая реализация или заглушка
        // Конкретная реализация будет в admin-products.js и admin-attractions.js
        console.warn('setupDragEvents not implemented in core. Use module-specific implementation.');
    }

    updateImagesOrder() {
        // Заглушка
        console.warn('updateImagesOrder not implemented in core. Use module-specific implementation.');
    }
}

// Инициализация админ-панели
let adminPanel;
document.addEventListener('DOMContentLoaded', () => {
    adminPanel = new AdminPanel();
    // Добавляем в глобальную область видимости для использования в onclick
    window.adminPanel = adminPanel;
});