// admin-attractions.js

let attractionImages = [];

async function loadAttractionsTab() {
    await loadAttractions();
    await loadAttractionCategoryOptions();
}

async function loadAttractions() {
    try {
        console.log('Загрузка аттракционов...');
        const response = await fetch('/api/attractions');
        console.log('Ответ от /api/attractions:', response.status);
        if (response.ok) {
            const attractions = await response.json();
            console.log('Аттракционы загружены:', attractions);
            renderAttractions(attractions);
        } else {
            console.error('Ошибка загрузки аттракционов:', response.status);
            renderAttractions([]);
        }
    } catch (error) {
        console.error('Ошибка загрузки аттракционов:', error);
        renderAttractions([]);
    }
}

function renderAttractions(attractions) {
    const container = document.getElementById('admin-attractions-grid');
    if (!container) {
        console.error('Контейнер для аттракционов не найден');
        return;
    }

    container.innerHTML = '';

    if (!attractions || attractions.length === 0) {
        container.innerHTML = '<div class="empty">Нет аттракционов для отображения</div>';
        return;
    }

    attractions.forEach(attraction => {
        const card = document.createElement('div');
        card.className = 'product-card';
        const imageUrl = attraction.image || '/assets/icons/placeholder1.webp';

        card.innerHTML = `
            <img src="${imageUrl}" alt="${adminPanel.escapeHtml(attraction.title)}" onerror="this.src='/assets/icons/placeholder1.webp'">
            <h3>${adminPanel.escapeHtml(attraction.title)}</h3>
            <p>Цена: ${adminPanel.formatPrice(attraction.price)}</p>
            <p>Категория: ${adminPanel.escapeHtml(attraction.category || 'Не указана')}</p>
            <div class="product-actions">
                <button onclick="openAttractionModal(${attraction.id})" class="btn-primary">Редактировать</button>
                <button onclick="deleteAttraction(${attraction.id})" class="btn-danger">Удалить</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function openAttractionModal(attractionId = null) {
    const modal = document.getElementById('attraction-modal');
    const title = document.getElementById('attraction-modal-title');
    const form = document.getElementById('attraction-form');
    const idInput = document.getElementById('attraction-id');

    if (attractionId) {
        loadAttractionForEdit(attractionId);
    } else {
        title.textContent = 'Добавить аттракцион';
        form.reset();
        idInput.value = '';
        clearAttractionImageFields();
        modal.style.display = 'block';
        document.body.classList.add('modal-open');
    }
}

async function loadAttractionForEdit(attractionId) {
    try {
        const response = await fetch(`/api/attractions/${attractionId}`);
        if (response.ok) {
            const attraction = await response.json();
            const title = document.getElementById('attraction-modal-title');
            title.textContent = 'Редактировать аттракцион';
            document.getElementById('attraction-id').value = attraction.id;
            document.getElementById('attraction-title').value = attraction.title || '';
            document.getElementById('attraction-description').value = attraction.description || '';
            document.getElementById('attraction-price').value = attraction.price || '';
            document.getElementById('attraction-category').value = attraction.category || '';

            const specs = attraction.specs || {};
            document.getElementById('attraction-specs-places').value = specs.places || '';
            document.getElementById('attraction-specs-power').value = specs.power || '';
            document.getElementById('attraction-specs-games').value = specs.games || '';
            document.getElementById('attraction-specs-area').value = specs.area || '';
            document.getElementById('attraction-specs-dimensions').value = specs.dimensions || '';

            if (attraction.image) {
                loadAttractionImageToForm({ url: attraction.image, alt: attraction.title });
            } else {
                clearAttractionImageFields();
            }

            const modal = document.getElementById('attraction-modal');
            modal.style.display = 'block';
            document.body.classList.add('modal-open');
        } else {
            throw new Error(`Ошибка загрузки аттракциона: ${response.status}`);
        }
    } catch (error) {
        console.error('Ошибка загрузки аттракциона для редактирования:', error);
        adminPanel.showMessage(`Ошибка загрузки аттракциона: ${error.message}`, 'error');
    }
}

document.getElementById('attraction-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveAttraction();
});

document.getElementById('add-attraction-btn')?.addEventListener('click', () => {
    openAttractionModal();
});

document.querySelector('#attraction-modal .close-attraction-modal')?.addEventListener('click', () => {
    adminPanel.closeModal('attraction-modal');
});
document.getElementById('cancel-attraction-btn')?.addEventListener('click', () => {
    adminPanel.closeModal('attraction-modal');
});

// --- Работа с изображениями аттракционов ---

function setupAttractionImageEventListeners() {
    const addImageBtn = document.getElementById('add-image-btn'); // Предполагаем, что ID такой же
    if (addImageBtn) {
        addImageBtn.addEventListener('click', () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.multiple = false;
            fileInput.style.display = 'none';
            fileInput.addEventListener('change', async (e) => {
                const files = e.target.files;
                if (files.length > 0) await handleAttractionImageUpload(files[0]);
            });
            document.body.appendChild(fileInput);
            fileInput.click();
            document.body.removeChild(fileInput);
        });
    }

    const dropZone = document.getElementById('images-drop-zone'); // Предполагаем, что ID такой же
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });
        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                await handleAttractionImageUpload(files[0]);
            } else {
                adminPanel.showMessage('Пожалуйста, перетащите изображение', 'error');
            }
        });
    }
}

async function handleAttractionImageUpload(file) {
    if (!file.type.startsWith('image/')) {
        adminPanel.showMessage('Пожалуйста, выберите файл изображения', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Ошибка загрузки: ${response.status}`);
        }

        const data = await response.json();
        loadAttractionImageToForm({ url: data.url, alt: file.name });
    } catch (error) {
        console.error('Ошибка при загрузке файла:', error);
        adminPanel.showMessage(`Ошибка загрузки ${file.name}: ${error.message}`, 'error');
    }
}

