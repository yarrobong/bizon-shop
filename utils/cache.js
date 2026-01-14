/**
 * Модуль кэширования для часто запрашиваемых данных
 * Использует node-cache для кэширования товаров, категорий и других данных
 */

const NodeCache = require('node-cache');

// Создаем экземпляр кэша с TTL 5 минут (300 секунд)
const cache = new NodeCache({ 
  stdTTL: 300, // Время жизни по умолчанию: 5 минут
  checkperiod: 60, // Проверка устаревших записей каждую минуту
  useClones: false // Не клонировать объекты для лучшей производительности
});

/**
 * Получить данные из кэша
 * @param {string} key - Ключ кэша
 * @returns {any|null} - Данные из кэша или null
 */
function get(key) {
  return cache.get(key);
}

/**
 * Сохранить данные в кэш
 * @param {string} key - Ключ кэша
 * @param {any} value - Значение для кэширования
 * @param {number} ttl - Время жизни в секундах (опционально)
 */
function set(key, value, ttl = null) {
  if (ttl) {
    cache.set(key, value, ttl);
  } else {
    cache.set(key, value);
  }
}

/**
 * Удалить данные из кэша
 * @param {string|string[]} keys - Ключ или массив ключей
 */
function del(keys) {
  if (Array.isArray(keys)) {
    cache.del(keys);
  } else {
    cache.del(keys);
  }
}

/**
 * Очистить весь кэш
 */
function flush() {
  cache.flushAll();
}

/**
 * Инвалидировать кэш товаров (вызывать при изменении товаров)
 */
function invalidateProducts() {
  const keys = cache.keys();
  const productKeys = keys.filter(key => 
    key.startsWith('products:') || 
    key.startsWith('products_for_proposal:')
  );
  if (productKeys.length > 0) {
    cache.del(productKeys);
    console.log(`[Cache] Инвалидирован кэш товаров: ${productKeys.length} ключей`);
  }
}

/**
 * Инвалидировать кэш категорий (вызывать при изменении категорий)
 */
function invalidateCategories() {
  cache.del('categories');
  console.log('[Cache] Инвалидирован кэш категорий');
}

/**
 * Инвалидировать кэш аттракционов (вызывать при изменении аттракционов)
 */
function invalidateAttractions() {
  const keys = cache.keys();
  const attractionKeys = keys.filter(key => 
    key.startsWith('attractions:') || 
    key.startsWith('products_for_proposal:')
  );
  if (attractionKeys.length > 0) {
    cache.del(attractionKeys);
    console.log(`[Cache] Инвалидирован кэш аттракционов: ${attractionKeys.length} ключей`);
  }
}

/**
 * Получить статистику кэша
 */
function getStats() {
  return cache.getStats();
}

module.exports = {
  get,
  set,
  del,
  flush,
  invalidateProducts,
  invalidateCategories,
  invalidateAttractions,
  getStats
};
