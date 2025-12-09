// proposalGenerator.js
const fs = require('fs').promises; // Импортируем fs.promises для асинхронного чтения
const path = require('path'); // Импортируем path для построения путей

// Форматирование цены
const formatPrice = (price) => {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(price);
};

// --- НОВАЯ функция: преобразование изображения в base64 ---
async function imageToBase64(imagePath) {
    try {
        // Путь к изображению строим относительно корня проекта или public
        // Предположим, что server.js запускается из корня проекта
        const fullPath = path.join(__dirname, '..', imagePath); // Поднимаемся на уровень выше к public
        const data = await fs.readFile(fullPath);
        const base64String = data.toString('base64');
        const mimeType = getMimeType(path.extname(fullPath).toLowerCase());
        return `data:${mimeType};base64,${base64String}`;
    } catch (error) {
        console.error(`Ошибка при чтении изображения ${imagePath}:`, error);
        // Возвращаем URL заглушки
        return await imageToBase64('/assets/icons/placeholder1.webp'); // Рекурсивно для заглушки
    }
}

// --- Вспомогательная функция: определение MIME-типа ---
function getMimeType(extension) {
    const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml'
    };
    return mimeTypes[extension] || 'image/png'; // По умолчанию PNG
}

// --- НОВАЯ функция: получение base64 логотипа ---
async function getLogoBase64() {
    return await imageToBase64('/assets/logo/logo-Photoroom.webp'); // Путь к логотипу
}

// Функция получения base64 URL первого изображения товара
async function getFirstImageBase64(images) {
    if (Array.isArray(images) && images.length > 0) {
        const first_image = images[0];
        let imagePath = '';
        if (first_image && typeof first_image === 'object' && first_image.url) {
            imagePath = first_image.url;
        } else if (typeof first_image === 'string') {
            imagePath = first_image;
        }
        if (imagePath) {
            return await imageToBase64(imagePath);
        }
    }
    // Возврат заглушки, если изображение не найдено
    return await imageToBase64('/assets/icons/placeholder1.webp');
}


