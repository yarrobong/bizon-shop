// --- ФУНКЦИЯ ДЛЯ ОТЛОЖЕННОЙ ИНИЦИАЛИЗАЦИИ ЯНДЕКС.МЕТРИКИ ---
function loadYandexMetrika() {
    // Проверяем, не была ли уже загружена библиотека ym
    // ym может быть undefined (не инициализирована) или функцией (очередь или загружена)
    if (typeof window.ym === 'undefined') {
        // Стандартный код загрузки Яндекс.Метрики
        (function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            // Проверяем, не загружается ли уже скрипт
            for (var j = 0; j < document.scripts.length; j++) {
                if (document.scripts[j].src && document.scripts[j].src.indexOf('mc.yandex.ru/metrika') !== -1) {
                    return; // Скрипт уже загружается или загружен
                }
            }
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
        })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=104163309', 'ym');

        // Инициализация метрики с вашими параметрами (добавляется в очередь)
        window.ym(104163309, 'init', {
            ssr: true,
            webvisor: true,
            clickmap: true,
            ecommerce: "dataLayer",
            accurateTrackBounce: true,
            trackLinks: true
        });
    } else if (typeof window.ym === 'function' && typeof window.ym.a === 'undefined') {
        // Библиотека уже полностью загружена и инициализирована
        // Можно выполнить дополнительные действия, если нужно
    }
    // Если ym уже существует как очередь, ничего не делаем - библиотека загружается
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
            document.body.classList.toggle('menu-open');
        });

        // Закрытие меню при клике на ссылку
        document.querySelectorAll('.nav-list a').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                nav.classList.remove('active');
                document.body.classList.remove('menu-open');
            });
        });
    }


    // Год в подвале
    const yearElement = document.getElementById('year');
    if(yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }


});

// calltouch
(function(w,d,n,c){w.CalltouchDataObject=n;w[n]=function(){w[n]["callbacks"].push(arguments)};if(!w[n]["callbacks"]){w[n]["callbacks"]=[]}w[n]["loaded"]=false;if(typeof c!=="object"){c=[c]}w[n]["counters"]=c;for(var i=0;i<c.length;i+=1){p(c[i])}function p(cId){var a=d.getElementsByTagName("script")[0],s=d.createElement("script"),i=function(){a.parentNode.insertBefore(s,a)},m=typeof Array.prototype.find === 'function',n=m?"init-min.js":"init.js";s.async=true;s.src="https://mod.calltouch.ru/"+n+"?id="+cId;if(w.opera=="[object Opera]"){d.addEventListener("DOMContentLoaded",i,false)}else{i()}}})(window,document,"ct","mswgnlnh");

// Calltouch requests
Element.prototype.matches||(Element.prototype.matches=Element.prototype.matchesSelector||Element.prototype.webkitMatchesSelector||Element.prototype.mozMatchesSelector||Element.prototype.msMatchesSelector),Element.prototype.closest||(Element.prototype.closest=function(e){for(var t=this;t;){if(t.matches(e))return t;t=t.parentElement}return null});
var ct_get_val=function(form,selector){if(!!form.querySelector(selector)){return form.querySelector(selector).value;}else{return '';}}
document.addEventListener('click', function(e) {                                           
    var t_el = e.target;
    if (t_el.closest('form [type="submit"]')){ try {
        var f = t_el.closest('form'); 
        var fio = ct_get_val(f,'input[name="name"]');
        var phone = ct_get_val(f,'input[id="phone"]');
        var email = ct_get_val(f,'input[name="email"]');
        var comment = ct_get_val(f,'textarea[name="message"]');
        var sub = 'Заявка с ' + location.hostname;
        var ct_data = {            
            fio: fio,
            phoneNumber: phone,
            email: email,
            subject: sub,
            requestUrl: location.href,
            comment: comment,
            sessionId: window.call_value
        };
        var post_data = Object.keys(ct_data).reduce(function(a,k){if(!!ct_data[k]){a.push(k+'='+encodeURIComponent(ct_data[k]));}return a},[]).join('&');
        var site_id = '78900';
        var CT_URL = 'https://api.calltouch.ru/calls-service/RestAPI/requests/'+site_id+'/register/';
        var ct_valid = !!phone && !!fio;
        console.log(ct_data,ct_valid);
        if (ct_valid && !window.ct_snd_flag){
            window.ct_snd_flag = 1; setTimeout(function(){ window.ct_snd_flag = 0; }, 20000);
            var request = window.ActiveXObject?new ActiveXObject("Microsoft.XMLHTTP"):new XMLHttpRequest();
            request.open("POST", CT_URL, true); request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
            request.send(post_data);
        }
    } catch (e) { console.log(e); } }
});