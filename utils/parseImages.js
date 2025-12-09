/**
 * Утилитарная функция для парсинга images_json
 */
function parseImagesJson(imagesJson, productId = null) {
  if (!imagesJson) return [];
  
  if (typeof imagesJson === 'string') {
    try {
      const parsed = JSON.parse(imagesJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      if (productId) {
        console.error(`Ошибка парсинга images_json для товара ${productId}:`, e);
      }
      return [];
    }
  } else if (Array.isArray(imagesJson)) {
    return imagesJson;
  } else if (typeof imagesJson === 'object') {
    return [imagesJson];
  }
  return [];
}

module.exports = { parseImagesJson };

