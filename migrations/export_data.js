require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Подключение к локальной БД
const localPool = new Pool({
  connectionString: process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL,
  ssl: false
});

// Список таблиц для экспорта (в порядке зависимостей)
const TABLES = [
  'categories',
  'products',
  'product_variants_link',
  'attractions',
  'attraction_images',
  'attraction_videos',
  'orders',
  'order_items',
  'sessions'
];

async function exportTableData(tableName) {
  try {
    console.log(`📦 Экспорт таблицы: ${tableName}...`);
    
    // Получаем все данные из таблицы
    const result = await localPool.query(`SELECT * FROM ${tableName} ORDER BY id`);
    
    console.log(`   ✅ Экспортировано ${result.rows.length} записей`);
    return result.rows;
  } catch (err) {
    if (err.code === '42P01') {
      console.log(`   ⚠️  Таблица ${tableName} не существует, пропускаем...`);
      return [];
    }
    throw err;
  }
}

async function exportAllData() {
  const exportDir = path.join(__dirname, 'exported_data');
  
  // Создаем директорию для экспорта
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }
  
  const allData = {};
  
  try {
    console.log('🚀 Начало экспорта данных из локальной БД...\n');
    
    for (const table of TABLES) {
      const data = await exportTableData(table);
      allData[table] = data;
      
      // Сохраняем в отдельный файл
      const filePath = path.join(exportDir, `${table}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    }
    
    // Сохраняем все данные в один файл
    const allDataPath = path.join(exportDir, 'all_data.json');
    fs.writeFileSync(allDataPath, JSON.stringify(allData, null, 2), 'utf8');
    
    console.log('\n✅ Экспорт завершен успешно!');
    console.log(`📁 Данные сохранены в: ${exportDir}`);
    
    // Выводим статистику
    console.log('\n📊 Статистика экспорта:');
    for (const table of TABLES) {
      const count = allData[table]?.length || 0;
      console.log(`   ${table}: ${count} записей`);
    }
    
  } catch (err) {
    console.error('❌ Ошибка при экспорте:', err);
    throw err;
  } finally {
    await localPool.end();
  }
}

// Запуск экспорта
exportAllData().catch(err => {
  console.error('Критическая ошибка:', err);
  process.exit(1);
});
