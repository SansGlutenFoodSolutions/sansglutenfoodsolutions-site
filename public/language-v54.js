
(() => {
  const flags = {fr:'🇫🇷',en:'🇬🇧',es:'🇪🇸',it:'🇮🇹',de:'🇩🇪',pt:'🇵🇹',nl:'🇳🇱',pl:'🇵🇱',ro:'🇷🇴',el:'🇬🇷',cs:'🇨🇿',sv:'🇸🇪',da:'🇩🇰',fi:'🇫🇮'};
  document.querySelectorAll('.language-picker').forEach((picker) => {
    const select = picker.querySelector('.language-select');
    const flag = picker.querySelector('.language-flag');
    if (!select || !flag) return;
    const pageLang = (document.documentElement.lang || 'fr').toLowerCase().slice(0,2);
    if (pageLang === 'en') { select.value = 'en'; flag.textContent = flags.en; }
    select.addEventListener('change', () => {
      const target = select.value;
      if (!target) return;
      flag.textContent = flags[target] || '🌐';
      if (target === 'fr') {
        window.location.href = 'https://sansglutenfoodsolutions.com' + (location.pathname === '/en/' ? '/' : location.pathname);
        return;
      }
      const original = 'https://sansglutenfoodsolutions.com' + location.pathname;
      window.location.href = 'https://translate.google.com/translate?sl=fr&tl=' + encodeURIComponent(target) + '&u=' + encodeURIComponent(original);
    });
  });
})();
