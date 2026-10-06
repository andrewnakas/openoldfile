// Analytics-only consent banner. The site runs no ads, so the only question
// is whether GA4 may set cookies. The choice is applied in <head> on later
// visits (see analytics() in src/layout.mjs).
(function () {
  var KEY = 'oof_consent';
  var stored = null;
  try { stored = localStorage.getItem(KEY); } catch (e) {}
  if (stored) return;

  function choose(value) {
    try { localStorage.setItem(KEY, value); } catch (e) {}
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', { analytics_storage: value === 'yes' ? 'granted' : 'denied' });
    }
    bar.remove();
    document.body.classList.remove('consent-open');
  }

  var bar = document.createElement('div');
  bar.id = 'consent';
  bar.setAttribute('role', 'dialog');
  bar.setAttribute('aria-label', 'Analytics cookies');
  bar.innerHTML = '<p>We use analytics cookies to see which viewers people use. Your files are never uploaded. ' +
    '<a href="/privacy/">Privacy</a></p>' +
    '<button type="button" class="btn btn-secondary" data-v="no">No thanks</button>' +
    '<button type="button" class="btn" data-v="yes">OK</button>';
  bar.addEventListener('click', function (e) {
    var v = e.target && e.target.getAttribute('data-v');
    if (v) choose(v);
  });
  function show() {
    document.body.appendChild(bar);
    document.body.classList.add('consent-open');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
  else show();
})();
