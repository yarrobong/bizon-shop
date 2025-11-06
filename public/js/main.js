// --- ФУНКЦИЯ ДЛЯ ОТЛОЖЕННОЙ ИНИЦИАЛИЗАЦИИ ЯНДЕКС.МЕТРИКИ ---
function loadYandexMetrika() {
    // Проверяем, не была ли уже загружена библиотека ym
    if (typeof ym === 'undefined') {
        (function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            // Проверяем, не загружается ли уже скрипт
            for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
        })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=104163309', 'ym');

        // Инициализация метрики с вашими параметрами
        ym(104163309, 'init', {
            ssr: true,
            webvisor: true,
            clickmap: true,
            ecommerce: "dataLayer",
            accurateTrackBounce: true,
            trackLinks: true
        });
    } else {
        // Если библиотека уже загружена, можно выполнить дополнительные действия
        // например, ym(104163309, 'hit', window.location.href); для отслеживания переходов
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // --- КОД ДЛЯ COOKIE BANNER (один раз за сессию) ---
    const consentBanner = document.getElementById('cookieConsent');
    const acceptBtn = document.getElementById('acceptCookies');
    const declineBtn = document.getElementById('declineCookies');

    // Ключ для sessionStorage
    const SESSION_STORAGE_KEY = 'cookie_banner_seen';

    // Проверяем, был ли баннер уже показан в этой сессии
    if (sessionStorage.getItem(SESSION_STORAGE_KEY)) {
        // Баннер уже видели в этой сессии, не показываем
        // Проверим, было ли дано согласие ранее (в прошлых сессиях)
        const consentCookie = document.cookie
            .split('; ')
            .find(row => row.startsWith('cookie_consent='));
        
        if (consentCookie) {
            const consentValue = consentCookie.split('=')[1];
            if (consentValue === 'accepted') {
                // Только если согласие было "accepted", запускаем метрику
                loadYandexMetrika();
            }
        }
        // Если согласие не было дано, но баннер уже видели в сессии, метрика не запускается
        // и дальнейшая инициализация баннера не требуется.
    } else {
        // Если баннер ещё не показывался в этой сессии, показываем его
        setTimeout(() => {
            if (consentBanner) { // Проверяем, существует ли элемент
                consentBanner.classList.add('visible');
            }
        }, 1000); // Показываем баннер через 1 секунду после загрузки
    }

    // Обработчик кнопки "Принимаю"
    if (acceptBtn) {
        acceptBtn.addEventListener('click', () => {
            // Устанавливаем долгосрочный cookie согласия (например, на 1 год)
            const d = new Date();
            d.setTime(d.getTime() + (365 * 24 * 60 * 60 * 1000));
            const expires = "expires=" + d.toUTCString();
            document.cookie = `cookie_consent=accepted;${expires};path=/;SameSite=Lax`;

            // Отмечаем в сессии, что баннер был показан
            sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');

            if (consentBanner) {
                consentBanner.classList.remove('visible');
            }
            loadYandexMetrika(); // Запускаем метрику только после согласия
        });
    }

    // Обработчик кнопки "Отклонить"
    if (declineBtn) {
        declineBtn.addEventListener('click', () => {
            // Устанавливаем долгосрочный cookie отказа (например, на 1 год)
            const d = new Date();
            d.setTime(d.getTime() + (365 * 24 * 60 * 60 * 1000));
            const expires = "expires=" + d.toUTCString();
            document.cookie = `cookie_consent=declined;${expires};path=/;SameSite=Lax`;

            // Отмечаем в сессии, что баннер был показан
            sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');

            if (consentBanner) {
                consentBanner.classList.remove('visible');
            }
            // Не загружаем метрику, если пользователь отказался
        });
    }
    // --- КОНЕЦ КОДА ДЛЯ COOKIE BANNER ---


    // --- ВАШ СУЩЕСТВУЮЩИЙ КОД ---


    // Инициализируем начальное состояние
    window.currentCategory = 'все'; // Устанавливаем начальную категорию

    // Определяем текущую страницу и устанавливаем активный пункт меню
    const url = window.location.href;
    let pageKey = null; // <-- Теперь по умолчанию null

    // Проверяем конкретные страницы
    if (url.includes('/catalog')) pageKey = 'catalog';
    else if (url.includes('/attractions')) pageKey = 'attractions';
    else if (url.includes('/contact')) pageKey = 'contact';

    // Проверяем, находимся ли мы на главной странице
    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        // Если URL указывает на главную, устанавливаем pageKey в 'index', независимо от других условий
        pageKey = 'index';
    }

    // Удаляем активный класс со всех ссылок
    document.querySelectorAll('.nav-list a').forEach(link => {
        link.classList.remove('active');
    });

    // Добавляем активный класс нужной ссылке, ТОЛЬКО ЕСЛИ pageKey - одна из известных страниц меню ИЛИ это главная
    const activeLink = document.querySelector(`.nav-list a[data-page="${pageKey}"]`);
    if (activeLink && pageKey !== null) { // <-- Проверяем, что pageKey не null
        activeLink.classList.add('active');
    }


    // Аккордеон для FAQ
    document.querySelectorAll('.accordion-header').forEach(button => {
        button.addEventListener('click', () => {
            const item = button.parentElement;
            const panel = item.querySelector('.accordion-panel');
            const icon = button.querySelector('.accordion-icon');

            // Закрываем все другие (если нужно только один открыт)
            document.querySelectorAll('.accordion-item').forEach(i => {
                if (i !== item) {
                    i.querySelector('.accordion-panel').classList.remove('open');
                    i.querySelector('.accordion-header').classList.remove('active');
                    i.querySelector('.accordion-icon').textContent = '+';
                }
            });

            // Переключаем текущий
            panel.classList.toggle('open');
            button.classList.toggle('active');
            icon.textContent = panel.classList.contains('open') ? '−' : '+';
        });
    });



    // Мобильное меню
    const hamburger = document.getElementById('hamburger');
    const nav = document.getElementById('mainNav');

    if (hamburger && nav) { // Проверка на существование элементов
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            nav.classList.toggle('active');
        });

        // Закрытие меню при клике на ссылку
        document.querySelectorAll('.nav-list a').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                nav.classList.remove('active');
            });
        });
    }


    // Год в подвале
    const yearElement = document.getElementById('year');
    if(yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }


});