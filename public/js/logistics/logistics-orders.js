// logistics-orders.js

async function loadPurchaseOrdersTab() {
    await loadPurchaseOrders();
    await loadClientsForSelect('client-select'); // Загрузить клиентов для формы
    await loadBuyersForSelect('buyer-select');   // Загрузить баеров для формы
}

async function loadPurchaseOrders() {
    try {
        const response = await logisticsPanel.apiRequest('/api/purchase-orders');
        renderPurchaseOrders(response);
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
        logisticsPanel.showMessage(`Ошибка загрузки заказов: ${error.message}`, 'error');
        renderPurchaseOrders([]);
    }
}

function renderPurchaseOrders(orders) {
    const container = document.getElementById('orders-grid');
    if (!container) return;

    container.innerHTML = '';

    if (!orders || orders.length === 0) {
        container.innerHTML = '<div class="empty">Нет заказов</div>';
        return;
    }

    orders.forEach(order => {
        const card = document.createElement('div');
        card.className = 'logistics-card';

        // Определить класс статуса
        const statusClass = order.Status ? order.Status.replace(/\s+/g, '-').toLowerCase() : 'оформлен';

        card.innerHTML = `
            <h3>Заказ #${logisticsPanel.escapeHtml(order.OurOrderNumber)}</h3>
            <p><strong>Клиент:</strong> ${logisticsPanel.escapeHtml(order.ClientName || 'Не указан')}</p>
            <p><strong>Баер:</strong> ${logisticsPanel.escapeHtml(order.BuyerName || 'Не указан')}</p>
            <p><strong>Дата:</strong> ${logisticsPanel.formatDate(order.OrderDate)}</p>
            <p><strong>Статус:</strong> <span class="status-badge status-${statusClass}">${logisticsPanel.escapeHtml(order.Status || 'оформлен')}</span></p>
            <div class="logistics-actions">
                <button class="btn-primary" onclick="editPurchaseOrder(${order.OrderID})">Редактировать</button>
                <button class="btn-danger" onclick="deletePurchaseOrder(${order.OrderID})">Удалить</button>
            </div>
        `;

        container.appendChild(card);
    });
}

// Загрузка клиентов для select
async function loadClientsForSelect(selectId) {
    try {
        const response = await logisticsPanel.apiRequest('/api/clients');
        const select = document.getElementById(selectId);
        if (!select) return;

        select.innerHTML = '<option value="">Выберите клиента</option>';
        response.forEach(client => {
            const option = document.createElement('option');
            option.value = client.ClientID;
            option.textContent = client.Name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Ошибка загрузки клиентов для select:', error);
        logisticsPanel.showMessage(`Ошибка загрузки клиентов: ${error.message}`, 'error');
    }
}

// Загрузка баеров для select
async function loadBuyersForSelect(selectId) {
    try {
        const response = await logisticsPanel.apiRequest('/api/buyers');
        const select = document.getElementById(selectId);
        if (!select) return;

        select.innerHTML = '<option value="">Выберите баера</option>';
        response.forEach(buyer => {
            const option = document.createElement('option');
            option.value = buyer.BuyerID;
            option.textContent = buyer.Name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Ошибка загрузки баеров для select:', error);
        logisticsPanel.showMessage(`Ошибка загрузки баеров: ${error.message}`, 'error');
    }
}

// Обработчик формы заказа
document.getElementById('order-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
        OurOrderNumber: document.getElementById('order-number').value,
        BuyerOrderNumber: document.getElementById('buyer-order-number').value,
        ClientID: parseInt(document.getElementById('client-select').value) || null,
        BuyerID: parseInt(document.getElementById('buyer-select').value) || null,
        OrderDate: document.getElementById('order-date').value,
        Description: document.getElementById('order-description').value,
        Status: document.getElementById('order-status').value,
        Comments: document.getElementById('order-comments').value
    };

    const orderId = document.getElementById('order-id').value; // Проверяем ID

    try {
        let url, method;
        if (orderId) {
            url = `/api/purchase-orders/${orderId}`;
            method = 'PUT';
        } else {
            url = '/api/purchase-orders';
            method = 'POST';
        }

        const response = await logisticsPanel.apiRequest(url, {
            method: method,
            body: JSON.stringify(formData)
        });

        if (response.success) {
            const action = method === 'PUT' ? 'обновлен' : 'сохранен';
            logisticsPanel.showMessage(`Заказ ${action} успешно!`, 'success');
            logisticsPanel.closeModal('order-modal');
            document.getElementById('order-form').reset();
            document.getElementById('order-id').value = ''; // Сбросить ID
            await loadPurchaseOrders(); // Перезагрузить данные
        } else {
            throw new Error(response.message || 'Неизвестная ошибка');
        }
    } catch (error) {
        console.error('Ошибка сохранения заказа:', error);
        logisticsPanel.showMessage(`Ошибка сохранения заказа: ${error.message}`, 'error');
    }
});

// Функция редактирования
async function editPurchaseOrder(id) {
    try {
        const orderData = await logisticsPanel.apiRequest(`/api/purchase-orders/${id}`);
        document.getElementById('order-id').value = orderData.OrderID;
        document.getElementById('order-number').value = orderData.OurOrderNumber;
        document.getElementById('buyer-order-number').value = orderData.BuyerOrderNumber;
        document.getElementById('client-select').value = orderData.ClientID || '';
        document.getElementById('buyer-select').value = orderData.BuyerID || '';
        document.getElementById('order-date').value = orderData.OrderDate || '';
        document.getElementById('order-status').value = orderData.Status || 'оформлен';
        document.getElementById('order-description').value = orderData.Description || '';
        document.getElementById('order-comments').value = orderData.Comments || '';

        document.getElementById('order-modal-title').textContent = 'Редактировать заказ';
        document.getElementById('order-modal').style.display = 'block';
    } catch (error) {
        console.error('Ошибка загрузки данных заказа для редактирования:', error);
        logisticsPanel.showMessage(`Ошибка загрузки данных: ${error.message}`, 'error');
    }
}

// Функция удаления
async function deletePurchaseOrder(id) {
    if (!confirm(`Вы уверены, что хотите удалить заказ #${id}?`)) return;

    try {
        const response = await logisticsPanel.apiRequest(`/api/purchase-orders/${id}`, {
            method: 'DELETE'
        });

        if (response.success) {
            logisticsPanel.showMessage('Заказ удален успешно!', 'success');
            await loadPurchaseOrders(); // Перезагрузить данные
        } else {
            throw new Error(response.message || 'Неизвестная ошибка');
        }
    } catch (error) {
        console.error('Ошибка удаления заказа:', error);
        logisticsPanel.showMessage(`Ошибка удаления заказа: ${error.message}`, 'error');
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('orders-tab')?.classList.contains('active')) {
        loadPurchaseOrdersTab();
    }
});