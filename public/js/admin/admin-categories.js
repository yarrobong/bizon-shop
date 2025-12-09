// admin-categories.js

async function loadCategoriesTab() {
    await loadCategories();
}

// Делаем функцию доступной глобально
window.loadCategoriesTab = loadCategoriesTab;

async function loadCategories() {
    try {
        console.log('Загрузка категорий...');
        const response = await fetchWithAuth('/api/categories');
        
        if (response.ok) {
            const categories = await response.json();
            
            renderCategories(categories);
        } else {
            console.warn(`API категорий вернул ошибку ${response.status}`);
            renderCategories([]);
        }
    } catch (error) {
        console.error('Сетевая ошибка при загрузке категорий:', error);
        renderCategories([]);
    }
}

function renderCategories(categories) {
    const container = document.getElementById('categories-list');
    if (!container) {
        console.error('Контейнер #categories-list не найден в DOM');
        return;
    }

    container.innerHTML = '';

    if (!categories || !Array.isArray(categories) || categories.length === 0) {
        container.innerHTML = '<div class="empty">Нет категорий</div>';
        console.log('Нет категорий для отображения');
        return;
    }

    

    categories.forEach(category => {
        if (category.hasOwnProperty('id') && category.hasOwnProperty('name')) {
            const item = document.createElement('div');
            item.className = 'category-item';
            item.innerHTML = `
                <span>${adminPanel.escapeHtml(category.name)}</span>
                <button onclick="deleteCategory(${category.id})" class="btn-danger">Удалить</button>
            `;
            container.appendChild(item);
        } else {
            console.warn('Некорректная структура категории:', category);
        }
    });
}

// --- Модальное окно категории ---

function openCategoryModal() {
    const modal = document.getElementById('category-modal');
    const form = document.getElementById('category-form');

    if (!modal || !form) {
        console.error('Элементы модального окна категории не найдены');
        return;
    }

    form.reset();
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
}

document.getElementById('category-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveCategory();
});

document.getElementById('add-category-btn')?.addEventListener('click', () => {
    openCategoryModal();
});

document.querySelector('#category-modal .close-category-modal')?.addEventListener('click', () => {
    adminPanel.closeModal('category-modal');
});
document.getElementById('cancel-category-btn')?.addEventListener('click', () => {
    adminPanel.closeModal('category-modal');
});

// --- Сохранение/Удаление категории ---

async function saveCategory() {
    try {
        const form = document.getElementById('category-form');
        if (!form) return;

        const categoryName = document.getElementById('category-name').value.trim();

        if (!categoryName) {
            alert('Пожалуйста, укажите название категории');
            return;
        }

        const response = await fetchWithAuth('/api/categories', {
            method: 'POST',
            body: JSON.stringify({ name: categoryName })
        });

        if (response.ok) {
            adminPanel.closeModal('category-modal');
            await loadCategories(); // Перезагружаем категории
            // Также обновляем селект в форме товара
            if (typeof loadCategoriesForSelect === 'function') {
                 await loadCategoriesForSelect();
            }
            adminPanel.showMessage('Категория добавлена успешно!', 'success');
        } else {
            const errorText = await response.text();
            throw new Error(`Ошибка добавления категории: ${response.status} - ${errorText}`);
        }
    } catch (error) {
        console.error('Ошибка добавления категории:', error);
        adminPanel.showMessage(`Ошибка добавления категории: ${error.message}`, 'error');
    }
}

async function deleteCategory(categoryId) {
    if (!confirm('Вы уверены, что хотите удалить эту категорию? Все товары в этой категории останутся, но сама категория будет удалена.')) {
        return;
    }

    try {
        const response = await fetchWithAuth(`/api/categories/${categoryId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            await loadCategories();
            // Также обновляем селект в форме товара
            if (typeof loadCategoriesForSelect === 'function') {
                 await loadCategoriesForSelect();
            }
            adminPanel.showMessage('Категория удалена успешно!', 'success');
        } else {
            const errorText = await response.text();
            throw new Error(`Ошибка удаления категории: ${response.status} - ${errorText}`);
        }
    } catch (error) {
        console.error('Ошибка удаления категории:', error);
        adminPanel.showMessage('Ошибка удаления категории: ' + error.message, 'error');
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('categories-tab')?.classList.contains('active')) {
        loadCategoriesTab();
    }
});