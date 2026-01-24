// admin-supplier-catalog.js

async function loadSupplierCatalogTab() {
    console.log("Загрузка вкладки каталога поставщика");
    
    // Сбрасываем поиск при переходе на вкладку
    const searchInput = document.getElementById('supplier-catalog-search');
    if (searchInput) {
        searchInput.value = '';
    }
    await loadSupplierCatalog();
}

async function loadSupplierCatalog(searchTerm = '') {
    
    const container = document.getElementById('supplier-catalog-list');
    if (!container) {
        console.warn("Контейнер #supplier-catalog-list не найден");
        return;
    }

    try {
        container.innerHTML = '<tr><td colspan="5" class="empty">Загрузка товаров...</td></tr>';
        
        const response = await fetchWithAuth('/api/products?admin=true&show_all=true');
        
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`HTTP error! status: ${response.status}`, errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const products = Array.isArray(data) ? data : (data.products || []);
        

        let filteredProducts = products;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filteredProducts = products.filter(product =>
                (product.title && product.title.toLowerCase().includes(term)) ||
                (product.supplier_link && product.supplier_link.toLowerCase().includes(term))
            );
        }
        console.log("Отфильтрованные товары:", filteredProducts);

        renderSupplierCatalog(filteredProducts);
        console.log("renderSupplierCatalog завершена");
    } catch (error) {
        console.error('❌ Ошибка загрузки каталога для поставщика:', error);
        container.innerHTML = '<div class="empty">Ошибка загрузки товаров</div>';
    }
}

// Вспомогательная функция для получения URL изображения
function getSupplierImageUrl(images) {
    if (!images || images.length === 0) return '/assets/icons/placeholder1.webp';
    const firstImage = images[0];
    if (typeof firstImage === 'string') return firstImage;
    if (typeof firstImage === 'object' && firstImage.url) return firstImage.url;
    return '/assets/icons/placeholder1.webp';
}

function renderSupplierCatalog(products) {
    
    const container = document.getElementById('supplier-catalog-list');
    if (!container) {
        console.warn("Элемент #supplier-catalog-list не найден в renderSupplierCatalog");
        return;
    }

    container.innerHTML = '';

    if (!products || products.length === 0) {
        container.innerHTML = '<tr><td colspan="5" class="empty">Нет товаров для отображения</td></tr>';
        return;
    }

    products.forEach(product => {
        const tr = document.createElement('tr');

        const imageUrl = getSupplierImageUrl(product.images);

        let supplierLinkDisplay = '—';
        let supplierLinkFull = '';
        if (product.supplier_link) {
            supplierLinkFull = product.supplier_link;
            try {
                new URL(product.supplier_link);
                supplierLinkDisplay = `<a href="${product.supplier_link}" target="_blank" rel="noopener noreferrer" style="color: var(--accent-blue); text-decoration: underline;">${product.supplier_link.length > 50 ? product.supplier_link.substring(0, 47) + '...' : product.supplier_link}</a>`;
            } catch (e) {
                supplierLinkDisplay = `<span title="${adminPanel.escapeHtml(product.supplier_link)}">${product.supplier_link.length > 50 ? product.supplier_link.substring(0, 47) + '...' : product.supplier_link}</span>`;
            }
        }

        tr.innerHTML = `
            <td>
                <img src="${imageUrl}" alt="${adminPanel.escapeHtml(product.title)}" class="product-thumb" onerror="this.src='/assets/icons/placeholder1.webp'">
            </td>
            <td><strong>${adminPanel.escapeHtml(product.title)}</strong></td>
            <td>${supplierLinkDisplay}</td>
            <td>${product.supplier_notes ? adminPanel.escapeHtml(product.supplier_notes) : '—'}</td>
            <td>
                <div class="action-buttons">
                    ${supplierLinkFull ? `<button class="btn-icon" onclick="navigator.clipboard.writeText('${adminPanel.escapeHtml(supplierLinkFull)}').then(() => adminPanel.showMessage('Скопировано!', 'success')).catch(() => adminPanel.showMessage('Ошибка копирования', 'error'))" title="Копировать ссылку">📋</button>` : ''}
                    <button onclick="openProductModal(${product.id})" class="btn-icon" title="Редактировать">
                        ✏️
                    </button>
                </div>
            </td>
        `;

        container.appendChild(tr);
    });
}
// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded сработал для admin-supplier-catalog.js");
    
    // Устанавливаем обработчик поиска
    const searchInput = document.getElementById('supplier-catalog-search');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const term = e.target.value.trim();
            searchTimeout = setTimeout(() => {
                loadSupplierCatalog(term);
            }, 300);
        });
    }

    // Проверяем, активна ли вкладка при загрузке страницы
    if (document.getElementById('supplier-catalog-tab')?.classList.contains('active')) {
        console.log("Вкладка каталога поставщика активна при загрузке");
        loadSupplierCatalogTab();
    }
});

// Экспортируем функцию для использования из других модулей
window.loadSupplierCatalogTab = loadSupplierCatalogTab;