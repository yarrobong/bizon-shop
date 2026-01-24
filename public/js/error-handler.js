// Глобальный обработчик ошибок для подавления ошибок от внешних скриптов
(function() {
  // Сохраняем оригинальные обработчики
  const originalError = console.error;
  const originalWarn = console.warn;
  
  // Фильтруем ошибки от внешних скриптов
  const errorFilters = [
    /Ya is not defined/i,
    /ReferenceError: Ya is not defined/i,
    /Init stat_api ym counter.*error/i,
    /Send statistics error/i,
    /Cannot read properties of undefined.*reachGoal/i,
    /Failed to execute 'json' on 'Response': Unexpected end of JSON input/i,
    /index\.\w+\.js.*error/i,
    /SyntaxError: Failed to execute 'json'/i
  ];
  
  // Переопределяем console.error
  console.error = function(...args) {
    const message = args.join(' ');
    // Пропускаем только ошибки, которые не соответствуют фильтрам
    if (!errorFilters.some(filter => filter.test(message))) {
      originalError.apply(console, args);
    }
  };
  
  // Переопределяем console.warn для некоторых предупреждений
  console.warn = function(...args) {
    const message = args.join(' ');
    // Пропускаем только предупреждения, которые не соответствуют фильтрам
    if (!errorFilters.some(filter => filter.test(message))) {
      originalWarn.apply(console, args);
    }
  };
  
  // Глобальный обработчик ошибок
  window.addEventListener('error', function(event) {
    const errorMessage = event.message || '';
    const errorSource = event.filename || '';
    
    // Подавляем ошибки от внешних скриптов Яндекса
    if (
      errorFilters.some(filter => filter.test(errorMessage)) ||
      errorSource.includes('yastatic.net') ||
      (errorSource.includes('index.') && errorSource.includes('.js'))
    ) {
      event.preventDefault();
      return false;
    }
  }, true);
  
  // Обработчик для необработанных промисов (для ошибок JSON парсинга)
  window.addEventListener('unhandledrejection', function(event) {
    const reason = event.reason;
    const errorMessage = reason?.message || String(reason) || '';
    
    // Подавляем ошибки парсинга JSON от внешних скриптов
    if (
      errorMessage.includes('Unexpected end of JSON input') ||
      errorMessage.includes('Failed to execute \'json\'') ||
      errorMessage.includes('SyntaxError: Failed to execute')
    ) {
      event.preventDefault();
      return false;
    }
  });
})();
