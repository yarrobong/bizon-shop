// logistics-payments.js

async function loadPaymentsTab() {
    await loadPayments();
    await loadPurchaseOrdersForSelect('payment-order'); // Загрузить заказы для формы
    await loadShipmentsForSelect('payment-shipment'); // Загрузить партии для формы
    await loadDistributionForSelect('payment-distribution'); // Загрузить распределения для формы
}

async function loadPayments() {
    try {
        const response = await logisticsPanel.apiRequest('/api/payments');
        renderPayments(response);
    } catch (error) {
        console.error('Ошибка загрузки платежей:', error);
        logisticsPanel.showMessage(`Ошибка загрузки платежей: ${error.message}`, 'error');
        renderPayments([]);
    }
}

function renderPayments(payments) {
    const container = document.getElementById('payments-grid');
    if (!container) return;

    container.innerHTML = '';

    if (!payments || payments.length === 0) {
        container.innerHTML = '<div class="empty">Нет платежей</div>';
        return;
    }

    payments.forEach(payment => {
        const card = document.createElement('div');
        card.className = 'logistics-card';

        // Определить класс направления
        const directionClass = payment.Direction ? payment.Direction.replace(/\s+/g, '-').toLowerCase() : 'входящий';

        card.innerHTML = `
            <h3>Платеж #${payment.PaymentID}</h3>
            <p><strong>Сумма:</strong> ${logisticsPanel.formatPrice(payment.Amount)} ${logisticsPanel.escapeHtml(payment.Currency || 'RUB')}</p>
            <p><strong>Дата:</strong> ${logisticsPanel.formatDate(payment.PaymentDate)}</p>
            <p><strong>Тип:</strong> ${logisticsPanel.escapeHtml(payment.PaymentType || 'Не указан')}</p>
            <p><strong>Направление:</strong> <span class="status-badge status-${directionClass}">${logisticsPanel.escapeHtml(payment.Direction || 'входящий')}</span></p>
            <p><strong>Связан с заказом:</strong> ${payment.RelatedOrderID || 'Нет'}</p>
            <p><strong>Связан с партией:</strong> ${payment.RelatedShipmentID || 'Нет'}</p>
            <p><strong>Связан с распределением:</strong> ${payment.RelatedDistributionID || 'Нет'}</p>
            <p><strong>Примечания:</strong> ${logisticsPanel.escapeHtml(payment.Notes || 'Нет')}</p>
            <div class="logistics-actions">
                <button class="btn-primary" onclick="editPayment(${payment.PaymentID})">Редактировать</button>
                <button class="btn-danger" onclick="deletePayment(${payment.PaymentID})">Удалить</button>
            </div>
        `;

        container.appendChild(card);
    });
}

// Загрузка распределений для select
async function loadDistributionForSelect(selectId) {
    try {
        const response = await logisticsPanel.apiRequest('/api/distribution');
        const select = document.getElementById(selectId);
        if (!select) return;

        select.innerHTML = '<option value="">Выберите распределение</option>';
        response.forEach(distribution => {
            const option = document.createElement('option');
            option.value = distribution.DistributionID;
            option.textContent = `Распределение #${distribution.DistributionID} - ${distribution.ClientName}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Ошибка загрузки распределений для select:', error);
        logisticsPanel.showMessage(`Ошибка загрузки распределений: ${error.message}`, 'error');
    }
}

// Обработчик формы платежа
document.getElementById('payment-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
        RelatedOrderID: parseInt(document.getElementById('payment-order').value) || null,
        RelatedShipmentID: parseInt(document.getElementById('payment-shipment').value) || null,
        RelatedDistributionID: parseInt(document.getElementById('payment-distribution').value) || null,
        Amount: parseFloat(document.getElementById('amount').value) || null,
        Currency: document.getElementById('currency').value,
        PaymentDate: document.getElementById('payment-date').value,
        PaymentType: document.getElementById('payment-type').value,
        Direction: document.getElementById('direction').value,
        Notes: document.getElementById('payment-notes').value
    };

    const paymentId = document.getElementById('payment-id').value; // Проверяем ID

    try {
        let url, method;
        if (paymentId) {
            url = `/api/payments/${paymentId}`;
            method = 'PUT';
        } else {
            url = '/api/payments';
            method = 'POST';
        }

        const response = await logisticsPanel.apiRequest(url, {
            method: method,
            body: JSON.stringify(formData)
        });

        if (response.success) {
            const action = method === 'PUT' ? 'обновлен' : 'сохранен';
            logisticsPanel.showMessage(`Платеж ${action} успешно!`, 'success');
            logisticsPanel.closeModal('payment-modal');
            document.getElementById('payment-form').reset();
            document.getElementById('payment-id').value = ''; // Сбросить ID
            await loadPayments(); // Перезагрузить данные
            // Обновить select'ы в других формах, если они используются
            await loadPurchaseOrdersForSelect('payment-order');
            await loadShipmentsForSelect('payment-shipment');
            await loadDistributionForSelect('payment-distribution');
        } else {
            throw new Error(response.message || 'Неизвестная ошибка');
        }
    } catch (error) {
        console.error('Ошибка сохранения платежа:', error);
        logisticsPanel.showMessage(`Ошибка сохранения платежа: ${error.message}`, 'error');
    }
});

// Функция редактирования
async function editPayment(id) {
    try {
        const paymentData = await logisticsPanel.apiRequest(`/api/payments/${id}`);
        document.getElementById('payment-id').value = paymentData.PaymentID;
        document.getElementById('payment-order').value = paymentData.RelatedOrderID || '';
        document.getElementById('payment-shipment').value = paymentData.RelatedShipmentID || '';
        document.getElementById('payment-distribution').value = paymentData.RelatedDistributionID || '';
        document.getElementById('amount').value = paymentData.Amount || '';
        document.getElementById('currency').value = paymentData.Currency || 'RUB';
        document.getElementById('payment-date').value = paymentData.PaymentDate || '';
        document.getElementById('payment-type').value = paymentData.PaymentType || 'перевод';
        document.getElementById('direction').value = paymentData.Direction || 'входящий';
        document.getElementById('payment-notes').value = paymentData.Notes || '';

        document.getElementById('payment-modal-title').textContent = 'Редактировать платеж';
        document.getElementById('payment-modal').style.display = 'block';
    } catch (error) {
        console.error('Ошибка загрузки данных платежа для редактирования:', error);
        logisticsPanel.showMessage(`Ошибка загрузки данных: ${error.message}`, 'error');
    }
}

// Функция удаления
async function deletePayment(id) {
    if (!confirm(`Вы уверены, что хотите удалить платеж #${id}?`)) return;

    try {
        const response = await logisticsPanel.apiRequest(`/api/payments/${id}`, {
            method: 'DELETE'
        });

        if (response.success) {
            logisticsPanel.showMessage('Платеж удален успешно!', 'success');
            await loadPayments(); // Перезагрузить данные
            // Обновить select'ы в других формах, если они используются
            await loadPurchaseOrdersForSelect('payment-order');
            await loadShipmentsForSelect('payment-shipment');
            await loadDistributionForSelect('payment-distribution');
        } else {
            throw new Error(response.message || 'Неизвестная ошибка');
        }
    } catch (error) {
        console.error('Ошибка удаления платежа:', error);
        logisticsPanel.showMessage(`Ошибка удаления платежа: ${error.message}`, 'error');
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('payments-tab')?.classList.contains('active')) {
        loadPaymentsTab();
    }
});