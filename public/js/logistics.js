// Основной скрипт для системы отслеживания заказов
document.addEventListener('DOMContentLoaded', function() {
    // Переключение вкладок
    const tabButtons = document.querySelectorAll('.logistics-tab-btn');
    const tabContents = document.querySelectorAll('.logistics-tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');

            // Удалить активный класс у всех кнопок и вкладок
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Добавить активный класс к текущей кнопке и вкладке
            button.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');

            // Загрузить данные для активной вкладки
            loadData(tabId);
        });
    });

    // Функция для загрузки данных
    function loadData(tabName) {
        switch(tabName) {
            case 'orders':
                loadPurchaseOrders();
                break;
            case 'clients':
                loadClients();
                break;
            case 'buyers':
                loadBuyers();
                break;
            case 'shipments':
                loadShipments();
                break;
            case 'distribution':
                loadDistribution();
                break;
            case 'payments':
                loadPayments();
                break;
        }
    }

    // Функция для показа сообщения
    function showMessage(message, type = 'info') {
        const messageEl = document.createElement('div');
        messageEl.className = `admin-message ${type}`;
        messageEl.textContent = message;

        document.body.appendChild(messageEl);

        setTimeout(() => {
            messageEl.remove();
        }, 3000);
    }

    // Обработчики для модальных окон
    const modals = {
        order: {
            modal: document.getElementById('order-modal'),
            openBtn: document.getElementById('add-order-btn'),
            form: document.getElementById('order-form'),
            title: document.getElementById('order-modal-title'),
            id: document.getElementById('order-id')
        },
        client: {
            modal: document.getElementById('client-modal'),
            openBtn: document.getElementById('add-client-btn'),
            form: document.getElementById('client-form'),
            title: document.getElementById('client-modal-title'),
            id: document.getElementById('client-id')
        },
        buyer: {
            modal: document.getElementById('buyer-modal'),
            openBtn: document.getElementById('add-buyer-btn'),
            form: document.getElementById('buyer-form'),
            title: document.getElementById('buyer-modal-title'),
            id: document.getElementById('buyer-id')
        },
        shipment: {
            modal: document.getElementById('shipment-modal'),
            openBtn: document.getElementById('add-shipment-btn'),
            form: document.getElementById('shipment-form'),
            title: document.getElementById('shipment-modal-title'),
            id: document.getElementById('shipment-id')
        },
        distribution: {
            modal: document.getElementById('distribution-modal'),
            openBtn: document.getElementById('add-distribution-btn'),
            form: document.getElementById('distribution-form'),
            title: document.getElementById('distribution-modal-title'),
            id: document.getElementById('distribution-id')
        },
        payment: {
            modal: document.getElementById('payment-modal'),
            openBtn: document.getElementById('add-payment-btn'),
            form: document.getElementById('payment-form'),
            title: document.getElementById('payment-modal-title'),
            id: document.getElementById('payment-id')
        }
    };

    // Открытие модальных окон
    Object.keys(modals).forEach(key => {
        const modal = modals[key];

        modal.openBtn.addEventListener('click', () => {
            modal.id.value = '';
            modal.title.textContent = `Добавить ${key}`;
            modal.form.reset();
            modal.modal.style.display = 'block';
        });

        // Закрытие модальных окон
        modal.modal.querySelector('.close').addEventListener('click', () => {
            modal.modal.style.display = 'none';
        });

        // Отмена в формах
        const cancelBtn = document.getElementById(`cancel-${key}-btn`);
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                modal.modal.style.display = 'none';
            });
        }
    });

    // Логика для формы заказа
    document.getElementById('order-form').addEventListener('submit', function(e) {
        e.preventDefault();

        const formData = new FormData(this);

        // Отправка данных на сервер
        fetch('/api/purchase-orders', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if(data.success) {
                showMessage('Заказ сохранен успешно!', 'success');

                // Закрыть модальное окно
                document.getElementById('order-modal').style.display = 'none';

                // Сбросить форму
                this.reset();

                // Обновить список заказов
                loadPurchaseOrders(); // Используйте правильное имя функции
            } else {
                showMessage('Ошибка: ' + data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            showMessage('Ошибка при сохранении заказа', 'error');
        });
    });

    function loadPurchaseOrders() {
        fetch('/api/purchase-orders')
            .then(response => response.json())
            .then(orders => {
                const ordersGrid = document.getElementById('orders-grid');
                ordersGrid.innerHTML = ''; // Очистить перед добавлением новых

                if(orders.length === 0) {
                    ordersGrid.innerHTML = '<div class="empty">Нет заказов</div>';
                    return;
                }

                orders.forEach(order => {
                    const orderCard = document.createElement('div');
                    orderCard.className = 'logistics-card';
                    orderCard.innerHTML = `
                        <h3>Заказ #${order.OurOrderNumber}</h3>
                        <p><strong>Клиент:</strong> ${order.ClientName || 'Не указан'}</p>
                        <p><strong>Баер:</strong> ${order.BuyerName || 'Не указан'}</p>
                        <p><strong>Дата:</strong> ${order.OrderDate || 'Не указана'}</p>
                        <p><strong>Статус:</strong> <span class="status-badge status-${order.Status || 'оформлен'}">${order.Status || 'оформлен'}</span></p>
                        <div class="logistics-actions">
                            <button class="btn-primary" onclick="editOrder(${order.OrderID})">Редактировать</button>
                            <button class="btn-danger" onclick="deleteOrder(${order.OrderID})">Удалить</button>
                        </div>
                    `;
                    ordersGrid.appendChild(orderCard);
                });
            })
            .catch(error => {
                console.error('Ошибка загрузки заказов:', error);
                showMessage('Ошибка загрузки заказов', 'error');
            });
    }

    // Логика для формы клиента
    document.getElementById('client-form').addEventListener('submit', function(e) {
        e.preventDefault();

        const formData = new FormData(this);

        fetch('/api/clients', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if(data.success) {
                showMessage('Клиент сохранен успешно!', 'success');
                document.getElementById('client-modal').style.display = 'none';
                loadClients();
            } else {
                showMessage('Ошибка: ' + data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            showMessage('Ошибка при сохранении клиента', 'error');
        });
    });

    function loadClients() {
        fetch('/api/clients')
            .then(response => response.json())
            .then(clients => {
                const clientsGrid = document.getElementById('clients-grid');
                clientsGrid.innerHTML = '';

                if(clients.length === 0) {
                    clientsGrid.innerHTML = '<div class="empty">Нет клиентов</div>';
                    return;
                }

                clients.forEach(client => {
                    const clientCard = document.createElement('div');
                    clientCard.className = 'logistics-card';
                    clientCard.innerHTML = `
                        <h3>${client.Name}</h3>
                        <p><strong>Контакт:</strong> ${client.Contact || 'Не указан'}</p>
                        <p><strong>Адрес:</strong> ${client.Address || 'Не указан'}</p>
                        <p><strong>Примечания:</strong> ${client.Notes || ''}</p>
                        <div class="logistics-actions">
                            <button class="btn-primary" onclick="editClient(${client.ClientID})">Редактировать</button>
                            <button class="btn-danger" onclick="deleteClient(${client.ClientID})">Удалить</button>
                        </div>
                    `;
                    clientsGrid.appendChild(clientCard);
                });
            })
            .catch(error => {
                console.error('Ошибка загрузки клиентов:', error);
                showMessage('Ошибка загрузки клиентов', 'error');
            });
    }

    // Логика для формы баера
document.getElementById('buyer-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const formData = new FormData(this);

    fetch('/api/buyers', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        // Проверяем, успешен ли ответ (status 2xx)
        if (!response.ok) {
            // Если ответ не успешный, возвращаем текст ошибки
            return response.text().then(text => {
                throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
            });
        }
        // Если успешный, парсим JSON
        return response.json();
    })
    .then(data => {
        // Теперь data - это гарантированно JSON из успешного ответа
        if(data.success) {
            showMessage('Баер сохранен успешно!', 'success');
            document.getElementById('buyer-modal').style.display = 'none';
            loadBuyers();
        } else {
            showMessage('Ошибка: ' + data.message, 'error');
        }
    })
    .catch(error => {
        // Обработка ошибок сети, ошибок парсинга или ошибок сервера
        console.error('Ошибка:', error);
        showMessage('Ошибка при сохранении баера: ' + error.message, 'error');
    });
});
function loadBuyers() {
    fetch('/api/buyers')
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
                });
            }
            return response.json();
        })
        .then(buyers => {
            const buyersGrid = document.getElementById('buyers-grid');
            buyersGrid.innerHTML = '';

            if(buyers.length === 0) {
                buyersGrid.innerHTML = '<div class="empty">Нет баеров</div>';
                return;
            }

            buyers.forEach(buyer => {
                const buyerCard = document.createElement('div');
                buyerCard.className = 'logistics-card';
                buyerCard.innerHTML = `
                    <h3>${buyer.Name}</h3>
                    <p><strong>Контакт:</strong> ${buyer.Contact || 'Не указан'}</p>
                    <p><strong>Примечания:</strong> ${buyer.Notes || ''}</p>
                    <div class="logistics-actions">
                        <button class="btn-primary" onclick="editBuyer(${buyer.BuyerID})">Редактировать</button>
                        <button class="btn-danger" onclick="deleteBuyer(${buyer.BuyerID})">Удалить</button>
                    </div>
                `;
                buyersGrid.appendChild(buyerCard);
            });
        })
        .catch(error => {
            console.error('Ошибка загрузки баеров:', error);
            showMessage('Ошибка загрузки баеров: ' + error.message, 'error');
        });
}
    // Логика для формы партии
    document.getElementById('shipment-form').addEventListener('submit', function(e) {
        e.preventDefault();

        const formData = new FormData(this);

        fetch('/api/shipments', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if(data.success) {
                showMessage('Партия сохранена успешно!', 'success');
                document.getElementById('shipment-modal').style.display = 'none';
                loadShipments();
            } else {
                showMessage('Ошибка: ' + data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            showMessage('Ошибка при сохранении партии', 'error');
        });
    });

    function loadShipments() {
        fetch('/api/shipments')
            .then(response => response.json())
            .then(shipments => {
                const shipmentsGrid = document.getElementById('shipments-grid');
                shipmentsGrid.innerHTML = '';

                if(shipments.length === 0) {
                    shipmentsGrid.innerHTML = '<div class="empty">Нет партий</div>';
                    return;
                }

                shipments.forEach(shipment => {
                    const shipmentCard = document.createElement('div');
                    shipmentCard.className = 'logistics-card';
                    shipmentCard.innerHTML = `
                        <h3>Партия ${shipment.ShipmentNumber || 'Не указан'}</h3>
                        <p><strong>Заказ:</strong> ${shipment.OrderNumber || 'Не указан'}</p>
                        <p><strong>Трек-номер:</strong> ${shipment.TrackingNumber || 'Не указан'}</p>
                        <p><strong>Дата отправки:</strong> ${shipment.DepartureDate || 'Не указана'}</p>
                        <p><strong>Статус:</strong> <span class="status-badge status-${shipment.ShipmentStatus || 'в пути'}">${shipment.ShipmentStatus || 'в пути'}</span></p>
                        <p><strong>Оплата:</strong> <span class="status-badge status-${shipment.PaymentStatus || 'не оплачено'}">${shipment.PaymentStatus || 'не оплачено'}</span></p>
                        <div class="logistics-actions">
                            <button class="btn-primary" onclick="editShipment(${shipment.ShipmentID})">Редактировать</button>
                            <button class="btn-danger" onclick="deleteShipment(${shipment.ShipmentID})">Удалить</button>
                        </div>
                    `;
                    shipmentsGrid.appendChild(shipmentCard);
                });
            })
            .catch(error => {
                console.error('Ошибка загрузки партий:', error);
                showMessage('Ошибка загрузки партий', 'error');
            });
    }

    // Логика для формы распределения
    document.getElementById('distribution-form').addEventListener('submit', function(e) {
        e.preventDefault();

        const formData = new FormData(this);

        fetch('/api/distribution', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if(data.success) {
                showMessage('Распределение сохранено успешно!', 'success');
                document.getElementById('distribution-modal').style.display = 'none';
                loadDistribution();
            } else {
                showMessage('Ошибка: ' + data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            showMessage('Ошибка при сохранении распределения', 'error');
        });
    });

    function loadDistribution() {
        fetch('/api/distribution')
            .then(response => response.json())
            .then(distributions => {
                const distributionGrid = document.getElementById('distribution-grid');
                distributionGrid.innerHTML = '';

                if(distributions.length === 0) {
                    distributionGrid.innerHTML = '<div class="empty">Нет распределений</div>';
                    return;
                }

                distributions.forEach(distribution => {
                    const distributionCard = document.createElement('div');
                    distributionCard.className = 'logistics-card';
                    distributionCard.innerHTML = `
                        <h3>Распределение #${distribution.DistributionID}</h3>
                        <p><strong>Партия:</strong> ${distribution.ShipmentNumber || 'Не указана'}</p>
                        <p><strong>Клиент:</strong> ${distribution.ClientName || 'Не указан'}</p>
                        <p><strong>Адрес:</strong> ${distribution.Address || 'Не указан'}</p>
                        <p><strong>Статус:</strong> <span class="status-badge status-${distribution.Status || 'отправлено'}">${distribution.Status || 'отправлено'}</span></p>
                        <div class="logistics-actions">
                            <button class="btn-primary" onclick="editDistribution(${distribution.DistributionID})">Редактировать</button>
                            <button class="btn-danger" onclick="deleteDistribution(${distribution.DistributionID})">Удалить</button>
                        </div>
                    `;
                    distributionGrid.appendChild(distributionCard);
                });
            })
            .catch(error => {
                console.error('Ошибка загрузки распределений:', error);
                showMessage('Ошибка загрузки распределений', 'error');
            });
    }

    // Логика для формы платежа
    document.getElementById('payment-form').addEventListener('submit', function(e) {
        e.preventDefault();

        const formData = new FormData(this);

        fetch('/api/payments', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if(data.success) {
                showMessage('Платеж сохранен успешно!', 'success');
                document.getElementById('payment-modal').style.display = 'none';
                loadPayments();
            } else {
                showMessage('Ошибка: ' + data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            showMessage('Ошибка при сохранении платежа', 'error');
        });
    });

    function loadPayments() {
        fetch('/api/payments')
            .then(response => response.json())
            .then(payments => {
                const paymentsGrid = document.getElementById('payments-grid');
                paymentsGrid.innerHTML = '';

                if(payments.length === 0) {
                    paymentsGrid.innerHTML = '<div class="empty">Нет платежей</div>';
                    return;
                }

                payments.forEach(payment => {
                    const paymentCard = document.createElement('div');
                    paymentCard.className = 'logistics-card';
                    paymentCard.innerHTML = `
                        <h3>Платеж #${payment.PaymentID}</h3>
                        <p><strong>Сумма:</strong> ${payment.Amount} ${payment.Currency}</p>
                        <p><strong>Дата:</strong> ${payment.PaymentDate || 'Не указана'}</p>
                        <p><strong>Тип:</strong> ${payment.PaymentType || 'Не указан'}</p>
                        <p><strong>Направление:</strong> ${payment.Direction || 'Не указано'}</p>
                        <div class="logistics-actions">
                            <button class="btn-primary" onclick="editPayment(${payment.PaymentID})">Редактировать</button>
                            <button class="btn-danger" onclick="deletePayment(${payment.PaymentID})">Удалить</button>
                        </div>
                    `;
                    paymentsGrid.appendChild(paymentCard);
                });
            })
            .catch(error => {
                console.error('Ошибка загрузки платежей:', error);
                showMessage('Ошибка загрузки платежей', 'error');
            });
    }

    // Обработчик выхода
    document.getElementById('logistics-logout-btn').addEventListener('click', function() {
        // Здесь будет вызов API для выхода
        console.log('Выход из системы');
        window.location.href = '/login'; // или другая страница
    });

    // Обработчики поиска
    document.getElementById('orders-search').addEventListener('input', function() {
        // Здесь будет логика поиска заказов
        console.log('Поиск заказов:', this.value);
        searchPurchaseOrders(this.value);
    });

    document.getElementById('clients-search').addEventListener('input', function() {
        // Здесь будет логика поиска клиентов
        console.log('Поиск клиентов:', this.value);
        searchClients(this.value);
    });

    document.getElementById('buyers-search').addEventListener('input', function() {
        // Здесь будет логика поиска баеров
        console.log('Поиск баеров:', this.value);
        searchBuyers(this.value);
    });

    document.getElementById('shipments-search').addEventListener('input', function() {
        // Здесь будет логика поиска партий
        console.log('Поиск партий:', this.value);
        searchShipments(this.value);
    });

    document.getElementById('distribution-search').addEventListener('input', function() {
        // Здесь будет логика поиска распределений
        console.log('Поиск распределений:', this.value);
        searchDistribution(this.value);
    });

    document.getElementById('payments-search').addEventListener('input', function() {
        // Здесь будет логика поиска платежей
        console.log('Поиск платежей:', this.value);
        searchPayments(this.value);
    });

    // Загрузка начальных данных
    loadPurchaseOrders();
    loadClients();
    loadBuyers();
    loadShipments();
    loadDistribution();
    loadPayments();
});

// Функции для редактирования/удаления (нужно реализовать)
function editOrder(id) {
    console.log('Редактировать заказ:', id);
    // Загрузить данные заказа и открыть модальное окно с предзаполненными полями
    fetch(`/api/purchase-orders/${id}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('order-id').value = data.OrderID;
            document.getElementById('order-number').value = data.OurOrderNumber;
            document.getElementById('buyer-order-number').value = data.BuyerOrderNumber;
            document.getElementById('client-select').value = data.ClientID;
            document.getElementById('buyer-select').value = data.BuyerID;
            document.getElementById('order-date').value = data.OrderDate;
            document.getElementById('order-status').value = data.Status;
            document.getElementById('order-description').value = data.Description;
            document.getElementById('order-comments').value = data.Comments;
            document.getElementById('order-modal-title').textContent = 'Редактировать заказ';
            document.getElementById('order-modal').style.display = 'block';
        });
}

function deleteOrder(id) {
    if(confirm('Вы уверены, что хотите удалить заказ?')) {
        fetch(`/api/purchase-orders/${id}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if(data.success) {
                showMessage('Заказ удален успешно!', 'success');
                loadPurchaseOrders();
            } else {
                showMessage('Ошибка: ' + data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            showMessage('Ошибка при удалении заказа', 'error');
        });
    }
}

// Аналогично для других сущностей...
function editClient(id) {
    console.log('Редактировать клиента:', id);
    // Загрузить данные клиента и открыть модальное окно
    fetch(`/api/clients/${id}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('client-id').value = data.ClientID;
            document.getElementById('client-name').value = data.Name;
            document.getElementById('client-contact').value = data.Contact;
            document.getElementById('client-address').value = data.Address;
            document.getElementById('client-notes').value = data.Notes;
            document.getElementById('client-modal-title').textContent = 'Редактировать клиента';
            document.getElementById('client-modal').style.display = 'block';
        });
}

function deleteClient(id) {
    if(confirm('Вы уверены, что хотите удалить клиента?')) {
        fetch(`/api/clients/${id}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if(data.success) {
                showMessage('Клиент удален успешно!', 'success');
                loadClients();
            } else {
                showMessage('Ошибка: ' + data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            showMessage('Ошибка при удалении клиента', 'error');
        });
    }
}

function editBuyer(id) {
    console.log('Редактировать баера:', id);
    // Загрузить данные баера и открыть модальное окно
    fetch(`/api/buyers/${id}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('buyer-id').value = data.BuyerID;
            document.getElementById('buyer-name').value = data.Name;
            document.getElementById('buyer-contact').value = data.Contact;
            document.getElementById('buyer-notes').value = data.Notes;
            document.getElementById('buyer-modal-title').textContent = 'Редактировать баера';
            document.getElementById('buyer-modal').style.display = 'block';
        });
}

function deleteBuyer(id) {
    if(confirm('Вы уверены, что хотите удалить баера?')) {
        fetch(`/api/buyers/${id}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if(data.success) {
                showMessage('Баер удален успешно!', 'success');
                loadBuyers();
            } else {
                showMessage('Ошибка: ' + data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            showMessage('Ошибка при удалении баера', 'error');
        });
    }
}

function editShipment(id) {
    console.log('Редактировать партию:', id);
    // Загрузить данные партии и открыть модальное окно
    fetch(`/api/shipments/${id}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('shipment-id').value = data.ShipmentID;
            document.getElementById('shipment-order').value = data.OrderID;
            document.getElementById('shipment-number').value = data.ShipmentNumber;
            document.getElementById('tracking-number').value = data.TrackingNumber;
            document.getElementById('departure-date').value = data.DepartureDate;
            document.getElementById('arrival-date').value = data.ArrivalDate;
            document.getElementById('shipment-status').value = data.ShipmentStatus;
            document.getElementById('delivery-cost').value = data.DeliveryCost;
            document.getElementById('payment-status').value = data.PaymentStatus;
            document.getElementById('shipment-comments').value = data.Comments;
            document.getElementById('shipment-modal-title').textContent = 'Редактировать партию';
            document.getElementById('shipment-modal').style.display = 'block';
        });
}

function deleteShipment(id) {
    if(confirm('Вы уверены, что хотите удалить партию?')) {
        fetch(`/api/shipments/${id}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if(data.success) {
                showMessage('Партия удалена успешно!', 'success');
                loadShipments();
            } else {
                showMessage('Ошибка: ' + data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            showMessage('Ошибка при удалении партии', 'error');
        });
    }
}

function editDistribution(id) {
    console.log('Редактировать распределение:', id);
    // Загрузить данные распределения и открыть модальное окно
    fetch(`/api/distribution/${id}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('distribution-id').value = data.DistributionID;
            document.getElementById('distribution-shipment').value = data.ShipmentID;
            document.getElementById('distribution-client').value = data.ClientID;
            document.getElementById('distribution-address').value = data.Address;
            document.getElementById('item-description').value = data.ItemDescription;
            document.getElementById('quantity').value = data.Quantity;
            document.getElementById('delivery-cost-rf').value = data.DeliveryCost;
            document.getElementById('payment-status-rf').value = data.PaymentStatus;
            document.getElementById('distribution-status').value = data.Status;
            document.getElementById('distribution-modal-title').textContent = 'Редактировать распределение';
            document.getElementById('distribution-modal').style.display = 'block';
        });
}

function deleteDistribution(id) {
    if(confirm('Вы уверены, что хотите удалить распределение?')) {
        fetch(`/api/distribution/${id}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if(data.success) {
                showMessage('Распределение удалено успешно!', 'success');
                loadDistribution();
            } else {
                showMessage('Ошибка: ' + data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            showMessage('Ошибка при удалении распределения', 'error');
        });
    }
}

function editPayment(id) {
    console.log('Редактировать платеж:', id);
    // Загрузить данные платежа и открыть модальное окно
    fetch(`/api/payments/${id}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('payment-id').value = data.PaymentID;
            document.getElementById('payment-order').value = data.RelatedOrderID;
            document.getElementById('payment-shipment').value = data.RelatedShipmentID;
            document.getElementById('payment-distribution').value = data.RelatedDistributionID;
            document.getElementById('amount').value = data.Amount;
            document.getElementById('currency').value = data.Currency;
            document.getElementById('payment-date').value = data.PaymentDate;
            document.getElementById('payment-type').value = data.PaymentType;
            document.getElementById('direction').value = data.Direction;
            document.getElementById('payment-notes').value = data.Notes;
            document.getElementById('payment-modal-title').textContent = 'Редактировать платеж';
            document.getElementById('payment-modal').style.display = 'block';
        });
}

function deletePayment(id) {
    if(confirm('Вы уверены, что хотите удалить платеж?')) {
        fetch(`/api/payments/${id}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if(data.success) {
                showMessage('Платеж удален успешно!', 'success');
                loadPayments();
            } else {
                showMessage('Ошибка: ' + data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            showMessage('Ошибка при удалении платежа', 'error');
        });
    }
}

// Функции поиска
function searchPurchaseOrders(query) {
    fetch(`/api/purchase-orders/search?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(orders => {
            const ordersGrid = document.getElementById('orders-grid');
            ordersGrid.innerHTML = '';

            if(orders.length === 0) {
                ordersGrid.innerHTML = '<div class="empty">Нет заказов по запросу</div>';
                return;
            }

            orders.forEach(order => {
                const orderCard = document.createElement('div');
                orderCard.className = 'logistics-card';
                orderCard.innerHTML = `
                    <h3>Заказ #${order.OurOrderNumber}</h3>
                    <p><strong>Клиент:</strong> ${order.ClientName || 'Не указан'}</p>
                    <p><strong>Баер:</strong> ${order.BuyerName || 'Не указан'}</p>
                    <p><strong>Дата:</strong> ${order.OrderDate || 'Не указана'}</p>
                    <p><strong>Статус:</strong> <span class="status-badge status-${order.Status || 'оформлен'}">${order.Status || 'оформлен'}</span></p>
                    <div class="logistics-actions">
                        <button class="btn-primary" onclick="editOrder(${order.OrderID})">Редактировать</button>
                        <button class="btn-danger" onclick="deleteOrder(${order.OrderID})">Удалить</button>
                    </div>
                `;
                ordersGrid.appendChild(orderCard);
            });
        })
        .catch(error => {
            console.error('Ошибка поиска заказов:', error);
            showMessage('Ошибка поиска заказов', 'error');
        });
}

// Аналогично для других функций поиска...
function searchClients(query) {
    fetch(`/api/clients/search?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(clients => {
            const clientsGrid = document.getElementById('clients-grid');
            clientsGrid.innerHTML = '';

            if(clients.length === 0) {
                clientsGrid.innerHTML = '<div class="empty">Нет клиентов по запросу</div>';
                return;
            }

            clients.forEach(client => {
                const clientCard = document.createElement('div');
                clientCard.className = 'logistics-card';
                clientCard.innerHTML = `
                    <h3>${client.Name}</h3>
                    <p><strong>Контакт:</strong> ${client.Contact || 'Не указан'}</p>
                    <p><strong>Адрес:</strong> ${client.Address || 'Не указан'}</p>
                    <p><strong>Примечания:</strong> ${client.Notes || ''}</p>
                    <div class="logistics-actions">
                        <button class="btn-primary" onclick="editClient(${client.ClientID})">Редактировать</button>
                        <button class="btn-danger" onclick="deleteClient(${client.ClientID})">Удалить</button>
                    </div>
                `;
                clientsGrid.appendChild(clientCard);
            });
        })
        .catch(error => {
            console.error('Ошибка поиска клиентов:', error);
            showMessage('Ошибка поиска клиентов', 'error');
        });
}

function searchBuyers(query) {
    fetch(`/api/buyers/search?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(buyers => {
            const buyersGrid = document.getElementById('buyers-grid');
            buyersGrid.innerHTML = '';

            if(buyers.length === 0) {
                buyersGrid.innerHTML = '<div class="empty">Нет баеров по запросу</div>';
                return;
            }

            buyers.forEach(buyer => {
                const buyerCard = document.createElement('div');
                buyerCard.className = 'logistics-card';
                buyerCard.innerHTML = `
                    <h3>${buyer.Name}</h3>
                    <p><strong>Контакт:</strong> ${buyer.Contact || 'Не указан'}</p>
                    <p><strong>Примечания:</strong> ${buyer.Notes || ''}</p>
                    <div class="logistics-actions">
                        <button class="btn-primary" onclick="editBuyer(${buyer.BuyerID})">Редактировать</button>
                        <button class="btn-danger" onclick="deleteBuyer(${buyer.BuyerID})">Удалить</button>
                    </div>
                `;
                buyersGrid.appendChild(buyerCard);
            });
        })
        .catch(error => {
            console.error('Ошибка поиска баеров:', error);
            showMessage('Ошибка поиска баеров', 'error');
        });
}

function searchShipments(query) {
    fetch(`/api/shipments/search?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(shipments => {
            const shipmentsGrid = document.getElementById('shipments-grid');
            shipmentsGrid.innerHTML = '';

            if(shipments.length === 0) {
                shipmentsGrid.innerHTML = '<div class="empty">Нет партий по запросу</div>';
                return;
            }

            shipments.forEach(shipment => {
                const shipmentCard = document.createElement('div');
                shipmentCard.className = 'logistics-card';
                shipmentCard.innerHTML = `
                    <h3>Партия ${shipment.ShipmentNumber || 'Не указан'}</h3>
                    <p><strong>Заказ:</strong> ${shipment.OrderNumber || 'Не указан'}</p>
                    <p><strong>Трек-номер:</strong> ${shipment.TrackingNumber || 'Не указан'}</p>
                    <p><strong>Дата отправки:</strong> ${shipment.DepartureDate || 'Не указана'}</p>
                    <p><strong>Статус:</strong> <span class="status-badge status-${shipment.ShipmentStatus || 'в пути'}">${shipment.ShipmentStatus || 'в пути'}</span></p>
                    <p><strong>Оплата:</strong> <span class="status-badge status-${shipment.PaymentStatus || 'не оплачено'}">${shipment.PaymentStatus || 'не оплачено'}</span></p>
                    <div class="logistics-actions">
                        <button class="btn-primary" onclick="editShipment(${shipment.ShipmentID})">Редактировать</button>
                        <button class="btn-danger" onclick="deleteShipment(${shipment.ShipmentID})">Удалить</button>
                    </div>
                `;
                shipmentsGrid.appendChild(shipmentCard);
            });
        })
        .catch(error => {
            console.error('Ошибка поиска партий:', error);
            showMessage('Ошибка поиска партий', 'error');
        });
}

function searchDistribution(query) {
    fetch(`/api/distribution/search?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(distributions => {
            const distributionGrid = document.getElementById('distribution-grid');
            distributionGrid.innerHTML = '';

            if(distributions.length === 0) {
                distributionGrid.innerHTML = '<div class="empty">Нет распределений по запросу</div>';
                return;
            }

            distributions.forEach(distribution => {
                const distributionCard = document.createElement('div');
                distributionCard.className = 'logistics-card';
                distributionCard.innerHTML = `
                    <h3>Распределение #${distribution.DistributionID}</h3>
                    <p><strong>Партия:</strong> ${distribution.ShipmentNumber || 'Не указана'}</p>
                    <p><strong>Клиент:</strong> ${distribution.ClientName || 'Не указан'}</p>
                    <p><strong>Адрес:</strong> ${distribution.Address || 'Не указан'}</p>
                    <p><strong>Статус:</strong> <span class="status-badge status-${distribution.Status || 'отправлено'}">${distribution.Status || 'отправлено'}</span></p>
                    <div class="logistics-actions">
                        <button class="btn-primary" onclick="editDistribution(${distribution.DistributionID})">Редактировать</button>
                        <button class="btn-danger" onclick="deleteDistribution(${distribution.DistributionID})">Удалить</button>
                    </div>
                `;
                distributionGrid.appendChild(distributionCard);
            });
        })
        .catch(error => {
            console.error('Ошибка поиска распределений:', error);
            showMessage('Ошибка поиска распределений', 'error');
        });
}

function searchPayments(query) {
    fetch(`/api/payments/search?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(payments => {
            const paymentsGrid = document.getElementById('payments-grid');
            paymentsGrid.innerHTML = '';

            if(payments.length === 0) {
                paymentsGrid.innerHTML = '<div class="empty">Нет платежей по запросу</div>';
                return;
            }

            payments.forEach(payment => {
                const paymentCard = document.createElement('div');
                paymentCard.className = 'logistics-card';
                paymentCard.innerHTML = `
                    <h3>Платеж #${payment.PaymentID}</h3>
                    <p><strong>Сумма:</strong> ${payment.Amount} ${payment.Currency}</p>
                    <p><strong>Дата:</strong> ${payment.PaymentDate || 'Не указана'}</p>
                    <p><strong>Тип:</strong> ${payment.PaymentType || 'Не указан'}</p>
                    <p><strong>Направление:</strong> ${payment.Direction || 'Не указано'}</p>
                    <div class="logistics-actions">
                        <button class="btn-primary" onclick="editPayment(${payment.PaymentID})">Редактировать</button>
                        <button class="btn-danger" onclick="deletePayment(${payment.PaymentID})">Удалить</button>
                    </div>
                `;
                paymentsGrid.appendChild(paymentCard);
            });
        })
        .catch(error => {
            console.error('Ошибка поиска платежей:', error);
            showMessage('Ошибка поиска платежей', 'error');
        });
}