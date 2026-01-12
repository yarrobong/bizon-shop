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

// --- ФУНКЦИЯ ДЛЯ ОСТАНОВКИ ЯНДЕКС.МЕТРИКИ И УДАЛЕНИЯ КУКИ ---
function stopYandexMetrika() {
    // Останавливаем метрику, если она была инициализирована
    if (typeof window.ym === 'function') {
        try {
            window.ym(104163309, 'destroy');
        } catch(e) {
            console.log('Метрика еще не инициализирована');
        }
    }
    
    // Удаляем куки Яндекс.Метрики
    const metrikaCookies = [
        'ym_d', 'ym_uid', 'device_id', 'fuid01', 'i', 'my', 'yabs-frequency', 
        'yandex_gid', 'yandexuid', 'yp', 'ys', '_ym_hit', '_ym_ht', '_ym_sln', 
        '_ym_ssl', '_ym_timer', 'yabs-sid', '_ym_fa', '_ym_isad', '_ym_visorc'
    ];
    
    // Удаляем куки для текущего домена
    metrikaCookies.forEach(cookieName => {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.yandex.ru;`;
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.mc.yandex.ru;`;
    });
    
    // Удаляем скрипт метрики из DOM
    const scripts = document.querySelectorAll('script[src*="mc.yandex.ru/metrika"]');
    scripts.forEach(script => script.remove());
    
    // Очищаем объект ym
    if (window.ym) {
        delete window.ym;
    }
}

