// proposal_form.js
document.addEventListener('DOMContentLoaded', function() {
    const productSelect = document.getElementById('product_select');
    const addProductBtn = document.getElementById('add-product-btn');
    const productList = document.getElementById('product-list');
    const totalAmountSpan = document.getElementById('total-amount');
    const selectedProductsJsonInput = document.getElementById('selected_products_json');

    let selectedProducts = [];
    let allProducts = []; // Хранение всех продуктов, полученных с сервера

    // Загрузка товаров из базы данных через AJAX (новый маршрут)
    fetch('/api/products_for_proposal') // Используем новый маршрут
        .then(response => response.json())
        .then(data => {
            if (data.success && Array.isArray(data.products)) {
                allProducts = data.products;
                productSelect.innerHTML = '<option value="">Выберите товар</option>';
                data.products.forEach(product => {
                    const option = document.createElement('option');
                    option.value = product.id;
                    option.textContent = `${product.title} (${formatPrice(product.price)})`;
                    if (!product.available) {
                        option.textContent += ' (Недоступен)';
                        option.disabled = true; // Сделать недоступный товар неактивным
                    }
                    productSelect.appendChild(option);
                });
            } else {
                productSelect.innerHTML = '<option value="">Ошибка загрузки товаров</option>';
                console.error('Ошибка загрузки товаров:', data.error);
            }
        })
        .catch(error => {
            console.error('Ошибка сети:', error);
            productSelect.innerHTML = '<option value="">Ошибка загрузки товаров</option>';
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
        const selectedId = parseInt(productSelect.value);
        const quantity = parseInt(document.getElementById('product_quantity').value) || 1;

        if (isNaN(selectedId) || quantity <= 0) {
            alert('Выберите товар и укажите корректное количество.');
            return;
        }

        const product = allProducts.find(p => p.id === selectedId);
        if (!product) {
            alert('Товар не найден.');
            return;
        }

        // Проверяем, есть ли уже такой товар в списке
        const existingItemIndex = selectedProducts.findIndex(item => item.product.id === selectedId);
        if (existingItemIndex > -1) {
            // Обновляем количество, если товар уже есть
            selectedProducts[existingItemIndex].quantity += quantity;
        } else {
            // Добавляем новый товар
            selectedProducts.push({
                product: product,
                quantity: quantity
            });
        }

        renderSelectedProducts();
        calculateTotal();
    });

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

    // Инициализация
    calculateTotal();
});