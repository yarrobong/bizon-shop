// logistics-distribution.js

async function loadDistributionTab() {
    await loadDistribution();
    await loadShipmentsForSelect('distribution-shipment'); // Загрузить партии для формы
    await loadClientsForSelect('distribution-client'); // Используем общую функцию из clients.js
}

async function loadDistribution() {
    try {
        const response = await logisticsPanel.apiRequest('/api/distribution');
        renderDistribution(response);
    } catch (error) {
        console.error('Ошибка загрузки распределения:', error);
        logisticsPanel.showMessage(`Ошибка загрузки распределения: ${error.message}`, 'error');
        renderDistribution([]);
    }
}

function renderDistribution(distributions) {
    const container = document.getElementById('distribution-grid');
    if (!container) return;

    container.innerHTML = '';

    if (!distributions || distributions.length === 0) {
        container.innerHTML = '<div class="empty">Нет распределения</div>';
        return;
    }

    distributions.forEach(distribution => {
        const card = document.createElement('div');
        card.className = 'logistics-card';

        // Определить класс статуса
        const statusClass = distribution.Status ? distribution.Status.replace(/\s+/g, '-').toLowerCase() : 'отправлено';

        card.innerHTML = `
            <h3>Распределение #${distribution.DistributionID}</h3>
            <p><strong>Партия:</strong> ${logisticsPanel.escapeHtml(distribution.ShipmentNumber || 'Не указана')}</p>
            <p><strong>Клиент:</strong> ${logisticsPanel.escapeHtml(distribution.ClientName || 'Не указан')}</p>
            <p><strong>Адрес:</strong> ${logisticsPanel.escapeHtml(distribution.Address || 'Не указан')}</p>
            <p><strong>Описание:</strong> ${logisticsPanel.escapeHtml(distribution.ItemDescription || 'Не указано')}</p>
            <p><strong>Количество:</strong> ${distribution.Quantity || 0}</p>
            <p><strong>Стоимость доставки РФ:</strong> ${logisticsPanel.formatPrice(distribution.DeliveryCost)}</p>
            <p><strong>Статус:</strong> <span class="status-badge status-${statusClass}">${logisticsPanel.escapeHtml(distribution.Status || 'отправлено')}</span></p>
            <div class="logistics-actions">
                <button class="btn-primary" onclick="editDistribution(${distribution.DistributionID})">Редактировать</button>
                <button class="btn-danger" onclick="deleteDistribution(${distribution.DistributionID})">Удалить</button>
            </div>
        `;

        container.appendChild(card);
    });
}

// Загрузка партий для select
async function loadShipmentsForSelect(selectId) {
    try {
        const response = await logisticsPanel.apiRequest('/api/shipments');
        const select = document.getElementById(selectId);
        if (!select) return;

        select.innerHTML = '<option value="">Выберите партию</option>';
        response.forEach(shipment => {
            const option = document.createElement('option');
            option.value = shipment.ShipmentID;
            option.textContent = shipment.ShipmentNumber || `Партия #${shipment.ShipmentID}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Ошибка загрузки партий для select:', error);
        logisticsPanel.showMessage(`Ошибка загрузки партий: ${error.message}`, 'error');
    }
}

// Обработчик формы распределения
document.getElementById('distribution-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
        ShipmentID: parseInt(document.getElementById('distribution-shipment').value) || null,
        ClientID: parseInt(document.getElementById('distribution-client').value) || null,
        Address: document.getElementById('distribution-address').value,
        ItemDescription: document.getElementById('item-description').value,
        Quantity: parseInt(document.getElementById('quantity').value) || null,
        DeliveryCost: parseFloat(document.getElementById('delivery-cost-rf').value) || null,
        PaymentStatus: document.getElementById('payment-status-rf').value,
        Status: document.getElementById('distribution-status').value
    };

    const distributionId = document.getElementById('distribution-id').value; // Проверяем ID

    try {
        let url, method;
        if (distributionId) {
            url = `/api/distribution/${distributionId}`;
            method = 'PUT';
        } else {
            url = '/api/distribution';
            method = 'POST';
        }

        const response = await logisticsPanel.apiRequest(url, {
            method: method,
            body: JSON.stringify(formData)
        });

        if (response.success) {
            const action = method === 'PUT' ? 'обновлено' : 'сохранено';
            logisticsPanel.showMessage(`Распределение ${action} успешно!`, 'success');
            logisticsPanel.closeModal('distribution-modal');
            document.getElementById('distribution-form').reset();
            document.getElementById('distribution-id').value = ''; // Сбросить ID
            await loadDistribution(); // Перезагрузить данные
            // Обновить select'ы в других формах, если они используются
            await loadShipmentsForSelect('distribution-shipment');
            await loadClientsForSelect('distribution-client');
        } else {
            throw new Error(response.message || 'Неизвестная ошибка');
        }
    } catch (error) {
        console.error('Ошибка сохранения распределения:', error);
        logisticsPanel.showMessage(`Ошибка сохранения распределения: ${error.message}`, 'error');
    }
});

// Функция редактирования
async function editDistribution(id) {
    try {
        const distributionData = await logisticsPanel.apiRequest(`/api/distribution/${id}`);
        document.getElementById('distribution-id').value = distributionData.DistributionID;
        document.getElementById('distribution-shipment').value = distributionData.ShipmentID || '';
        document.getElementById('distribution-client').value = distributionData.ClientID || '';
        document.getElementById('distribution-address').value = distributionData.Address || '';
        document.getElementById('item-description').value = distributionData.ItemDescription || '';
        document.getElementById('quantity').value = distributionData.Quantity || '';
        document.getElementById('delivery-cost-rf').value = distributionData.DeliveryCost || '';
        document.getElementById('payment-status-rf').value = distributionData.PaymentStatus || 'не оплачено';
        document.getElementById('distribution-status').value = distributionData.Status || 'отправлено';

        document.getElementById('distribution-modal-title').textContent = 'Редактировать распределение';
        document.getElementById('distribution-modal').style.display = 'block';
    } catch (error) {
        console.error('Ошибка загрузки данных распределения для редактирования:', error);
        logisticsPanel.showMessage(`Ошибка загрузки данных: ${error.message}`, 'error');
    }
}

// Функция удаления
async function deleteDistribution(id) {
    if (!confirm(`Вы уверены, что хотите удалить распределение #${id}?`)) return;

    try {
        const response = await logisticsPanel.apiRequest(`/api/distribution/${id}`, {
            method: 'DELETE'
        });

        if (response.success) {
            logisticsPanel.showMessage('Распределение удалено успешно!', 'success');
            await loadDistribution(); // Перезагрузить данные
            // Обновить select'ы в других формах, если они используются
            await loadShipmentsForSelect('distribution-shipment');
            await loadClientsForSelect('distribution-client');
        } else {
            throw new Error(response.message || 'Неизвестная ошибка');
        }
    } catch (error) {
        console.error('Ошибка удаления распределения:', error);
        logisticsPanel.showMessage(`Ошибка удаления распределения: ${error.message}`, 'error');
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('distribution-tab')?.classList.contains('active')) {
        loadDistributionTab();
    }
});