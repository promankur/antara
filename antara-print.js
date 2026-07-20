/* ANTARA — print support: open all accordions for printing and
   inject the running footer. Restores screen state afterwards. */
(function () {
  var opened = [];

  function preparePrint() {
    opened = [];
    document.querySelectorAll('details:not([open])').forEach(function (d) {
      d.setAttribute('open', '');
      opened.push(d);
    });
    if (!document.querySelector('.antara-print-footer')) {
      var f = document.createElement('div');
      f.className = 'antara-print-footer';
      var title = (document.title || '').split('|')[0].trim();
      f.textContent = 'ANTARA · ' + title + ' · antara.promankur.com';
      document.body.appendChild(f);
    }
  }

  function restoreAfterPrint() {
    opened.forEach(function (d) { d.removeAttribute('open'); });
    opened = [];
  }

  window.addEventListener('beforeprint', preparePrint);
  window.addEventListener('afterprint', restoreAfterPrint);

  /* Safari fires matchMedia instead of beforeprint */
  if (window.matchMedia) {
    window.matchMedia('print').addListener(function (mql) {
      if (mql.matches) preparePrint(); else restoreAfterPrint();
    });
  }
})();
