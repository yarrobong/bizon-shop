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
            // Открываем HTML в новом окне
            const newWindow = window.open('', '_blank');
            newWindow.document.write(html);
            newWindow.document.close();
        })
        .catch(error => {
            console.error('Ошибка:', error);
            alert('Ошибка при создании коммерческого предложения. Попробуйте еще раз.');
        });
    });

    // Инициализация
    calculateTotal();
});