// --- ФУНКЦИЯ ДЛЯ УДАЛЕНИЯ ВСЕХ КУКИ CALLTOUCH (должна быть доступна глобально) ---
function deleteCalltouchCookies() {
    // Полный список куки Calltouch (включая все варианты)
    const calltouchCookies = [
        '_ct', '_ct_client_global_id', '_ct_ids', '_ct_session_id', '_ct_site_id',
        'ct_calltouch_id', 'ct_calltouch_uid', 'ct_calltouch_session', 
        'ct_calltouch_visit', 'ct_calltouch_referrer', 'ct_calltouch_utm',
        'ct', 'ct_client_global_id', 'ct_ids', 'ct_session_id', 'ct_site_id',
        'call_s', 'cted'
    ];
    
    // Удаляем куки для всех возможных доменов
    calltouchCookies.forEach(cookieName => {
        // Текущий домен
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
        // Домены Calltouch
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.calltouch.ru;`;
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.mod.calltouch.ru;`;
        // Без домена (для всех поддоменов)
        const hostnameParts = window.location.hostname.split('.');
        if (hostnameParts.length > 1) {
            const rootDomain = '.' + hostnameParts.slice(-2).join('.');
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${rootDomain};`;
        }
    });
}

// --- ФУНКЦИЯ ДЛЯ ЗАГРУЗКИ CALLTOUCH ---
function loadCalltouch() {
    // Проверяем, не загружен ли уже Calltouch и не был ли он остановлен
    if (window.CalltouchDataObject || window.ct || window.ct_disabled) {
        return; // Calltouch уже загружен или был остановлен
    }
    
    // Сбрасываем флаг остановки, если он был установлен
    window.ct_disabled = false;
    
    // Загружаем Calltouch
    (function(w,d,n,c){
        w.CalltouchDataObject=n;
        w[n]=function(){w[n]["callbacks"].push(arguments)};
        if(!w[n]["callbacks"]){w[n]["callbacks"]=[]}
        w[n]["loaded"]=false;
        if(typeof c!=="object"){c=[c]}
        w[n]["counters"]=c;
        for(var i=0;i<c.length;i+=1){p(c[i])}
        function p(cId){
            var a=d.getElementsByTagName("script")[0],s=d.createElement("script"),i=function(){a.parentNode.insertBefore(s,a)},m=typeof Array.prototype.find === 'function',n=m?"init-min.js":"init.js";
            s.async=true;
            s.src="https://mod.calltouch.ru/"+n+"?id="+cId;
            if(w.opera=="[object Opera]"){d.addEventListener("DOMContentLoaded",i,false)}else{i()}
        }
    })(window,document,"ct","mswgnlnh");
    
    // Инициализируем обработчик форм для Calltouch
    if (!window.ct_form_handler_initialized) {
        window.ct_form_handler_initialized = true;
        
        // Polyfills для matches и closest
        Element.prototype.matches||(Element.prototype.matches=Element.prototype.matchesSelector||Element.prototype.webkitMatchesSelector||Element.prototype.mozMatchesSelector||Element.prototype.msMatchesSelector);
        Element.prototype.closest||(Element.prototype.closest=function(e){for(var t=this;t;){if(t.matches(e))return t;t=t.parentElement}return null});
        
        var ct_get_val=function(form,selector){if(!!form.querySelector(selector)){return form.querySelector(selector).value;}else{return '';}}
        
        document.addEventListener('click', function(e) {
            // Проверяем, что Calltouch загружен и не был остановлен
            if (window.ct_disabled || (!window.CalltouchDataObject && !window.ct)) {
                return; // Calltouch не загружен или был остановлен, не отправляем запросы
            }
                                           
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
    }
}

// --- ФУНКЦИЯ ДЛЯ ОСТАНОВКИ CALLTOUCH И УДАЛЕНИЯ КУКИ ---
function stopCalltouch() {
    // Устанавливаем флаг, что Calltouch остановлен
    window.ct_disabled = true;
    
    // Удаляем скрипты Calltouch из DOM
    const scripts = document.querySelectorAll('script[src*="mod.calltouch.ru"], script[src*="calltouch"]');
    scripts.forEach(script => script.remove());
    
    // Удаляем все куки Calltouch
    deleteCalltouchCookies();
    
    // Очищаем объекты Calltouch
    if (window.CalltouchDataObject) {
        delete window.CalltouchDataObject;
    }
    if (window.ct) {
        delete window.ct;
    }
    if (window.call_value) {
        delete window.call_value;
    }
    
    // Удаляем обработчик форм
    window.ct_form_handler_initialized = false;
}

// Загружаем сервисы сразу при заходе на сайт (выполняется сразу, до DOMContentLoaded)
(function() {
    // Проверяем согласие сразу при загрузке скрипта
    const consentCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('cookie_consent='));
    
    let consentValue = null;
    if (consentCookie) {
        consentValue = consentCookie.split('=')[1];
    }
    
    // Загружаем сервисы сразу, только если не было отказа ранее
    if (consentValue !== 'declined') {
        // Загружаем Яндекс.Метрику и Calltouch сразу при входе
        loadYandexMetrika();
        loadCalltouch();
    } else {
        // Если был отказ, блокируем загрузку
        window.ct_disabled = true;
        // Удаляем куки сразу при загрузке
        if (typeof deleteCalltouchCookies === 'function') {
            deleteCalltouchCookies();
        }
    }
})();

document.addEventListener('DOMContentLoaded', function() {
    // --- КОД ДЛЯ COOKIE BANNER (один раз за сессию) ---
    const consentBanner = document.getElementById('cookieConsent');
    const acceptBtn = document.getElementById('acceptCookies');
    const declineBtn = document.getElementById('declineCookies');

    // Ключ для sessionStorage
    const SESSION_STORAGE_KEY = 'cookie_banner_seen';

    // Проверяем, было ли ранее дано согласие
    const consentCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('cookie_consent='));
    
    let consentValue = null;
    if (consentCookie) {
        consentValue = consentCookie.split('=')[1];
    }
    
    // Если был отказ ранее, удаляем все куки и не загружаем сервисы
    if (consentValue === 'declined') {
        // Останавливаем сервисы, если они были загружены
        stopYandexMetrika();
        stopCalltouch();
        // Удаляем все куки
        deleteCalltouchCookies();
        // Удаляем куки Яндекс.Метрики
        const metrikaCookies = [
            'ym_d', 'ym_uid', 'device_id', 'fuid01', 'i', 'my', 'yabs-frequency', 
            'yandex_gid', 'yandexuid', 'yp', 'ys', '_ym_hit', '_ym_ht', '_ym_sln', 
            '_ym_ssl', '_ym_timer', 'yabs-sid', '_ym_fa', '_ym_isad', '_ym_visorc'
        ];
        metrikaCookies.forEach(cookieName => {
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.yandex.ru;`;
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.mc.yandex.ru;`;
        });
        // Удаляем куки Calltouch
        const calltouchCookies = ['call_s', 'cted'];
        calltouchCookies.forEach(cookieName => {
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
        });
    } else {
        // Если согласия нет или было дано - сервисы уже загружены выше
        // Дополнительно загружаем, если они еще не загружены
        loadYandexMetrika();
        loadCalltouch();
    }

    // Проверяем, был ли баннер уже показан в этой сессии
    if (sessionStorage.getItem(SESSION_STORAGE_KEY) || consentValue) {
        // Баннер уже видели в этой сессии или пользователь уже сделал выбор ранее, не показываем
    } else {
        // Если баннер ещё не показывался в этой сессии и пользователь не делал выбор, показываем его
        setTimeout(() => {
            if (consentBanner) { // Проверяем, существует ли элемент
                consentBanner.classList.add('visible');
            }
        }, 1000); // Показываем баннер через 1 секунду после загрузки
    }

    // Обработчик кнопки "Ок"
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
            // Сервисы уже загружены при входе, просто подтверждаем согласие
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
            // Останавливаем оба сервиса и удаляем куки, если пользователь отказался
            stopYandexMetrika();
            stopCalltouch();
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