// proposal_form.js
document.addEventListener('DOMContentLoaded', function() {
    const productSelect = document.getElementById('product_select');
    const productSearch = document.getElementById('product_search');
    const productDropdown = document.getElementById('product_dropdown');
    const addProductBtn = document.getElementById('add-product-btn');
    const productList = document.getElementById('product-list');
    const totalAmountSpan = document.getElementById('total-amount');
    const selectedProductsJsonInput = document.getElementById('selected_products_json');

    let selectedProducts = [];
    let allProducts = []; // Хранение всех продуктов, полученных с сервера
    let selectedProduct = null; // Выбранный продукт
    let isDropdownOpen = false;

    // Загрузка товаров и аттракционов из базы данных через AJAX
    fetch('/api/products_for_proposal')
        .then(response => response.json())
        .then(data => {
            if (data.success && Array.isArray(data.products)) {
                allProducts = data.products;
                productSearch.placeholder = `Найдено ${allProducts.length} товаров и аттракционов...`;
                renderAllProducts();
            } else {
                productSearch.placeholder = 'Ошибка загрузки товаров и аттракционов';
                console.error('Ошибка загрузки товаров и аттракционов:', data.error);
            }
        })
        .catch(error => {
            console.error('Ошибка сети:', error);
            productSearch.placeholder = 'Ошибка загрузки товаров и аттракционов';
        });

    // Функция рендеринга всех продуктов в dropdown
    function renderAllProducts() {
        productDropdown.innerHTML = '';

        const products = allProducts.filter(item => item.type === 'product');
        const attractions = allProducts.filter(item => item.type === 'attraction');

        // Добавляем товары
        if (products.length > 0) {
            const productGroup = document.createElement('div');
            productGroup.className = 'searchable-select-group';
            productGroup.innerHTML = '<div class="searchable-select-group-title">Товары</div>';

            products.forEach(product => {
                const option = document.createElement('div');
                option.className = 'searchable-select-option';
                option.dataset.id = product.id;
                option.dataset.type = product.type;
                option.innerHTML = `
                    <div class="option-title">${product.title}</div>
                    <div class="option-price">${formatPrice(product.price)} <span class="option-type">${product.type === 'product' ? 'Товар' : 'Аттракцион'}</span></div>
                `;
                option.addEventListener('click', () => selectProduct(product));
                productGroup.appendChild(option);
            });
            productDropdown.appendChild(productGroup);
        }

        // Добавляем аттракционы
        if (attractions.length > 0) {
            const attractionGroup = document.createElement('div');
            attractionGroup.className = 'searchable-select-group';
            attractionGroup.innerHTML = '<div class="searchable-select-group-title">Аттракционы</div>';

            attractions.forEach(attraction => {
                const option = document.createElement('div');
                option.className = 'searchable-select-option';
                option.dataset.id = attraction.id;
                option.dataset.type = attraction.type;
                option.innerHTML = `
                    <div class="option-title">${attraction.title}</div>
                    <div class="option-price">${formatPrice(attraction.price)} <span class="option-type">${attraction.type === 'product' ? 'Товар' : 'Аттракцион'}</span></div>
                `;
                option.addEventListener('click', () => selectProduct(attraction));
                attractionGroup.appendChild(option);
            });
            productDropdown.appendChild(attractionGroup);
        }
    }

    // Функция фильтрации продуктов
    function filterProducts(searchTerm) {
        const term = searchTerm.toLowerCase();
        const options = productDropdown.querySelectorAll('.searchable-select-option');

        let visibleCount = 0;
        options.forEach(option => {
            const title = option.querySelector('.option-title').textContent.toLowerCase();
            const isVisible = title.includes(term);
            option.style.display = isVisible ? 'block' : 'none';
            if (isVisible) visibleCount++;
        });

        // Показываем/скрываем группы
        const groups = productDropdown.querySelectorAll('.searchable-select-group');
        groups.forEach(group => {
            const visibleOptions = group.querySelectorAll('.searchable-select-option[style*="block"]');
            group.style.display = visibleOptions.length > 0 ? 'block' : 'none';
        });

        return visibleCount;
    }

    // Функция выбора продукта
    function selectProduct(product) {
        selectedProduct = product;
        productSearch.value = product.title;
        productSelect.value = product.id;
        closeDropdown();
        productSearch.blur();
        updateAddButtonState();
    }

    // Функция обновления состояния кнопки "Добавить товар"
    function updateAddButtonState() {
        if (selectedProduct) {
            addProductBtn.disabled = false;
            addProductBtn.textContent = `Добавить "${selectedProduct.title}"`;
        } else {
            addProductBtn.disabled = true;
            addProductBtn.textContent = 'Выберите товар';
        }
    }

    // Функция открытия dropdown
    function openDropdown() {
        productDropdown.classList.add('show');
        isDropdownOpen = true;
    }

    // Функция закрытия dropdown
    function closeDropdown() {
        productDropdown.classList.remove('show');
        isDropdownOpen = false;
    }

    // Обработчики событий для поиска
    productSearch.addEventListener('input', function(e) {
        const searchTerm = e.target.value;
        const visibleCount = filterProducts(searchTerm);

        if (searchTerm.length > 0) {
            openDropdown();
        } else {
            closeDropdown();
        }
    });

    productSearch.addEventListener('focus', function() {
        if (productSearch.value.length === 0) {
            renderAllProducts();
            openDropdown();
        }
    });

    productSearch.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeDropdown();
            productSearch.blur();
        }
    });

    // Закрытие dropdown при клике вне
    document.addEventListener('click', function(e) {
        if (!productSearch.contains(e.target) && !productDropdown.contains(e.target)) {
            closeDropdown();
        }
    });

    // Форматирование цены
    function formatPrice(price) {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(price);
    }

    // Обработчик добавления товара
    addProductBtn.addEventListener('click', function() {
        if (!selectedProduct) {
            alert('Выберите товар или аттракцион из списка.');
            productSearch.focus();
            return;
        }

        const quantity = parseInt(document.getElementById('product_quantity').value) || 1;

        if (quantity <= 0) {
            alert('Укажите корректное количество.');
            return;
        }

        // Проверяем, есть ли уже такой товар в списке
        const existingItemIndex = selectedProducts.findIndex(item => item.product.id === selectedProduct.id);
        if (existingItemIndex > -1) {
            // Обновляем количество, если товар уже есть
            selectedProducts[existingItemIndex].quantity += quantity;
        } else {
            // Добавляем новый товар
            selectedProducts.push({
                product: selectedProduct,
                quantity: quantity
            });
        }

        renderSelectedProducts();
        calculateTotal();

        // Сбрасываем выбор
        selectedProduct = null;
        productSearch.value = '';
        productSelect.value = '';
        document.getElementById('product_quantity').value = '1';
        updateAddButtonState();
    });

    // Инициализация состояния кнопки
    updateAddButtonState();

    // Рендер выбранных товаров
    function renderSelectedProducts() {
        productList.innerHTML = '';
        selectedProducts.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'product-item';
            div.innerHTML = `
                <div class="product-info">
                    <strong>${item.product.title}</strong> - ${formatPrice(item.product.price)} x ${item.quantity}
                </div>
                <div class="product-actions">
                    <button type="button" onclick="removeProduct(${index})">Удалить</button>
                </div>
            `;
            productList.appendChild(div);
        });
        // Обновляем скрытое поле формы
        selectedProductsJsonInput.value = JSON.stringify(selectedProducts);
    }

    // Удаление товара (глобальная функция для onclick)
    window.removeProduct = function(index) {
        selectedProducts.splice(index, 1);
        renderSelectedProducts();
        calculateTotal();
    }

    // Пересчет общей суммы
    function calculateTotal() {
        const total = selectedProducts.reduce((sum, item) => {
            return sum + (item.product.price * item.quantity);
        }, 0);
        totalAmountSpan.textContent = formatPrice(total);
    }

    // Обработчик отправки формы
    const proposalForm = document.getElementById('proposal-form');
    proposalForm.addEventListener('submit', function(e) {
        e.preventDefault(); // Предотвращаем стандартную отправку формы
        
        // Проверяем, что есть выбранные товары
        if (selectedProducts.length === 0) {
            alert('Добавьте хотя бы один товар в коммерческое предложение.');
            return;
        }
        
        // Создаем объект данных для отправки на сервер
        const requestData = {
            manager_name: document.getElementById('manager_name').value,
            manager_contact: document.getElementById('manager_contact').value,
            customer_name: document.getElementById('customer_name').value,
            proposal_title: document.getElementById('proposal_title').value,
            proposal_text: document.getElementById('proposal_text').value,
            selected_products: JSON.stringify(selectedProducts)
        };
        
        // Отправляем на генерацию HTML страницы
        fetch('/generate_proposal', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Ошибка генерации КП');
            }
            return response.text();
        })
        .then(html => {
            // Пытаемся открыть HTML в новом окне
            const newWindow = window.open('', '_blank');
            
            // Проверяем, не заблокировано ли всплывающее окно
            if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                // Если всплывающее окно заблокировано, создаем blob URL и открываем в новой вкладке
                const blob = new Blob([html], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
                // Очищаем URL через некоторое время
                setTimeout(() => URL.revokeObjectURL(url), 100);
            } else {
                // Если окно открылось успешно, записываем HTML
                newWindow.document.write(html);
                newWindow.document.close();
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            alert('Ошибка при создании коммерческого предложения. Попробуйте еще раз.');
        });
    });

    // Обработчик кнопки "Скачать PDF"
    const downloadPdfBtn = document.getElementById('download-pdf-btn');
    downloadPdfBtn.addEventListener('click', function() {
        // Проверяем, что есть выбранные товары
        if (selectedProducts.length === 0) {
            alert('Добавьте хотя бы один товар в коммерческое предложение.');
            return;
        }
        
        // Создаем объект данных для отправки на сервер
        const requestData = {
            manager_name: document.getElementById('manager_name').value,
            manager_contact: document.getElementById('manager_contact').value,
            customer_name: document.getElementById('customer_name').value,
            proposal_title: document.getElementById('proposal_title').value,
            proposal_text: document.getElementById('proposal_text').value,
            selected_products: JSON.stringify(selectedProducts)
        };
        
        // Отправляем на генерацию PDF
        fetch('/generate_proposal_pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Ошибка генерации PDF');
            }
            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const safeCustomerName = requestData.customer_name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_');
            a.download = `kommercheskoe_predlozhenie_${safeCustomerName}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        })
        .catch(error => {
            console.error('Ошибка:', error);
            alert('Ошибка при скачивании PDF. Попробуйте еще раз.');
        });
    });

    // Инициализация
    calculateTotal();
});