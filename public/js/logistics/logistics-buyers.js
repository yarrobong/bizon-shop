// logistics-buyers.js

async function loadBuyersTab() {
    await loadBuyers();
}

async function loadBuyers() {
    try {
        const response = await logisticsPanel.apiRequest('/api/buyers');
        renderBuyers(response);
    } catch (error) {
        console.error('Ошибка загрузки баеров:', error);
        logisticsPanel.showMessage(`Ошибка загрузки баеров: ${error.message}`, 'error');
        renderBuyers([]);
    }
}

function renderBuyers(buyers) {
    const container = document.getElementById('buyers-grid');
    if (!container) return;

    container.innerHTML = '';

    if (!buyers || buyers.length === 0) {
        container.innerHTML = '<div class="empty">Нет баеров</div>';
        return;
    }

    buyers.forEach(buyer => {
        const card = document.createElement('div');
        card.className = 'logistics-card';

        card.innerHTML = `
            <h3>${logisticsPanel.escapeHtml(buyer.Name)}</h3>
            <p><strong>Контакт:</strong> ${logisticsPanel.escapeHtml(buyer.Contact || 'Не указан')}</p>
            <p><strong>Примечания:</strong> ${logisticsPanel.escapeHtml(buyer.Notes || '')}</p>
            <div class="logistics-actions">
                <button class="btn-primary" onclick="editBuyer(${buyer.BuyerID})">Редактировать</button>
                <button class="btn-danger" onclick="deleteBuyer(${buyer.BuyerID})">Удалить</button>
            </div>
        `;

        container.appendChild(card);
    });
}

// Обработчик формы баера
document.getElementById('buyer-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
        Name: document.getElementById('buyer-name').value,
        Contact: document.getElementById('buyer-contact').value,
        Notes: document.getElementById('buyer-notes').value
    };

    const buyerId = document.getElementById('buyer-id').value; // Проверяем ID

    try {
        let url, method;
        if (buyerId) {
            url = `/api/buyers/${buyerId}`;
            method = 'PUT';
        } else {
            url = '/api/buyers';
            method = 'POST';
        }

        const response = await logisticsPanel.apiRequest(url, {
            method: method,
            body: JSON.stringify(formData)
        });

        if (response.success) {
            const action = method === 'PUT' ? 'обновлен' : 'сохранен';
            logisticsPanel.showMessage(`Баер ${action} успешно!`, 'success');
            logisticsPanel.closeModal('buyer-modal');
            document.getElementById('buyer-form').reset();
            document.getElementById('buyer-id').value = ''; // Сбросить ID
            await loadBuyers(); // Перезагрузить данные
            // Обновить select'ы в других формах, если они используются
            await loadBuyersForSelect('buyer-select');
        } else {
            throw new Error(response.message || 'Неизвестная ошибка');
        }
    } catch (error) {
        console.error('Ошибка сохранения баера:', error);
        logisticsPanel.showMessage(`Ошибка сохранения баера: ${error.message}`, 'error');
    }
});

// Функция редактирования
async function editBuyer(id) {
    try {
        const buyerData = await logisticsPanel.apiRequest(`/api/buyers/${id}`);
        document.getElementById('buyer-id').value = buyerData.BuyerID;
        document.getElementById('buyer-name').value = buyerData.Name;
        document.getElementById('buyer-contact').value = buyerData.Contact || '';
        document.getElementById('buyer-notes').value = buyerData.Notes || '';

        document.getElementById('buyer-modal-title').textContent = 'Редактировать баера';
        document.getElementById('buyer-modal').style.display = 'block';
    } catch (error) {
        console.error('Ошибка загрузки данных баера для редактирования:', error);
        logisticsPanel.showMessage(`Ошибка загрузки данных: ${error.message}`, 'error');
    }
}

// Функция удаления
async function deleteBuyer(id) {
    if (!confirm(`Вы уверены, что хотите удалить баера #${id}?`)) return;

    try {
        const response = await logisticsPanel.apiRequest(`/api/buyers/${id}`, {
            method: 'DELETE'
        });

        if (response.success) {
            logisticsPanel.showMessage('Баер удален успешно!', 'success');
            await loadBuyers(); // Перезагрузить данные
            // Обновить select'ы в других формах, если они используются
            await loadBuyersForSelect('buyer-select');
        } else {
            throw new Error(response.message || 'Неизвестная ошибка');
        }
    } catch (error) {
        console.error('Ошибка удаления баера:', error);
        logisticsPanel.showMessage(`Ошибка удаления баера: ${error.message}`, 'error');
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('buyers-tab')?.classList.contains('active')) {
        loadBuyersTab();
    }
});