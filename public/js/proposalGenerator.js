// js/proposalGenerator.js

// --- Функция генерации HTML ---
function generateProposalHTML(manager_name, manager_contact, customer_name, proposal_title, proposal_text, selectedProducts, total) {
    // ... ваш код генерации HTML из предыдущего примера ...
    // Форматирование цены
    const formatPrice = (price) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(price);
    };

    // Функция получения URL первого изображения
    const getFirstImageURL = (images) => {
        if (Array.isArray(images) && images.length > 0) {
            const first_image = images[0];
            if (first_image && typeof first_image === 'object' && first_image.url) {
                return first_image.url;
            } else if (typeof first_image === 'string') {
                return first_image;
            }
        }
        return '/assets/icons/placeholder1.webp'; // Путь к заглушке
    };

    let tableRows = '';
    for (const item of selectedProducts) {
        const itemPrice = parseFloat(item.product.price) || 0;
        const itemQuantity = parseInt(item.quantity) || 0;
        const totalItemPrice = itemPrice * itemQuantity;

        tableRows += `
            <tr>
                <td class="image-cell">
                    <img src="${getFirstImageURL(item.product.images)}" alt="${item.product.title}">
                </td>
                <td>${item.product.title}</td>
                <td>${formatPrice(itemPrice)}</td>
                <td>${itemQuantity}</td>
                <td>${formatPrice(totalItemPrice)}</td>
            </tr>
        `;
    }

    return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <title>Коммерческое предложение - ${customer_name}</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                padding: 20mm;
                background-color: white;
                color: black;
            }
            .header {
                text-align: center;
                margin-bottom: 20px;
            }
            .logo {
                font-size: 24px;
                font-weight: bold;
                color: #00e5ff; /* Цвет логотипа BIZON */
            }
            .title {
                font-size: 20px;
                font-weight: bold;
                margin: 10px 0;
            }
            .manager-info {
                margin-bottom: 20px;
            }
            .table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
            }
            .table th, .table td {
                border: 1px solid #000;
                padding: 8px;
                text-align: left;
            }
            .table th {
                background-color: #f0f0f0;
            }
            .image-cell {
                text-align: center;
            }
            .image-cell img {
                max-width: 50px;
                max-height: 50px;
                object-fit: contain;
            }
            .total {
                text-align: right;
                font-weight: bold;
                font-size: 16px;
            }
            .footer-note {
                margin-top: 20px;
                font-size: 12px;
                color: gray;
            }
            @media print {
                body {
                    margin: 0;
                }
                .print-btn { display: none; }
            }
        </style>
    </head>
    <body>

        <div class="header">
            <div class="logo">BIZON</div> <!-- Логотип -->
            <div class="title">${proposal_title}</div>
            <div class="manager-info">
                <p><strong>От:</strong> ${manager_name}</p>
                <p><strong>Контакты:</strong> ${manager_contact}</p>
                <p><strong>Для:</strong> ${customer_name}</p>
            </div>
        </div>

        <p>${proposal_text.replace(/\n/g, '<br>')}</p> <!-- Заменяем переводы строк на <br> -->

        <table class="table">
            <thead>
                <tr>
                    <th>Изображение</th>
                    <th>Наименование</th>
                    <th>Цена</th>
                    <th>Кол-во</th>
                    <th>Сумма</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>

        <div class="total">Итого: ${formatPrice(total)}</div>

        <div class="footer-note">
            <p>Данное коммерческое предложение является официальным и действует в течение 30 дней с даты составления.</p>
        </div>

        <button class="print-btn" onclick="window.print();">Скачать PDF</button>

    </body>
    </html>
    `;
}

// Экспортируем функцию
module.exports = { generateProposalHTML };
// Или, если используется ES6 modules (и в package.json указан "type": "module"):
// export { generateProposalHTML };