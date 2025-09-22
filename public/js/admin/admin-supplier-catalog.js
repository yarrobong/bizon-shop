// admin-supplier-catalog.js

async function loadSupplierCatalogTab() {
    
    // Сбрасываем поиск при переходе на вкладку
    const searchInput = document.getElementById('supplier-catalog-search');
    if (searchInput) {
        searchInput.value = '';
    }
    await loadSupplierCatalog();
}

async function loadSupplierCatalog(searchTerm = '') {
    console.log("Начало loadSupplierCatalog, searchTerm:", searchTerm); // <-- Отладка 1
    const tab = document.getElementById('supplier-catalog-tab');
    console.log("tab элемент:", tab); // <-- Отладка 2
    if (!tab) return;
    const container = document.getElementById('supplier-catalog-grid');
    console.log("container элемент:", container); // <-- Отладка 3
    if (!container) return;

    try {
        container.innerHTML = '<div class="empty">Загрузка товаров...</div>';
        console.log("Запрос к /api/products?admin=true"); // <-- Отладка 4
        const response = await fetch('/api/products?admin=true');
        console.log("Ответ от /api/products?admin=true, статус:", response.status); // <-- Отладка 5
        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status}`, errorText); // <-- Отладка 6
            throw new Error(`HTTP error! status: ${response.status}`);
            
        }
        const products = await response.json();
        console.log("Полученные товары:", products); // <-- Отладка 7

        let filteredProducts = products;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filteredProducts = products.filter(product =>
                (product.title && product.title.toLowerCase().includes(term)) ||
                (product.supplier_link && product.supplier_link.toLowerCase().includes(term))
            );
        }
         console.log("Отфильтрованные товары:", filteredProducts); // <-- Отладка 8

        renderSupplierCatalog(filteredProducts);
        console.log("renderSupplierCatalog завершена"); // <-- Отладка 9
    } catch (error) {
        onsole.error('❌ Ошибка загрузки каталога для поставщика:', error); // <-- Отладка 10
        console.error('Ошибка загрузки каталога для поставщика:', error);
        container.innerHTML = '<div class="empty">Ошибка загрузки товаров</div>';
    }
}

function renderSupplierCatalog(products) {
         console.log("Начало renderSupplierCatalog, products:", products); // <-- Отладка 11
    const container = document.getElementById('supplier-catalog-grid');
    if (!container) {
         console.warn("Элемент #supplier-catalog-grid не найден в renderSupplierCatalog");
         return; // <-- ВАЖНО: return, если контейнер не найден
    }

    container.innerHTML = '';

    if (!products || products.length === 0) {
        container.innerHTML = '<div class="empty">Нет товаров для отображения</div>';
        return;
    }

    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';

        const imageUrl = product.images && product.images.length > 0 ?
            product.images[0].url : '/assets/icons/placeholder1.webp';

        let supplierContent = 'Информация отсутствует';
        let displayLink = '';
        let isUrl = false;

        if (product.supplier_link) {
            try {
                new URL(product.supplier_link);
                isUrl = true;
                displayLink = product.supplier_link.length > 50 ?
                    product.supplier_link.substring(0, 47) + '...' :
                    product.supplier_link;
                supplierContent = `<a href="${product.supplier_link}" target="_blank" rel="noopener noreferrer">${adminPanel.escapeHtml(displayLink)}</a>`;
            } catch (e) {
                displayLink = product.supplier_link.length > 50 ?
                    product.supplier_link.substring(0, 47) + '...' :
                    product.supplier_link;
                supplierContent = `<span class="supplier-truncated-text" title="${adminPanel.escapeHtml(product.supplier_link)}">${adminPanel.escapeHtml(displayLink)}</span>`;
            }
        }

        const copyText = product.supplier_link || '';

        card.innerHTML = `
            <div class="supplier-product-card">
                <img src="${imageUrl}" alt="${adminPanel.escapeHtml(product.title)}" 
                     class="supplier-product-image" 
                     onerror="this.src='/assets/icons/placeholder1.webp'">
                <div class="supplier-product-info">
                    <h3 class="supplier-product-title">${adminPanel.escapeHtml(product.title)}</h3>
                    <div class="supplier-link-section">
                        <div class="supplier-link-label">Где купить:</div>
                        <div class="supplier-link-content">
                            ${supplierContent}
                            ${product.supplier_link ? `<button class="supplier-copy-btn" data-copy-text="${adminPanel.escapeHtml(copyText)}" title="Копировать информацию о поставщике">Копировать</button>` : ''}
                        </div>
                        ${product.supplier_notes ?
                    `<div class="supplier-notes">${adminPanel.escapeHtml(product.supplier_notes)}</div>` :
                    ''
                }
                    </div>
                </div>
            </div>
        `;

        container.appendChild(card);
    });

    container.querySelectorAll('.supplier-copy-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const textToCopy = button.getAttribute('data-copy-text');
            if (textToCopy) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    const originalText = button.textContent;
                    button.textContent = 'Скопировано!';
                    button.classList.add('copied');
                    setTimeout(() => {
                        button.textContent = originalText;
                        button.classList.remove('copied');
                    }, 2000);
                }).catch(err => {
                    console.error('Ошибка копирования текста: ', err);
                    adminPanel.showMessage('Не удалось скопировать текст', 'error');
                });
            }
        });
    });
}

// Инициализация после загрузки DOM и установка обработчика поиска
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded сработал для admin-supplier-catalog.js"); // <-- Отладка 12
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

    if (document.getElementById('supplier-catalog-tab')?.classList.contains('active')) {
        loadSupplierCatalogTab();
    }
});