(function(){
  const href='/assets/sgfs-tab-icon-v45-20260919.png?v=45';
  function refreshSgfsTabIcon(){
    document.querySelectorAll('link[rel="icon"],link[rel="shortcut icon"]').forEach(el=>el.remove());
    const icon=document.createElement('link');
    icon.rel='icon'; icon.type='image/png'; icon.href=href;
    document.head.appendChild(icon);
  }
  refreshSgfsTabIcon();
  window.addEventListener('pageshow', refreshSgfsTabIcon);
})();