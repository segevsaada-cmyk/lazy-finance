(function () {
  try {
    var saved = localStorage.getItem('lf-theme');
    var theme = saved === 'light' || saved === 'dark' ? saved : 'dark';
    if (theme === 'dark') document.documentElement.classList.add('dark');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0f172a' : '#ffffff');
  } catch (e) {}
})();