// --- ОБНОВЛЕННАЯ функция генерации HTML (теперь асинхронная) ---
async function generateProposalHTML(manager_name, manager_contact, customer_name, proposal_title, proposal_text, selectedProducts, total) {
    // Получаем base64 для логотипа
    const logoBase64 = await getLogoBase64();

    // Получаем base64 для изображений товаров
    const processedSelectedProducts = [];
    for (const item of selectedProducts) {
        const imageBase64 = await getFirstImageBase64(item.product.images);
        processedSelectedProducts.push({
            ...item,
            product: {
                ...item.product,
                imageBase64: imageBase64 // Добавляем base64 строку к продукту
            }
        });
    }

    // CSS-переменные, взятые из вашего сайта
    const cssVariables = `
        :root {
          --bg-primary: #0d0f17; /* Темный фон как на сайте */
          --accent-electric-blue: #00E5FF;
          --accent-deep-blue: #2B6CFF;
          --text-primary: #FFFFFF;
          --text-secondary: #AAB3C5;
          --card-bg: rgba(255, 255, 255, 0.1);
          --card-bg-hover: rgba(255, 255, 255, 0.2);
          --shadow: 0 6px 15px rgba(0, 229, 255, 0.4);
        }
    `;

    let tableRows = '';
    for (const item of processedSelectedProducts) { // Используем обработанный массив
        const itemPrice = parseFloat(item.product.price) || 0;
        const itemQuantity = parseInt(item.quantity) || 0;
        const totalItemPrice = itemPrice * itemQuantity;

        tableRows += `
            <tr>
                <td class="image-cell">
                    <img src="${item.product.imageBase64}" alt="${item.product.title}">
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
            /* Подключаем шрифт Inter */
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

            /* Стили для тела документа */
            body {
                font-family: 'Inter', sans-serif;
                background-color: var(--bg-primary); /* Темный фон */
                color: var(--text-secondary); /* Вторичный цвет текста */
                margin: 0;
                padding: 5mm; /* Минимальные отступы для PDF */
                position: relative; /* Для позиционирования фона */
                min-height: 297mm; /* Высота A4 */
                width: 210mm; /* Ширина A4 */
                box-sizing: border-box;
            }

           
            

            /* Пульсы */
            .bg-overlay {
              position: fixed; /* Используем fixed для равномерного охвата при PDF */
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              pointer-events: none;
              z-index: -2; /* Поверх сетки, позади контента */
              overflow: hidden;
            }

            .pulse-1,
            .pulse-2,
            .pulse-3,
            .pulse-4,
            .pulse-5,
            .pulse-6 {
              position: absolute;
              width: 24rem;
              height: 24rem;
              border-radius: 9999px;
              filter: blur(60px);
              opacity: 0.6;
              pointer-events: none;
              animation: pulse 3s ease-in-out infinite;
            }

            .pulse-1 { top: 0vh; left: 70vw; background: rgba(0, 4, 172, 0.9); }
            .pulse-2 { top: 60vh; right: 80vw; background: rgba(0, 4, 172, 0.7); }
            .pulse-3 { top: 160vh; right: 10vw; background: rgba(0, 4, 172, 0.7); }
            .pulse-4 { top: 230vh; right: 80vw; background: rgba(0, 4, 172, 0.7); }
            .pulse-5 { top: 300vh; right: 0vw; background: rgba(0, 4, 172, 0.7); }
            .pulse-6 { top: 350vh; right: 80vw; background: rgba(0, 4, 172, 0.7); }

            @keyframes pulse {
              0%, 100% { transform: scale(1); opacity: 0.6; }
              50% { transform: scale(1.05); opacity: 0.4; }
            }

            /* Стили для заголовка */
            .header {
                text-align: center;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 2px solid var(--accent-electric-blue); /* Акцентная граница */
                position: relative; /* Для z-index */
                z-index: 1; /* Поверх фона */
            }
            .logo {
                font-size: 28px;
                font-weight: 700;
                color: #ffffff;
                margin-bottom: 5px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
            }
            .logo-icon img {
                height: 36px;
                width: auto;
            }
            .title {
                font-size: 24px;
                font-weight: 700;
                color: var(--text-primary); /* Основной цвет текста */
                margin: 10px 0;
            }
            .manager-info {
                margin-bottom: 20px;
                font-size: 14px;
                color: var(--text-secondary);
               text-align: left !important;
            }
            .manager-info p {
                margin: 5px 0;
            }

            /* Стили для текста предложения */
            .proposal-text {
                margin-bottom: 20px;
                font-size: 15px;
                color: var(--text-secondary);
                position: relative; /* Для z-index */
                z-index: 1; /* Поверх фона */
            }

            /* Стили для таблицы и контейнера */
            .table-container {
                background:  rgba(11, 11, 38, 0.35);
                border-radius: 1rem; /* Круглые углы */
                margin-bottom: 20px;
                overflow-x: auto;
                position: relative; /* Для z-index */
                z-index: 1; /* Поверх фона */
            }
            .table {
                width: 100%;
                border-collapse: separate;
                border-spacing: 0;
                margin-bottom: 0;
            }
            .table th, .table td {
                padding: 15px;
                text-align: left;
                color: var(--text-primary); /* Основной цвет текста */
            }
            .table th {
                background-color: rgba(0, 229, 255, 0.2); /* Акцентный фон заголовков */
                font-weight: 600;
                border-radius: 0.5rem 0.5rem 0 0; /* Круглые верхние углы */
            }
            
            
            .image-cell {
                text-align: center;
                vertical-align: middle;
                width: 120px; /* Фиксированная ширина для изображений */
            }
            .image-cell img {
                width: 100px; /* Увеличенный размер изображения */
                height: 100px; /* Увеличенный размер изображения */
                object-fit: contain; /* Сохраняем пропорции и заполняем все пространство */
                border-radius: 0.25rem;
                border: none; /* Убираем рамку */
            }

            /* Стили для итога */
            .total {
                text-align: right;
                font-weight: 700;
                font-size: 18px;
                color: var(--accent-electric-blue); /* Акцентный цвет */
                margin-top: 10px;
                position: relative; /* Для z-index */
                z-index: 1; /* Поверх фона */
            }

            /* Стили для футера */
            .footer-note {
                margin-top: 20px;
                font-size: 12px;
                color: var(--text-secondary);
                text-align: center;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                padding-top: 10px;
                position: relative; /* Для z-index */
                z-index: 1; /* Поверх фона */
            }

            /* Убираем кнопку печати */
            .print-btn {
                display: none; /* Скрываем кнопку */
            }

        </style>
    </head>
    <body>

        <!-- Фоновая анимация (пульсы) -->
        <div class="bg-overlay" aria-hidden="true">
            <div class="pulse-1"></div>
            <div class="pulse-2"></div>
            <div class="pulse-3"></div>
            <div class="pulse-4"></div>
            <div class="pulse-5"></div>
            <div class="pulse-6"></div>
        </div>

        <div class="header">
            <div class="logo">
                <div class="logo-icon">
                    <img src="${logoBase64}" alt="BIZON Logo"> <!-- Используем base64 логотип -->
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
            ${proposal_text.replace(/\n/g, '<br>')}
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
            <p>Данное коммерческое предложение является официальным и действует в течение 7 дней с даты составления.</p>
            <p>© ${new Date().getFullYear()} BIZON — Все права защищены</p>
        </div>

        <!-- Убрана кнопка печати -->

    </body>
    </html>
    `;
}

// Экспортируем функцию (теперь она асинхронная)
module.exports = { generateProposalHTML };
// Или, если используется ES6 modules (и в package.json указан "type": "module"):
// export { generateProposalHTML };