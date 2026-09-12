/* =========================================================================
   THE VAULT · resource page behaviour
   Table of contents, copy buttons, saved checklists, premium unlock.
   ========================================================================= */
(function () {
  'use strict';

  var body = document.body;
  var slug = body.getAttribute('data-slug') || '';
  var article = document.getElementById('article');

  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) {} }

  /* ---------- table of contents ---------- */
  var tocObserver = null;
  function buildToc() {
    var heads = article ? article.querySelectorAll('.prose h2[id]') : [];
    var list = '';
    Array.prototype.forEach.call(heads, function (h) {
      var t = h.getAttribute('data-toc') || h.textContent;
      list += '<li><a href="#' + h.id + '">' + t.replace(/</g, '&lt;') + '</a></li>';
    });
    var d = document.getElementById('tocList'); if (d) d.innerHTML = list;
    var m = document.getElementById('tocListM'); if (m) m.innerHTML = list;

    if (tocObserver) tocObserver.disconnect();
    if (!('IntersectionObserver' in window) || !heads.length) return;
    var links = document.querySelectorAll('#tocList a');
    tocObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        Array.prototype.forEach.call(links, function (a) {
          a.classList.toggle('on', a.getAttribute('href') === '#' + en.target.id);
        });
      });
    }, { rootMargin: '-90px 0px -70% 0px', threshold: 0 });
    Array.prototype.forEach.call(heads, function (h) { tocObserver.observe(h); });
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('#tocListM a');
    if (a) { var det = document.getElementById('tocM'); if (det) det.removeAttribute('open'); }
  });

  /* ---------- copy buttons ---------- */
  var ICON_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
  var ICON_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? resolve() : reject(); } catch (err) { reject(err); }
      ta.remove();
    });
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('.pb-copy'); if (!b) return;
    var pre = b.closest('.pb').querySelector('pre');
    copyText(pre.innerText.replace(/ /g, ' ')).then(function () {
      b.classList.add('done'); b.innerHTML = ICON_OK + 'Copied';
      setTimeout(function () { b.classList.remove('done'); b.innerHTML = ICON_COPY + 'Copy'; }, 1800);
    }, function () {
      var r = document.createRange(); r.selectNodeContents(pre);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      b.innerHTML = 'Press Ctrl+C';
    });
  });

  /* ---------- saved checklists ---------- */
  function initChecks(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('.checks[data-key]'), function (ul) {
      var key = 'ptg_vault_chk_' + slug + '_' + ul.getAttribute('data-key');
      var saved = {};
      try { saved = JSON.parse(lsGet(key) || '{}'); } catch (e) {}
      var boxes = ul.querySelectorAll('input[type="checkbox"]');
      var meta = ul.nextElementSibling && ul.nextElementSibling.classList.contains('checks-meta') ? ul.nextElementSibling : null;
      function update() {
        var n = 0; Array.prototype.forEach.call(boxes, function (b) { if (b.checked) n++; });
        if (meta) meta.querySelector('span').textContent = n + ' of ' + boxes.length + ' checked';
      }
      Array.prototype.forEach.call(boxes, function (b, i) {
        b.checked = !!saved[i];
        b.addEventListener('change', function () {
          saved[i] = b.checked; lsSet(key, JSON.stringify(saved)); update();
        });
      });
      if (meta) meta.querySelector('button').addEventListener('click', function () {
        saved = {}; lsDel(key);
        Array.prototype.forEach.call(boxes, function (b) { b.checked = false; });
        update();
      });
      update();
    });
  }

  buildToc();
  initChecks();

  /* ---------- premium unlock ---------- */
  if (body.getAttribute('data-tier') !== 'premium') return;

  var root = document.getElementById('premiumRoot');
  var lockEl = document.getElementById('lockPanel');
  var loaded = false;
  var loading = false;
  var DL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>';

  function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }

  function showLoading() {
    if (loaded || !root) return;
    root.innerHTML = '<div class="loading-row"><i></i>Opening your workflow</div>';
    root.hidden = false;
    if (lockEl) lockEl.hidden = true;
  }
  function showLock() {
    loaded = false;
    if (root) { root.hidden = true; root.innerHTML = ''; }
    if (lockEl) lockEl.hidden = false;
    Array.prototype.forEach.call(document.querySelectorAll('[data-when="member"]'), function (el) { el.hidden = true; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-when="locked"]'), function (el) { el.hidden = false; });
  }

  function loadContent() {
    if (loaded || loading) return;
    loading = true;
    showLoading();
    window.Vault.api('/api/content/' + encodeURIComponent(slug)).then(function (d) {
      loading = false;
      if (!d || !d.html) {
        if (d && d._status === 403) { showLock(); return; }
        if (root) root.innerHTML = '<div class="co co-warn"><span class="co-title">Could not open this one</span><p>' +
          window.Vault.esc((d && d.error) || 'Something went wrong loading this workflow.') +
          ' Refresh the page, and if it keeps happening email <a href="mailto:info@pushtoglory.com">info@pushtoglory.com</a>.</p></div>';
        return;
      }
      loaded = true;
      var files = '';
      if (d.files && d.files.length) {
        files = '<div class="files"><h3>Your files</h3><p>Links are personal and expire after 30 minutes. Reload the page for fresh ones.</p>';
        d.files.forEach(function (f) {
          files += '<div class="file"><div class="fn"><b>' + window.Vault.esc(f.name) + '</b><span>' + window.Vault.esc(f.label || '') +
            (f.size ? ' · ' + fmtSize(f.size) : '') + '</span></div>' +
            '<a class="btn btn-teal btn-sm" href="' + window.Vault.esc(f.url) + '" rel="nofollow">' + DL + 'Download</a></div>';
        });
        files += '</div>';
      }
      root.innerHTML = files + '<div class="prose">' + d.html + '</div>';
      root.hidden = false;
      if (lockEl) lockEl.hidden = true;
      Array.prototype.forEach.call(document.querySelectorAll('[data-when="member"]'), function (el) { el.hidden = false; });
      Array.prototype.forEach.call(document.querySelectorAll('[data-when="locked"]'), function (el) { el.hidden = true; });
      buildToc();
      initChecks(root);
    });
  }

  function decide(me) {
    if (me && me.premium) { loadContent(); return; }
    var wasOpen = loaded;
    showLock();
    if (wasOpen) buildToc();
  }

  var hasToken = false;
  try { hasToken = !!window.localStorage.getItem('ptg_vault_token'); } catch (e) {}
  if (hasToken) showLoading(); else showLock();

  document.addEventListener('vault:me', function (e) { decide(e.detail); });
  document.addEventListener('vault:welcome', function (e) { decide(e.detail); });
  if (window.Vault && window.Vault.ready()) decide(window.Vault.me());
})();
