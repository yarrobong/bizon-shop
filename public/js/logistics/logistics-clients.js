// logistics-clients.js

async function loadClientsTab() {
    await loadClients();
}

async function loadClients() {
    try {
        const response = await logisticsPanel.apiRequest('/api/clients');
        renderClients(response);
    } catch (error) {
        console.error('Ошибка загрузки клиентов:', error);
        logisticsPanel.showMessage(`Ошибка загрузки клиентов: ${error.message}`, 'error');
        renderClients([]);
    }
}

function renderClients(clients) {
    const container = document.getElementById('clients-grid');
    if (!container) return;

    container.innerHTML = '';

    if (!clients || clients.length === 0) {
        container.innerHTML = '<div class="empty">Нет клиентов</div>';
        return;
    }

    clients.forEach(client => {
        const card = document.createElement('div');
        card.className = 'logistics-card';

        card.innerHTML = `
            <h3>${logisticsPanel.escapeHtml(client.Name)}</h3>
            <p><strong>Контакт:</strong> ${logisticsPanel.escapeHtml(client.Contact || 'Не указан')}</p>
            <p><strong>Адрес:</strong> ${logisticsPanel.escapeHtml(client.Address || 'Не указан')}</p>
            <p><strong>Примечания:</strong> ${logisticsPanel.escapeHtml(client.Notes || '')}</p>
            <div class="logistics-actions">
                <button class="btn-primary" onclick="editClient(${client.ClientID})">Редактировать</button>
                <button class="btn-danger" onclick="deleteClient(${client.ClientID})">Удалить</button>
            </div>
        `;

        container.appendChild(card);
    });
}

// Обработчик формы клиента
document.getElementById('client-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
        Name: document.getElementById('client-name').value,
        Contact: document.getElementById('client-contact').value,
        Address: document.getElementById('client-address').value,
        Notes: document.getElementById('client-notes').value
    };

    const clientId = document.getElementById('client-id').value; // Проверяем ID

    try {
        let url, method;
        if (clientId) {
            url = `/api/clients/${clientId}`;
            method = 'PUT';
        } else {
            url = '/api/clients';
            method = 'POST';
        }

        const response = await logisticsPanel.apiRequest(url, {
            method: method,
            body: JSON.stringify(formData)
        });

        if (response.success) {
            const action = method === 'PUT' ? 'обновлен' : 'сохранен';
            logisticsPanel.showMessage(`Клиент ${action} успешно!`, 'success');
            logisticsPanel.closeModal('client-modal');
            document.getElementById('client-form').reset();
            document.getElementById('client-id').value = ''; // Сбросить ID
            await loadClients(); // Перезагрузить данные
            // Обновить select'ы в других формах, если они используются
            await loadClientsForSelect('client-select');
            await loadClientsForSelect('distribution-client');
        } else {
            throw new Error(response.message || 'Неизвестная ошибка');
        }
    } catch (error) {
        console.error('Ошибка сохранения клиента:', error);
        logisticsPanel.showMessage(`Ошибка сохранения клиента: ${error.message}`, 'error');
    }
});

// Функция редактирования
async function editClient(id) {
    try {
        const clientData = await logisticsPanel.apiRequest(`/api/clients/${id}`);
        document.getElementById('client-id').value = clientData.ClientID;
        document.getElementById('client-name').value = clientData.Name;
        document.getElementById('client-contact').value = clientData.Contact || '';
        document.getElementById('client-address').value = clientData.Address || '';
        document.getElementById('client-notes').value = clientData.Notes || '';

        document.getElementById('client-modal-title').textContent = 'Редактировать клиента';
        document.getElementById('client-modal').style.display = 'block';
    } catch (error) {
        console.error('Ошибка загрузки данных клиента для редактирования:', error);
        logisticsPanel.showMessage(`Ошибка загрузки данных: ${error.message}`, 'error');
    }
}

// Функция удаления
async function deleteClient(id) {
    if (!confirm(`Вы уверены, что хотите удалить клиента #${id}?`)) return;

    try {
        const response = await logisticsPanel.apiRequest(`/api/clients/${id}`, {
            method: 'DELETE'
        });

        if (response.success) {
            logisticsPanel.showMessage('Клиент удален успешно!', 'success');
            await loadClients(); // Перезагрузить данные
            // Обновить select'ы в других формах, если они используются
            await loadClientsForSelect('client-select');
            await loadClientsForSelect('distribution-client');
        } else {
            throw new Error(response.message || 'Неизвестная ошибка');
        }
    } catch (error) {
        console.error('Ошибка удаления клиента:', error);
        logisticsPanel.showMessage(`Ошибка удаления клиента: ${error.message}`, 'error');
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('clients-tab')?.classList.contains('active')) {
        loadClientsTab();
    }
});