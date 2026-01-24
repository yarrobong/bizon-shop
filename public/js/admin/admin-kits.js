function kitsManagerRenderKits(kits) {
    const container = document.getElementById('admin-kits-list');
    if (!container) {
        console.error('Контейнер таблицы комплектов не найден');
        return;
    }

    container.innerHTML = '';

    if (!kits || kits.length === 0) {
        container.innerHTML = '<tr><td colspan="5" class="empty">Нет комплектов для отображения</td></tr>';
        return;
    }

    kits.forEach(kit => {
        const tr = document.createElement('tr');

        const imageUrl = getImageUrl(kit.images);
        
        const statusClass = kit.available ? 'success' : 'error';
        const statusText = kit.available ? 'В наличии' : 'Недоступен';

        tr.innerHTML = `
            <td>
                <img src="${imageUrl}" alt="${adminPanel.escapeHtml(kit.title)}" class="product-thumb" onerror="this.src='/assets/icons/placeholder1.webp'">
            </td>
            <td><strong>${adminPanel.escapeHtml(kit.title)}</strong></td>
            <td>${adminPanel.formatPrice(kit.price)}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <div class="action-buttons">
                    <button onclick="kitsManagerOpenModal(${kit.id})" class="btn-icon" title="Редактировать">
                        ✏️
                    </button>
                    <button onclick="kitsManagerDeleteKit(${kit.id})" class="btn-icon delete" title="Удалить">
                        🗑️
                    </button>
                </div>
            </td>
        `;

        container.appendChild(tr);
    });
}