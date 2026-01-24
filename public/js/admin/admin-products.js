function renderProducts(products) {
    // Теперь используем tbody таблицы
    const container = document.getElementById('admin-products-list');
    if (!container) {
        console.error('Контейнер таблицы товаров не найден');
        return;
    }

    container.innerHTML = '';

    if (!products || products.length === 0) {
        container.innerHTML = '<tr><td colspan="7" class="empty">Нет товаров для отображения</td></tr>';
        return;
    }

    products.forEach(product => {
        const tr = document.createElement('tr');
        
        const imageUrl = product.images && product.images.length > 0 ? product.images[0].url : '/assets/icons/placeholder1.webp';
        
        const statusClass = product.available ? 'success' : 'error';
        const statusText = product.available ? 'В наличии' : 'Недоступен';

        tr.innerHTML = `
            <td>
                <img src="${imageUrl}" alt="${adminPanel.escapeHtml(product.title)}" class="product-thumb" onerror="this.src='/assets/icons/placeholder1.webp'">
            </td>
            <td>${product.id}</td>
            <td><strong>${adminPanel.escapeHtml(product.title)}</strong></td>
            <td>${adminPanel.escapeHtml(product.category || '—')}</td>
            <td>${adminPanel.formatPrice(product.price)}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <div class="action-buttons">
                    <button onclick="openProductModal(${product.id})" class="btn-icon" title="Редактировать">
                        ✏️
                    </button>
                    <button onclick="deleteProduct(${product.id})" class="btn-icon delete" title="Удалить">
                        🗑️
                    </button>
                </div>
            </td>
        `;

        container.appendChild(tr);
    });
}