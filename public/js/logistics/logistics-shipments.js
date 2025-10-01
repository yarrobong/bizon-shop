// logistics-shipments.js

async function loadShipmentsTab() {
    await loadShipments();
    await loadPurchaseOrdersForSelect('shipment-order'); // Загрузить заказы для формы
}

async function loadShipments() {
    try {
        const response = await logisticsPanel.apiRequest('/api/shipments');
        renderShipments(response);
    } catch (error) {
        console.error('Ошибка загрузки партий:', error);
        logisticsPanel.showMessage(`Ошибка загрузки партий: ${error.message}`, 'error');
        renderShipments([]);
    }
}

function renderShipments(shipments) {
    const container = document.getElementById('shipments-grid');
    if (!container) return;

    container.innerHTML = '';

    if (!shipments || shipments.length === 0) {
        container.innerHTML = '<div class="empty">Нет партий</div>';
        return;
    }

    shipments.forEach(shipment => {
        const card = document.createElement('div');
        card.className = 'logistics-card';

        // Определить классы статусов
        const statusClass = shipment.ShipmentStatus ? shipment.ShipmentStatus.replace(/\s+/g, '-').toLowerCase() : 'в-пути';
        const paymentStatusClass = shipment.PaymentStatus ? shipment.PaymentStatus.replace(/\s+/g, '-').toLowerCase() : 'не-оплачено';

        card.innerHTML = `
            <h3>Партия ${logisticsPanel.escapeHtml(shipment.ShipmentNumber || 'Не указана')}</h3>
            <p><strong>Заказ:</strong> ${logisticsPanel.escapeHtml(shipment.OrderNumber || 'Не указан')}</p>
            <p><strong>Трек-номер:</strong> ${logisticsPanel.escapeHtml(shipment.TrackingNumber || 'Не указан')}</p>
            <p><strong>Дата отправки:</strong> ${logisticsPanel.formatDate(shipment.DepartureDate)}</p>
            <p><strong>Дата прибытия:</strong> ${logisticsPanel.formatDate(shipment.ArrivalDate)}</p>
            <p><strong>Статус:</strong> <span class="status-badge status-${statusClass}">${logisticsPanel.escapeHtml(shipment.ShipmentStatus || 'в пути')}</span></p>
            <p><strong>Оплата:</strong> <span class="status-badge status-${paymentStatusClass}">${logisticsPanel.escapeHtml(shipment.PaymentStatus || 'не оплачено')}</span></p>
            <p><strong>Стоимость доставки:</strong> ${logisticsPanel.formatPrice(shipment.DeliveryCost)}</p>
            <div class="logistics-actions">
                <button class="btn-primary" onclick="editShipment(${shipment.ShipmentID})">Редактировать</button>
                <button class="btn-danger" onclick="deleteShipment(${shipment.ShipmentID})">Удалить</button>
            </div>
        `;

        container.appendChild(card);
    });
}

// Загрузка заказов для select
async function loadPurchaseOrdersForSelect(selectId) {
    try {
        const response = await logisticsPanel.apiRequest('/api/purchase-orders');
        const select = document.getElementById(selectId);
        if (!select) return;

        select.innerHTML = '<option value="">Выберите заказ</option>';
        response.forEach(order => {
            const option = document.createElement('option');
            option.value = order.OrderID;
            option.textContent = order.OurOrderNumber;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Ошибка загрузки заказов для select:', error);
        logisticsPanel.showMessage(`Ошибка загрузки заказов: ${error.message}`, 'error');
    }
}

// Обработчик формы партии
document.getElementById('shipment-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
        OrderID: parseInt(document.getElementById('shipment-order').value) || null,
        ShipmentNumber: document.getElementById('shipment-number').value,
        TrackingNumber: document.getElementById('tracking-number').value,
        DepartureDate: document.getElementById('departure-date').value,
        ArrivalDate: document.getElementById('arrival-date').value,
        ShipmentStatus: document.getElementById('shipment-status').value,
        DeliveryCost: parseFloat(document.getElementById('delivery-cost').value) || null,
        PaymentStatus: document.getElementById('payment-status').value,
        PaymentDate: document.getElementById('payment-date').value,
        Comments: document.getElementById('shipment-comments').value
    };

    const shipmentId = document.getElementById('shipment-id').value; // Проверяем ID

    try {
        let url, method;
        if (shipmentId) {
            url = `/api/shipments/${shipmentId}`;
            method = 'PUT';
        } else {
            url = '/api/shipments';
            method = 'POST';
        }

        const response = await logisticsPanel.apiRequest(url, {
            method: method,
            body: JSON.stringify(formData)
        });

        if (response.success) {
            const action = method === 'PUT' ? 'обновлена' : 'сохранена';
            logisticsPanel.showMessage(`Партия ${action} успешно!`, 'success');
            logisticsPanel.closeModal('shipment-modal');
            document.getElementById('shipment-form').reset();
            document.getElementById('shipment-id').value = ''; // Сбросить ID
            await loadShipments(); // Перезагрузить данные
            // Обновить select'ы в других формах, если они используются
            await loadPurchaseOrdersForSelect('shipment-order');
        } else {
            throw new Error(response.message || 'Неизвестная ошибка');
        }
    } catch (error) {
        console.error('Ошибка сохранения партии:', error);
        logisticsPanel.showMessage(`Ошибка сохранения партии: ${error.message}`, 'error');
    }
});

// Функция редактирования
async function editShipment(id) {
    try {
        const shipmentData = await logisticsPanel.apiRequest(`/api/shipments/${id}`);
        document.getElementById('shipment-id').value = shipmentData.ShipmentID;
        document.getElementById('shipment-order').value = shipmentData.OrderID || '';
        document.getElementById('shipment-number').value = shipmentData.ShipmentNumber || '';
        document.getElementById('tracking-number').value = shipmentData.TrackingNumber || '';
        document.getElementById('departure-date').value = shipmentData.DepartureDate || '';
        document.getElementById('arrival-date').value = shipmentData.ArrivalDate || '';
        document.getElementById('shipment-status').value = shipmentData.ShipmentStatus || 'в пути';
        document.getElementById('delivery-cost').value = shipmentData.DeliveryCost || '';
        document.getElementById('payment-status').value = shipmentData.PaymentStatus || 'не оплачено';
        document.getElementById('payment-date').value = shipmentData.PaymentDate || '';
        document.getElementById('shipment-comments').value = shipmentData.Comments || '';

        document.getElementById('shipment-modal-title').textContent = 'Редактировать партию';
        document.getElementById('shipment-modal').style.display = 'block';
    } catch (error) {
        console.error('Ошибка загрузки данных партии для редактирования:', error);
        logisticsPanel.showMessage(`Ошибка загрузки данных: ${error.message}`, 'error');
    }
}

// Функция удаления
async function deleteShipment(id) {
    if (!confirm(`Вы уверены, что хотите удалить партию #${id}?`)) return;

    try {
        const response = await logisticsPanel.apiRequest(`/api/shipments/${id}`, {
            method: 'DELETE'
        });

        if (response.success) {
            logisticsPanel.showMessage('Партия удалена успешно!', 'success');
            await loadShipments(); // Перезагрузить данные
            // Обновить select'ы в других формах, если они используются
            await loadPurchaseOrdersForSelect('shipment-order');
        } else {
            throw new Error(response.message || 'Неизвестная ошибка');
        }
    } catch (error) {
        console.error('Ошибка удаления партии:', error);
        logisticsPanel.showMessage(`Ошибка удаления партии: ${error.message}`, 'error');
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('shipments-tab')?.classList.contains('active')) {
        loadShipmentsTab();
    }
});