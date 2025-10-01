// logistics-core.js

// Проверка авторизации (предполагаем, что логистика требует отдельной аутентификации)
// if (localStorage.getItem('isLogisticsAdmin') !== 'true') {
//     if (!window.location.pathname.includes('logistics-login.html')) {
//         window.location.href = '/logistics-login.html';
//     }
// }

class LogisticsPanel {
    constructor() {
        this.currentTab = 'orders';
        this.currentModule = null; // Для вызова методов текущего модуля
        this.init();
    }

    async init() {
        this.setupEventListeners();
        // Инициализация основных компонентов будет вызываться отдельно
        // await this.loadPurchaseOrders(); // Вызывается из logistics-orders.js
        // await this.loadClients(); // Вызывается из logistics-clients.js
        // и т.д.
    }

    setupEventListeners() {
        // Навигация по вкладкам логистики
        document.querySelectorAll('.logistics-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchLogisticsTab(e.target.dataset.tab);
            });
        });

        // Кнопка выхода из логистики
        document.getElementById('logistics-logout-btn')?.addEventListener('click', () => {
            this.logout();
        });

        // Закрытие модальных окон по клику вне их
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
                // Сбросить ID в скрытом поле, чтобы отличать создание от редактирования
                const idInput = e.target.querySelector('input[name="id"], input[name="order-id"], input[name="client-id"], input[name="buyer-id"], input[name="shipment-id"], input[name="distribution-id"], input[name="payment-id"]');
                if (idInput) idInput.value = '';
            }
        });

        // Закрытие модальных окон по кнопке X
        document.querySelectorAll('.modal .close').forEach(closeBtn => {
            closeBtn.addEventListener('click', function() {
                const modal = this.closest('.modal');
                if (modal) {
                    modal.style.display = 'none';
                    // Сбросить ID в скрытом поле
                    const idInput = modal.querySelector('input[name="id"], input[name="order-id"], input[name="client-id"], input[name="buyer-id"], input[name="shipment-id"], input[name="distribution-id"], input[name="payment-id"]');
                    if (idInput) idInput.value = '';
                }
            });
        });
    }

    switchLogisticsTab(tabName) {
        document.querySelectorAll('.logistics-tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        document.querySelectorAll('.logistics-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        const targetTab = document.getElementById(`${tabName}-tab`);
        const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);

        if (targetTab) targetTab.classList.add('active');
        if (targetBtn) targetBtn.classList.add('active');

        this.currentTab = tabName;

        // Определить имя функции загрузки вкладки
        // Согласно вашим таблицам, заказы - это PurchaseOrders
        let functionName;
        if (tabName === 'orders') {
            functionName = 'loadPurchaseOrdersTab'; // Изменено имя
        } else {
            // Для остальных вкладок используем стандартное правило
            functionName = `load${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`;
        }

        // Проверить, существует ли функция в глобальной области видимости
        if (typeof window[functionName] === 'function') {
            // Вызвать функцию
            window[functionName]();
        } else {
            console.warn(`Функция ${functionName} не найдена`);
            // Можно добавить сообщение об ошибке в интерфейс
            this.showMessage(`Модуль для "${tabName}" не загружен.`, 'error');
        }
    }

    logout() {
        // localStorage.removeItem('isLogisticsAdmin');
        window.location.href = '/login.html'; // Предполагаем, что login.html находится в корне
    }

    // Общие вспомогательные функции

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
            // Сбросить ID в скрытом поле
            const idInput = modal.querySelector('input[name="id"], input[name="order-id"], input[name="client-id"], input[name="buyer-id"], input[name="shipment-id"], input[name="distribution-id"], input[name="payment-id"]');
            if (idInput) idInput.value = '';
        }
    }

    // Универсальная функция для выполнения запросов с проверкой статуса
    async apiRequest(url, options = {}) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers // Позволяет переопределить или добавить заголовки
                },
                ...options
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
            }

            // Проверяем, есть ли тело у ответа
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                // Если ответ не JSON (например, пустой), возвращаем пустой объект
                return {};
            }
        } catch (error) {
            console.error('API Error:', error);
            throw error; // Перебросить ошибку, чтобы вызывающий код мог обработать её
        }
    }

    // Форматирование даты
    formatDate(dateStr) {
        if (!dateStr) return 'Не указана';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Некорректная дата'; // Проверка на валидность даты
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    }

    // Форматирование цены/суммы
    formatPrice(price) {
        if (price === null || price === undefined) {
            return '0.00';
        }
        let numericPrice = typeof price === 'string' ? parseFloat(price.trim().replace(',', '.')) : price;
        if (typeof numericPrice !== 'number' || isNaN(numericPrice)) {
            return '0.00';
        }
        return numericPrice.toFixed(2);
    }
}

// Инициализация логистической панели
let logisticsPanel;
document.addEventListener('DOMContentLoaded', () => {
    logisticsPanel = new LogisticsPanel();
    // Добавляем в глобальную область видимости для использования в модулях
    window.logisticsPanel = logisticsPanel;
});