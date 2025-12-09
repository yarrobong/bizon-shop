/**
 * Экранирование XML символов
 */
function xmlEscape(str) {
  if (typeof str !== 'string') {
    str = String(str);
  }
  return str.replace(/[&<>"']/g, function (match) {
    switch (match) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&apos;';
      default: return match;
    }
  });
}

module.exports = { xmlEscape };

