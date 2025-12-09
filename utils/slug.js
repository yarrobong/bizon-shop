/**
 * Генерация slug из названия
 */
function generateSlug(title) {
  if (!title || typeof title !== 'string') {
    return '';
  }
  
  return encodeURIComponent(
    title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
  );
}

/**
 * Генерация slug для аттракционов
 */
function generateAttractionSlug(title) {
  if (!title || typeof title !== 'string') {
    return '';
  }
  
  return encodeURIComponent(
    title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
  );
}

module.exports = {
  generateSlug,
  generateAttractionSlug
};

