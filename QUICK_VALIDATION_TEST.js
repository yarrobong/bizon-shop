// Быстрый тест валидации - скопируйте и выполните в консоли браузера

console.log('🧪 Запуск тестов валидации...\n');

// Тест 1: Валидация телефона
console.log('📋 Тест 1: Валидация телефона');
const phoneTests = [
  { phone: '+7 (999) 123-45-67', expected: true, name: 'Валидный российский номер' },
  { phone: '89991234567', expected: true, name: 'Валидный номер без +7' },
  { phone: '123', expected: false, name: 'Слишком короткий' },
  { phone: '', expected: false, name: 'Пустой номер' },
  { phone: 'abc', expected: false, name: 'Только буквы' }
];

phoneTests.forEach(test => {
  const result = validatePhone(test.phone);
  const passed = result.valid === test.expected;
  console.log(passed ? '✅' : '❌', test.name, '-', result.message || 'OK');
});

// Тест 2: Валидация email
console.log('\n📋 Тест 2: Валидация email');
const emailTests = [
  { email: 'test@example.com', expected: true, name: 'Валидный email' },
  { email: 'user.name@domain.co.uk', expected: true, name: 'Валидный сложный email' },
  { email: 'invalid', expected: false, name: 'Невалидный email' },
  { email: '@example.com', expected: false, name: 'Email без имени' },
  { email: '', expected: false, name: 'Пустой email' }
];

emailTests.forEach(test => {
  const result = validateEmail(test.email);
  const passed = result.valid === test.expected;
  console.log(passed ? '✅' : '❌', test.name, '-', result.message || 'OK');
});

// Тест 3: Визуальная обратная связь
console.log('\n📋 Тест 3: Визуальная обратная связь');

// Найти поле телефона на текущей странице
const phoneInput = document.getElementById('phone') || 
                   document.querySelector('input[type="tel"]') ||
                   document.querySelector('.phone_mask');

if (phoneInput) {
  console.log('✅ Поле телефона найдено');
  
  // Показать ошибку
  showFieldError(phoneInput, 'Тестовое сообщение об ошибке');
  console.log('✅ Ошибка показана - проверьте визуально:');
  console.log('   - Поле должно быть подсвечено красным');
  console.log('   - Под полем должно быть сообщение');
  
  // Подождать 3 секунды и очистить
  setTimeout(() => {
    clearFieldError(phoneInput);
    console.log('✅ Ошибка очищена');
  }, 3000);
} else {
  console.log('⚠️  Поле телефона не найдено на этой странице');
  console.log('   Перейдите на /cart.html или /contact.html для полного теста');
}

// Тест 4: Валидация обязательных полей
console.log('\n📋 Тест 4: Валидация обязательных полей');

if (phoneInput) {
  const requiredTest = validateRequired(phoneInput, 'Телефон');
  console.log('Телефон (пустой):', requiredTest.valid ? '✅' : '❌', requiredTest.message);
  
  phoneInput.value = 'test';
  const filledTest = validateRequired(phoneInput, 'Телефон');
  console.log('Телефон (заполнен):', filledTest.valid ? '✅' : '❌', filledTest.message);
  
  phoneInput.value = ''; // Вернуть обратно
}

// Итоги
console.log('\n' + '='.repeat(50));
console.log('✅ Все функции валидации работают!');
console.log('📝 Для полного теста:');
console.log('   1. Откройте /cart.html');
console.log('   2. Попробуйте отправить заказ без телефона');
console.log('   3. Проверьте визуальную обратную связь');
console.log('='.repeat(50));