function loadAttractionImageToForm(imageData) {
    clearAttractionImageFields();
    addAttractionImageField(imageData);
}

function addAttractionImageField(imageData = null) {
    const container = document.getElementById('images-container'); // Предполагаем, что ID такой же
    const dropHint = document.getElementById('drop-hint'); // Предполагаем, что ID такой же

    if (!container) return;
    if (dropHint) dropHint.classList.remove('show');

    // Очищаем контейнер перед добавлением нового изображения (только одно для аттракциона)
    container.innerHTML = '';

    const imageId = Date.now() + Math.floor(Math.random() * 10000);
    const imageItem = document.createElement('div');
    imageItem.className = 'image-item';
    imageItem.dataset.id = imageId;

    const imageUrl = imageData?.url || '';
    const imageAlt = imageData?.alt || '';

    imageItem.innerHTML = `
        ${imageUrl ?
            `<img src="${imageUrl}" alt="${imageAlt}" onerror="this.src='/assets/icons/placeholder1.webp'">` :
            `<div class="image-placeholder">Изображение не загружено</div>`
        }
        <input type="hidden" class="image-input" value="${imageUrl}">
        <button type="button" class="delete-image-btn" data-id="${imageId}" title="Удалить изображение">&times;</button>
    `;

    container.appendChild(imageItem);
    attractionImages = [{ id: imageId, url: imageUrl, alt: imageAlt }]; // Только одно изображение

    imageItem.addEventListener('mouseenter', () => {
        const deleteBtn = imageItem.querySelector('.delete-image-btn');
        if (deleteBtn) deleteBtn.style.opacity = '1';
    });

    imageItem.addEventListener('mouseleave', () => {
        const deleteBtn = imageItem.querySelector('.delete-image-btn');
        if (deleteBtn) deleteBtn.style.opacity = '0';
    });

    const deleteBtn = imageItem.querySelector('.delete-image-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            removeAttractionImage(imageId);
        });
    }
}

function removeAttractionImage(imageId) {
    const imageItem = document.querySelector(`.image-item[data-id="${imageId}"]`);
    if (imageItem) imageItem.remove();
    attractionImages = [];
    const dropHint = document.getElementById('drop-hint'); // Предполагаем, что ID такой же
    if (dropHint) dropHint.classList.add('show');
}

function clearAttractionImageFields() {
    const container = document.getElementById('images-container'); // Предполагаем, что ID такой же
    const dropHint = document.getElementById('drop-hint'); // Предполагаем, что ID такой же
    if (container) container.innerHTML = '';
    if (dropHint) dropHint.classList.add('show');
    attractionImages = [];
}

function getAttractionImageFromForm() {
    return attractionImages.length > 0 ? attractionImages[0].url : null;
}

// --- Сохранение/Удаление аттракциона ---

async function saveAttraction() {
    const form = document.getElementById('attraction-form');
    const id = document.getElementById('attraction-id').value;
    const isEdit = !!id;

    const formData = new FormData(form);
    const attractionData = {
        title: formData.get('attraction-title'),
        description: formData.get('attraction-description'),
        price: parseFloat(formData.get('attraction-price')),
        category: formData.get('attraction-category'),
        specs: {
            places: formData.get('attraction-specs-places'),
            power: formData.get('attraction-specs-power'),
            games: formData.get('attraction-specs-games'),
            area: formData.get('attraction-specs-area'),
            dimensions: formData.get('attraction-specs-dimensions')
        }
    };

    const imageUrl = getAttractionImageFromForm();
    if (imageUrl) {
        attractionData.image = imageUrl;
    }

    try {
        let response;
        if (isEdit) {
            response = await fetch(`/api/attractions/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(attractionData)
            });
        } else {
            response = await fetch('/api/attractions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(attractionData)
            });
        }

        if (response.ok) {
            const result = await response.json();
            console.log(`${isEdit ? 'Аттракцион обновлен' : 'Аттракцион создан'}:`, result);
            adminPanel.showMessage(`${isEdit ? 'Аттракцион обновлен' : 'Аттракцион создан'} успешно!`, 'success');
            adminPanel.closeModal('attraction-modal');
            await loadAttractions();
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Ошибка ${isEdit ? 'обновления' : 'создания'}: ${response.status}`);
        }
    } catch (error) {
        console.error(`Ошибка ${isEdit ? 'обновления' : 'создания'} аттракциона:`, error);
        adminPanel.showMessage(`Ошибка: ${error.message}`, 'error');
    }
}

async function deleteAttraction(id) {
    if (!confirm('Вы уверены, что хотите удалить этот аттракцион?')) return;
    try {
        const response = await fetch(`/api/attractions/${id}`, { method: 'DELETE' });
        if (response.ok) {
            console.log('Аттракцион удален');
            adminPanel.showMessage('Аттракцион удален успешно!', 'success');
            await loadAttractions();
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Ошибка удаления: ${response.status}`);
        }
    } catch (error) {
        console.error('Ошибка удаления аттракциона:', error);
        adminPanel.showMessage(`Ошибка удаления: ${error.message}`, 'error');
    }
}

// --- Категории аттракционов ---

async function loadAttractionCategoryOptions() {
    try {
        const response = await fetch('/api/attractions/categories');
        if (response.ok) {
            const categories = await response.json();
            const datalist = document.getElementById('attraction-categories');
            if (datalist) {
                datalist.innerHTML = '';
                categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category;
                    datalist.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки категорий аттракционов для datalist:', error);
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    setupAttractionImageEventListeners();
    if (document.getElementById('attractions-tab')?.classList.contains('active')) {
        loadAttractionsTab();
    }
});