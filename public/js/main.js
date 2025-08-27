// main.js
// Инициализация приложения
window.currentCategory = 'все';
document.addEventListener('DOMContentLoaded', () => {
  renderProducts();
  updateCartCount();
  setupEventListeners();
});





(function () {
	var a = document.querySelectorAll('.nav-list a');
		for (var i=a.length; i--;) {
			if (a[i].href === window.location.pathname || a[i].href === window.location.href) a[i].className += ' active';
		}
})();