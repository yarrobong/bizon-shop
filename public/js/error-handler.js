// Глобальный обработчик ошибок для подавления ошибок от внешних скриптов
(function() {
  // Создаем заглушку для объекта Ya (старое API Яндекс.Метрики)
  // Это предотвратит ошибки "Ya is not defined" от внешних виджетов
  if (typeof window.Ya === 'undefined') {
    window.Ya = {
      Metrika: {
        init: function() {},
        reachGoal: function() {},
        hit: function() {}
      },
      Counter: function() {
        return {
          reachGoal: function() {},
          hit: function() {}
        };
      }
    };
  }
  
  // Сохраняем оригинальные обработчики
  const originalError = console.error;
  const originalWarn = console.warn;
  
  // Фильтруем ошибки от внешних скриптов
  const errorFilters = [
    /Ya is not defined/i,
    /ReferenceError: Ya is not defined/i,
    /Init stat_api ym counter.*error/i,
    /Init stat_api ym counter \d+ error/i,
    /Init stat_api ym counter \d+ error: ReferenceError/i,
    /Send statistics error/i,
    /Cannot read properties of undefined.*reachGoal/i,
    /Failed to execute 'json' on 'Response': Unexpected end of JSON input/i,
    /SyntaxError: Failed to execute 'json'/i,
    /SyntaxError: Failed to execute 'json' on 'Response'/i,
    /index\.\w+\.js.*error/i,
    /index\.\w+\.js:.*error/i,
    /index\.\w+\.js:.*ReferenceError/i,
    /index\.\w+\.js:.*SyntaxError/i,
    /index\.\w+\.js:.*at async/i,
    /index\.\w+\.js:.*fetchActivities/i,
    /fetchActivities/i,
    /mM\.fetchActivities/i,
    /at async mM\.fetchActivities/i,
    /Understand this warning/i
  ];
  
  // Фильтруем предупреждения от внешних скриптов и браузера
  const warningFilters = [
    /preload.*not used/i,
    /was preloaded using link preload but not used/i,
    /yastatic\.net.*preload/i,
    /partner-code-bundles.*preload/i,
    /loader\.bundle\.js.*preload/i
  ];
  
  // Переопределяем console.error
  console.error = function(...args) {
    // Собираем все аргументы в строку для проверки
    const message = args.map(arg => {
      if (arg instanceof Error) {
        return arg.message + ' ' + (arg.stack || '');
      }
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    
    // Проверяем все варианты сообщений
    const shouldSuppress = errorFilters.some(filter => {
      try {
        return filter.test(message);
      } catch {
        return false;
      }
    });
    
    // Пропускаем только ошибки, которые не соответствуют фильтрам
    if (!shouldSuppress) {
      originalError.apply(console, args);
    }
  };
  
  // Переопределяем console.warn для некоторых предупреждений
  console.warn = function(...args) {
    const message = args.join(' ');
    const fullMessage = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    
    // Пропускаем только предупреждения, которые не соответствуют фильтрам
    if (!errorFilters.some(filter => filter.test(message) || filter.test(fullMessage)) && 
        !warningFilters.some(filter => filter.test(message) || filter.test(fullMessage))) {
      originalWarn.apply(console, args);
    }
  };
  
  // Также переопределяем console.log для предупреждений о preload (некоторые браузеры используют log)
  const originalLog = console.log;
  console.log = function(...args) {
    const message = args.join(' ');
    // Пропускаем только сообщения, которые не соответствуют фильтрам предупреждений
    if (!warningFilters.some(filter => filter.test(message))) {
      originalLog.apply(console, args);
    }
  };
  
  // Глобальный обработчик ошибок
  window.addEventListener('error', function(event) {
    const errorMessage = event.message || '';
    const errorSource = event.filename || '';
    const errorStack = event.error?.stack || '';
    const errorName = event.error?.name || '';
    const fullErrorText = [errorName, errorMessage, errorSource, errorStack].filter(Boolean).join(' ');
    
    // Подавляем ошибки от внешних скриптов Яндекса
    const shouldSuppress = 
      errorFilters.some(filter => {
        try {
          return filter.test(errorMessage) || 
                 filter.test(errorSource) || 
                 filter.test(errorStack) ||
                 filter.test(fullErrorText);
        } catch {
          return false;
        }
      }) ||
      errorSource.includes('yastatic.net') ||
      errorSource.includes('partner-code-bundles') ||
      (errorSource.includes('index.') && errorSource.includes('.js')) ||
      errorMessage.includes('Ya is not defined') ||
      errorMessage.includes('Init stat_api') ||
      (errorStack.includes('index.') && errorStack.includes('.js')) ||
      (errorStack.includes('fetchActivities') && errorMessage.includes('JSON'));
    
    if (shouldSuppress) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  }, true);
  
  // Дополнительный обработчик для перехвата ошибок из try-catch
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (type === 'error' && typeof listener === 'function') {
      const wrappedListener = function(event) {
        const errorMessage = event.message || '';
        const errorSource = event.filename || '';
        
        if (
          errorFilters.some(filter => filter.test(errorMessage) || filter.test(errorSource)) ||
          errorSource.includes('yastatic.net') ||
          errorSource.includes('partner-code-bundles') ||
          (errorSource.includes('index.') && errorSource.includes('.js'))
        ) {
          event.preventDefault();
          event.stopPropagation();
          return false;
        }
        
        return listener.call(this, event);
      };
      return originalAddEventListener.call(this, type, wrappedListener, options);
    }
    return originalAddEventListener.call(this, type, listener, options);
  };
  
  // Обработчик для необработанных промисов (для ошибок JSON парсинга)
  window.addEventListener('unhandledrejection', function(event) {
    const reason = event.reason;
    const errorMessage = reason?.message || String(reason) || '';
    const errorStack = reason?.stack || '';
    const errorString = String(reason);
    const errorName = reason?.name || '';
    const fullErrorText = [errorName, errorMessage, errorString, errorStack].filter(Boolean).join(' ');
    
    // Подавляем ошибки парсинга JSON от внешних скриптов
    const shouldSuppress = 
      errorFilters.some(filter => {
        try {
          return filter.test(errorMessage) || 
                 filter.test(errorString) || 
                 filter.test(errorStack) ||
                 filter.test(fullErrorText);
        } catch {
          return false;
        }
      }) ||
      errorMessage.includes('Unexpected end of JSON input') ||
      errorMessage.includes('Failed to execute \'json\'') ||
      errorMessage.includes('SyntaxError: Failed to execute') ||
      errorString.includes('Unexpected end of JSON input') ||
      errorString.includes('Failed to execute \'json\'') ||
      (errorStack.includes('index.') && errorStack.includes('.js') && 
       (errorMessage.includes('JSON') || errorString.includes('JSON'))) ||
      (errorStack.includes('fetchActivities') && 
       (errorMessage.includes('JSON') || errorString.includes('JSON'))) ||
      (errorStack.includes('mM.fetchActivities') && 
       (errorMessage.includes('JSON') || errorString.includes('JSON')));
    
    if (shouldSuppress) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  });
})();
