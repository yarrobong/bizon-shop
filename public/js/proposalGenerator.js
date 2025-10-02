// js/proposalGenerator.js

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

function generateProposalHTML(manager_name, manager_contact, customer_name, proposal_title, proposal_text, selectedProducts, total) {
    // Используем те же переменные, что и в proposal_form.css
    const cssVariables = `
        :root {
          --bg-primary: #000;
          --bg-secondary: rgba(0, 4, 172, 0.2);
          --text-primary: #fff;
          --text-secondary: rgba(255, 255, 255, 0.7);
          --accent: #00e5ff;
          --accent-hover: #00b3c4;
          --border: #00e5ff;
          --card-bg: rgba(255, 255, 255, 0.1);
          --card-bg-hover: rgba(255, 255, 255, 0.2);
          --shadow: 0 6px 15px rgba(0, 229, 255, 0.4);
        }
    `;

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
            ${cssVariables}
            body {
                font-family: 'Inter', sans-serif; /* Используем шрифт сайта */
                padding: 20mm; /* Отступы для печати */
                background-color: var(--bg-primary); /* Темный фон */
                color: var(--text-primary); /* Светлый текст */
                line-height: 1.6;
                margin: 0; /* Убираем стандартные отступы */
            }
            .header {
                text-align: center;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 2px solid var(--accent); /* Акцентная граница */
            }
            .logo {
                font-size: 28px; /* Увеличенный логотип */
                font-weight: 700; /* Жирный */
                color: var(--accent); /* Акцентный цвет */
                margin-bottom: 5px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px; /* Расстояние между иконкой и текстом */
            }
            .logo-icon img {
                height: 36px; /* Высота иконки логотипа */
                width: auto;
            }
            .title {
                font-size: 24px;
                font-weight: 700;
                color: var(--text-primary);
                margin: 10px 0;
            }
            .manager-info {
                margin-bottom: 20px;
                font-size: 14px; /* Уменьшенный размер текста */
            }
            .manager-info p {
                margin: 5px 0;
            }
            .proposal-text {
                margin-bottom: 20px;
                font-size: 15px; /* Размер текста предложения */
            }
            .table-container {
                background: var(--card-bg); /* Полупрозрачный фон как у карточек */
                border-radius: 0.5rem;
                padding: 1rem;
                margin-bottom: 20px;
                overflow-x: auto; /* На случай, если таблица широкая */
            }
            .table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 0; /* Убираем отступ снизу, так как он внутри .table-container */
            }
            .table th, .table td {
                border: 1px solid rgba(255, 255, 255, 0.3); /* Светлая граница */
                padding: 10px; /* Увеличенный отступ */
                text-align: left;
                color: var(--text-primary);
            }
            .table th {
                background-color: rgba(0, 229, 255, 0.2); /* Акцентный фон заголовков */
                font-weight: 600;
            }
            .image-cell {
                text-align: center;
                vertical-align: middle; /* Выравнивание по центру по вертикали */
            }
            .image-cell img {
                max-width: 60px; /* Увеличенный размер изображения */
                max-height: 60px;
                object-fit: contain;
                border-radius: 0.25rem; /* Легкое скругление */
            }
            .total {
                text-align: right;
                font-weight: 700;
                font-size: 18px; /* Увеличенный размер итога */
                color: var(--accent); /* Акцентный цвет */
                margin-top: 10px;
            }
            .footer-note {
                margin-top: 20px;
                font-size: 12px;
                color: var(--text-secondary); /* Вторичный цвет текста */
                text-align: center;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                padding-top: 10px;
            }
            /* Правила для печати */
            @media print {
                body {
                    padding: 10mm; /* Уменьшаем отступы при печати */
                    background-color: white; /* Белый фон для печати */
                    color: black; /* Черный текст для печати */
                }
                .header, .proposal-text, .table-container, .total, .footer-note {
                    color: black; /* Текст становится черным */
                    border-color: black; /* Границы становятся черными */
                }
                .logo, .table th, .total {
                    color: var(--accent); /* Акцентный цвет сохраняется */
                }
                .table th {
                    background-color: var(--card-bg-hover); /* Светлый фон заголовков при печати */
                }
                .image-cell img {
                    border: 1px solid #ccc; /* Граница для изображения при печати */
                }
            }
        </style>
    </head>
    <body>

        <div class="header">
            <div class="logo">
                <div class="logo-icon">
                    <img src="/assets/logo/logo-Photoroom.webp" alt="BIZON Logo"> <!-- Используем ваш логотип -->
                </div>
                <div class="logo-title">BIZON</div>
            </div>
            <div class="title">${proposal_title}</div>
            <div class="manager-info">
                <p><strong>От:</strong> ${manager_name}</p>
                <p><strong>Контакты:</strong> ${manager_contact}</p>
                <p><strong>Для:</strong> ${customer_name}</p>
            </div>
        </div>

        <div class="proposal-text">
            ${proposal_text.replace(/\n/g, '<br>')} <!-- Заменяем переводы строк на <br> -->
        </div>

        <div class="table-container">
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
        </div>

        <div class="total">Итого: ${formatPrice(total)}</div>

        <div class="footer-note">
            <p>Данное коммерческое предложение является официальным и действует в течение 30 дней с даты составления.</p>
            <p>© ${new Date().getFullYear()} BIZON — Все права защищены</p>
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