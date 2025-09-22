// admin-orders.js

async function loadOrdersTab() {
    await loadOrders();
}

async function loadOrders() {
    try {
        const response = await fetch('/api/orders');
        if (response.ok) {
            const orders = await response.json();
            renderOrders(orders);
        } else {
            renderOrders([]);
        }
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
        renderOrders([]);
    }
}

function renderOrders(orders) {
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

        const formatDate = (dateStr) => {
            if (!dateStr) return 'Не указана';
            const date = new Date(dateStr);
            return date.toLocaleString('ru-RU', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        };

        let itemsHTML = '';
        let orderTotal = parseFloat(order.total_amount) || 0;

        if (order.items && Array.isArray(order.items) && order.items.length > 0) {
            itemsHTML = `
                <table class="order-items-table">
                    <thead><tr><th>Название</th><th>Цена за ед.</th><th>Кол-во</th><th>Сумма</th></tr></thead>
                    <tbody>
                        ${order.items.map(item => {
                            const pricePerUnit = parseFloat(item.price_per_unit) || 0;
                            const quantity = parseInt(item.quantity) || 0;
                            const itemTotal = pricePerUnit * quantity;
                            return `
                                <tr>
                                    <td>${adminPanel.escapeHtml(item.product_title || 'Неизвестный товар')}</td>
                                    <td>${adminPanel.formatPrice(pricePerUnit)}</td>
                                    <td>${quantity}</td>
                                    <td>${adminPanel.formatPrice(itemTotal)}</td>
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
                    ${adminPanel.escapeHtml(order.status || 'Новый')}
                </span>
            </div>
            <div class="order-details">
                <p><strong>Телефон:</strong> ${adminPanel.escapeHtml(order.phone || 'Не указан')}</p>
                <p><strong>Комментарий:</strong> ${adminPanel.escapeHtml(order.comment || 'Нет')}</p>
                <p><strong>Дата:</strong> ${formatDate(order.created_at)}</p>
                <p><strong>Сумма заказа:</strong> ${adminPanel.formatPrice(orderTotal)}</p>
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
                adminPanel.showMessage('Ошибка: не указан ID заказа', 'error');
                return;
            }

            try {
                const response = await fetch(`/api/orders/${orderId}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus })
                });

                if (response.ok) {
                    adminPanel.showMessage('Статус заказа обновлен!', 'success');
                    await loadOrders(); // Перезагружаем список
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || 'Не удалось обновить статус');
                }
            } catch (error) {
                console.error('Ошибка обновления статуса:', error);
                adminPanel.showMessage(`Ошибка обновления статуса: ${error.message}`, 'error');
            }
        });
    });

    // Добавляем обработчики для удаления заказов
    document.querySelectorAll('.delete-order-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const orderId = e.target.dataset.orderId;

            if (!orderId) {
                adminPanel.showMessage('Ошибка: не указан ID заказа', 'error');
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
                    adminPanel.showMessage('Заказ удален успешно!', 'success');
                    await loadOrders(); // Перезагружаем список
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || 'Не удалось удалить заказ');
                }
            } catch (error) {
                console.error('Ошибка удаления заказа:', error);
                adminPanel.showMessage(`Ошибка удаления заказа: ${error.message}`, 'error');
            }
        });
    });
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('orders-tab')?.classList.contains('active')) {
        loadOrdersTab();
    }
});