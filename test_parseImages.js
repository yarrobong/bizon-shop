#!/usr/bin/env node

/**
 * Скрипт для проверки использования parseImagesJson
 * Проверяет, что везде используется утилита, а не ручной парсинг
 */

const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');
const utilsDir = path.join(__dirname, 'utils');

console.log('🔍 Проверка использования parseImagesJson\n');
console.log('='.repeat(60));

// 1. Проверяем, что утилита существует
console.log('\n1️⃣ Проверка существования утилиты parseImagesJson:');
const parseImagesPath = path.join(utilsDir, 'parseImages.js');
if (fs.existsSync(parseImagesPath)) {
  console.log('   ✅ Утилита parseImages.js найдена');
  const content = fs.readFileSync(parseImagesPath, 'utf8');
  if (content.includes('parseImagesJson')) {
    console.log('   ✅ Функция parseImagesJson определена');
  } else {
    console.log('   ❌ Функция parseImagesJson не найдена в утилите');
    process.exit(1);
  }
} else {
  console.log('   ❌ Утилита parseImages.js не найдена');
  process.exit(1);
}

// 2. Проверяем все файлы в routes на использование parseImagesJson
console.log('\n2️⃣ Проверка использования parseImagesJson в routes:');
const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
let allGood = true;
const results = {};

for (const file of routeFiles) {
  const filePath = path.join(routesDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Проверяем, используется ли images_json
  const usesImagesJson = content.includes('images_json');
  
  if (usesImagesJson) {
    // Проверяем, импортируется ли parseImagesJson
    const importsParseImages = content.includes("require('../utils/parseImages')") || 
                               content.includes('require("../utils/parseImages")');
    
    // Проверяем, используется ли функция
    const usesParseImages = content.includes('parseImagesJson(');
    
    // Проверяем на ручной парсинг (плохие паттерны)
    const hasManualParsing = 
      /if\s*\([^)]*images_json[^)]*\)/.test(content) ||
      /Array\.isArray\s*\([^)]*images_json/.test(content) ||
      /typeof\s+[^)]*images_json/.test(content) ||
      /JSON\.parse\s*\([^)]*images_json/.test(content);
    
    results[file] = {
      usesImagesJson,
      importsParseImages,
      usesParseImages,
      hasManualParsing
    };
    
    if (hasManualParsing) {
      console.log(`   ❌ ${file}: обнаружен ручной парсинг images_json`);
      allGood = false;
    } else if (usesImagesJson && !usesParseImages) {
      console.log(`   ⚠️  ${file}: использует images_json, но не использует parseImagesJson`);
      allGood = false;
    } else if (usesImagesJson && usesParseImages) {
      console.log(`   ✅ ${file}: использует parseImagesJson`);
    }
  } else {
    results[file] = { usesImagesJson: false };
  }
}

// 3. Детальный отчет
console.log('\n3️⃣ Детальный отчет:');
console.log('-'.repeat(60));
for (const [file, result] of Object.entries(results)) {
  if (result.usesImagesJson) {
    console.log(`\n📄 ${file}:`);
    console.log(`   - Использует images_json: ${result.usesImagesJson ? '✅' : '❌'}`);
    console.log(`   - Импортирует parseImages: ${result.importsParseImages ? '✅' : '❌'}`);
    console.log(`   - Использует parseImagesJson: ${result.usesParseImages ? '✅' : '❌'}`);
    console.log(`   - Ручной парсинг: ${result.hasManualParsing ? '❌ НАЙДЕН' : '✅ Нет'}`);
  }
}

// 4. Итоговый результат
console.log('\n' + '='.repeat(60));
if (allGood) {
  console.log('✅ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ: везде используется parseImagesJson');
  console.log('✅ Дублирование кода устранено');
} else {
  console.log('❌ ОБНАРУЖЕНЫ ПРОБЛЕМЫ: см. детальный отчет выше');
  process.exit(1);
}

console.log('\n');
