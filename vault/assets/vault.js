/* =========================================================================
   THE VAULT · shared runtime
   Session, sign in, checkout, billing portal, header account menu.
   Every Vault page loads this file.
   ========================================================================= */
(function () {
  'use strict';

  var CONFIG = {
    api: 'https://the-vault.kaloqnv5.workers.dev',
    plans: {
      yearly: {
        name: 'Yearly access', price: '$5.99', per: 'per month', approx: 'about €5.49',
        billed: '$71.88', billedNote: 'billed once a year', compare: '$131.88 paying monthly', save: 'Save 45%'
      },
      monthly: {
        name: 'Monthly access', price: '$10.99', per: 'per month', approx: 'about €9.99',
        billed: '$131.88', billedNote: 'across a full year', note: 'Cancel any time'
      }
    }
  };

  var TOKEN_KEY = 'ptg_vault_token';
  var ME_KEY = 'ptg_vault_me';

  // Local testing only: on localhost a different API can be set in localStorage.
  // Ignored everywhere else, so it can never redirect the live site.
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    try { var o = window.localStorage.getItem('ptg_vault_api'); if (o && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(o)) CONFIG.api = o; } catch (e) {}
  }

  /* ---------- storage (never throws) ---------- */
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) {} }
  function ssGet(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) {} }
  function ssDel(k) { try { window.sessionStorage.removeItem(k); } catch (e) {} }

  function token() { return lsGet(TOKEN_KEY); }
  function setToken(t) { if (t) lsSet(TOKEN_KEY, t); }

  var state = { me: null, ready: false };
  var cached = ssGet(ME_KEY);
  if (cached && token()) { try { state.me = JSON.parse(cached); } catch (e) {} }

  /* ---------- helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function isPremium() { return !!(state.me && state.me.premium); }

  function api(path, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    var t = token();
    if (t && opts.auth !== false) headers.Authorization = 'Bearer ' + t;
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 20000) : null;
    return fetch(CONFIG.api + path, {
      method: opts.method || (opts.body ? 'POST' : 'GET'),
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      return res.json().catch(function () { return {}; }).then(function (d) {
        d = d || {};
        d._status = res.status;
        return d;
      });
    }, function (err) {
      if (timer) clearTimeout(timer);
      return { ok: false, _status: 0, error: 'Could not reach the Vault. Check your connection and try again.' };
    });
  }

  function setMe(me) {
    state.me = me && me.email ? me : null;
    state.ready = true;
    if (state.me) ssSet(ME_KEY, JSON.stringify(state.me)); else ssDel(ME_KEY);
    renderAccount();
    document.dispatchEvent(new CustomEvent('vault:me', { detail: state.me }));
  }

  function signOut() {
    lsDel(TOKEN_KEY); ssDel(ME_KEY);
    setMe(null);
    toast('Signed out.');
  }

  function refreshMe() {
    if (!token()) { setMe(null); return Promise.resolve(null); }
    return api('/api/me').then(function (d) {
      if (d._status === 401) { lsDel(TOKEN_KEY); setMe(null); return null; }
      if (d && d.email) { setMe(d); return d; }
      state.ready = true;
      document.dispatchEvent(new CustomEvent('vault:me', { detail: state.me }));
      return state.me;
    });
  }

  /* ---------- toast ---------- */
  var toastTimer = null;
  function toast(msg, kind) {
    var old = $('.v-toast'); if (old) old.remove();
    var el = document.createElement('div');
    el.className = 'v-toast' + (kind === 'teal' ? ' teal' : '');
    el.setAttribute('role', 'status');
    el.textContent = msg;
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.remove(); }, 5200);
  }

  /* ---------- header account ---------- */
  function renderAccount() {
    var box = $('#vAcct'); if (!box) return;
    if (!state.me) {
      box.innerHTML = '<button class="btn btn-gold btn-sm" type="button" data-v="signin">Sign in<span class="sheen"></span></button>';
      return;
    }
    var p = !!state.me.premium;
    var initial = (state.me.email || '?').charAt(0).toUpperCase();
    box.innerHTML =
      '<div style="position:relative">' +
        '<button class="v-acct-chip" type="button" data-v="menu" aria-haspopup="true" aria-expanded="false">' +
          '<span class="dot">' + esc(initial) + '</span>' +
          '<span class="em">' + esc(state.me.email) + '</span>' +
          '<span class="tier ' + (p ? 'p' : 'f') + '">' + (p ? 'Premium' : 'Free') + '</span>' +
        '</button>' +
        '<div class="v-menu" id="vMenu" role="menu">' +
          '<div class="mhead">Signed in as<b>' + esc(state.me.email) + '</b>' + planLine() + '</div>' +
          (p
            ? (state.me.plan === 'comp' ? '' : '<button type="button" role="menuitem" data-v="portal">Manage billing</button>')
            : '<button type="button" role="menuitem" data-v="plans">Get Premium</button>') +
          '<a role="menuitem" href="/vault/#library">Library</a>' +
          '<button type="button" role="menuitem" data-v="signout">Sign out</button>' +
        '</div>' +
      '</div>';
  }

  function planLine() {
    var m = state.me; if (!m) return '';
    if (!m.premium) return '<span style="display:block;margin-top:6px">Free account</span>';
    if (m.plan === 'comp') return '<span style="display:block;margin-top:6px;color:#9CF3EA">Premium, complimentary</span>';
    var name = m.plan === 'yearly' ? 'Premium, yearly' : m.plan === 'monthly' ? 'Premium, monthly' : 'Premium';
    var tail = '';
    if (m.renews_at) {
      var d = new Date(m.renews_at * 1000);
      var ds = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
      tail = m.cancel_at_period_end ? ' · ends ' + ds : ' · renews ' + ds;
    }
    return '<span style="display:block;margin-top:6px;color:#E8C877">' + name + tail + '</span>';
  }

  /* ---------- modals ---------- */
  function modalShell(id, inner) {
    var m = document.getElementById(id);
    if (!m) {
      m = document.createElement('div');
      m.className = 'v-modal'; m.id = id;
      m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
      document.body.appendChild(m);
    }
    m.innerHTML = '<div class="v-modal-card"><div class="v-modal-in"><div class="corners"><i></i><i></i><i></i><i></i></div>' +
      '<button class="v-modal-x" type="button" data-v="close" aria-label="Close">×</button>' + inner + '</div></div>';
    return m;
  }
  var lastFocus = null;
  function openModal(m) {
    lastFocus = document.activeElement;
    closeModals();
    m.classList.add('open');
    document.documentElement.style.overflow = 'hidden';
    setTimeout(function () { var f = m.querySelector('input,button:not(.v-modal-x)'); if (f) f.focus(); }, 60);
  }
  function closeModals() {
    Array.prototype.forEach.call(document.querySelectorAll('.v-modal.open'), function (x) { x.classList.remove('open'); });
    document.documentElement.style.overflow = '';
  }

  function msg(el, text, kind) { if (!el) return; el.textContent = text; el.className = 'v-msg show ' + (kind || 'err'); }
  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>' + esc(label || 'Working'); }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  }

  /* sign in: email, then 6 digit code */
  var afterSignIn = null;
  function openSignIn(opts) {
    opts = opts || {};
    afterSignIn = opts.then || null;
    var m = modalShell('vSignIn',
      '<div data-step="email">' +
        '<div class="eyebrow">' + esc(opts.eyebrow || 'Member sign in') + '</div>' +
        '<h3>' + esc(opts.title || 'Sign in to the Vault') + '</h3>' +
        '<p>' + (opts.text || 'Enter the email you subscribed with. I will send you a 6 digit code. No password to remember.') + '</p>' +
        '<form data-v="emailForm" novalidate>' +
          '<div class="v-field"><label for="vEmail">Email</label><input class="v-input" id="vEmail" type="email" autocomplete="email" inputmode="email" placeholder="name@company.com" required></div>' +
          '<div class="v-msg" data-m="email"></div>' +
          '<button class="btn btn-gold btn-block btn-lg" type="submit" style="margin-top:20px">Send my code<span class="sheen"></span></button>' +
        '</form>' +
        '<div class="alt">Not a member yet? <button type="button" data-v="plans">See the plans</button></div>' +
      '</div>' +
      '<div data-step="code" hidden>' +
        '<div class="eyebrow">Check your inbox</div>' +
        '<h3>Enter your code</h3>' +
        '<p>I sent a 6 digit code to <b data-sent></b>. It expires in 10 minutes. Not there? Check Promotions or Spam.</p>' +
        '<form data-v="codeForm" novalidate>' +
          '<div class="v-field"><label for="vCode">6 digit code</label><input class="v-input code" id="vCode" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" required></div>' +
          '<div class="v-msg" data-m="code"></div>' +
          '<button class="btn btn-gold btn-block btn-lg" type="submit" style="margin-top:20px">Enter the Vault<span class="sheen"></span></button>' +
        '</form>' +
        '<div class="alt"><button type="button" data-v="back">Use a different email</button> · <button type="button" data-v="resend">Send a new code</button></div>' +
      '</div>');
    m.dataset.challenge = '';
    openModal(m);
  }

  function sendCode(email, m) {
    var form = m.querySelector('[data-v="emailForm"]');
    var btn = form.querySelector('button[type="submit"]');
    var box = m.querySelector('[data-m="email"]');
    busy(btn, true, 'Sending');
    return api('/api/auth/request', { body: { email: email }, auth: false }).then(function (d) {
      busy(btn, false);
      if (d && d.ok && d.challenge) {
        m.dataset.challenge = d.challenge;
        m.dataset.email = email;
        m.querySelector('[data-sent]').textContent = email;
        m.querySelector('[data-step="email"]').hidden = true;
        m.querySelector('[data-step="code"]').hidden = false;
        var c = m.querySelector('#vCode'); c.value = ''; setTimeout(function () { c.focus(); }, 60);
        var cb = m.querySelector('[data-m="code"]'); cb.className = 'v-msg';
        return true;
      }
      msg(box, (d && d.error) || 'Could not send the code. Try again in a minute.');
      return false;
    });
  }

  /* plans picker */
  function openPlans(opts) {
    opts = opts || {};
    if (isPremium()) { toast('You already have Premium. Everything is open.', 'teal'); return; }
    var y = CONFIG.plans.yearly, mo = CONFIG.plans.monthly;
    var m = modalShell('vPlans',
      '<div class="eyebrow">Premium</div>' +
      '<h3>' + esc(opts.title || 'Unlock every workflow') + '</h3>' +
      '<p>' + (opts.text || 'One price opens every premium workflow, the files inside them, and every new one I add.') + '</p>' +
      '<div class="v-plan-pick">' +
        '<button type="button" class="v-plan-opt best" data-plan="yearly"><span><span class="pn">' + y.name + ' · ' + y.save + '</span><span class="ps">' + y.billed + ' ' + y.billedNote + '</span></span><span class="pp">' + y.price + '<small> /mo</small></span></button>' +
        '<button type="button" class="v-plan-opt" data-plan="monthly"><span><span class="pn">' + mo.name + '</span><span class="ps">' + mo.note + '</span></span><span class="pp">' + mo.price + '<small> /mo</small></span></button>' +
      '</div>' +
      '<div class="v-msg" data-m="plans"></div>' +
      '<p style="font-size:12.5px;margin-top:16px;color:#8E877C">Secure checkout by Stripe. Renews until you cancel, and you can cancel in one click from your account.</p>' +
      (state.me ? '' : '<div class="alt">Already a member? <button type="button" data-v="signin">Sign in</button></div>'));
    openModal(m);
  }

  function checkout(plan, btn) {
    plan = plan === 'monthly' ? 'monthly' : 'yearly';
    if (isPremium()) { toast('You already have Premium. Everything is open.', 'teal'); return; }
    var box = document.querySelector('#vPlans.open [data-m="plans"]');
    if (btn) busy(btn, true, 'Opening checkout');
    api('/api/checkout', { body: { plan: plan, return_origin: location.origin, return_path: location.pathname } }).then(function (d) {
      if (d && d.url) { window.location.href = d.url; return; }
      if (btn) busy(btn, false);
      if (d && d.already) { refreshMe(); toast('You already have Premium on this email. Everything is open.', 'teal'); closeModals(); return; }
      var e = (d && d.error) || 'Could not open checkout. Try again in a minute.';
      if (box) msg(box, e); else toast(e);
    });
  }

  function portal(btn) {
    if (btn) busy(btn, true, 'Opening');
    api('/api/portal', { body: { return_origin: location.origin, return_path: location.pathname } }).then(function (d) {
      if (d && d.url) { window.location.href = d.url; return; }
      if (btn) busy(btn, false);
      toast((d && d.error) || 'Could not open billing right now. Email info@pushtoglory.com and I will sort it.');
    });
  }

  /* ---------- global click + submit handling ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-v],[data-plan],[data-checkout]');
    var menu = $('#vMenu');
    if (menu && menu.classList.contains('open') && !e.target.closest('#vMenu') && !(t && t.dataset.v === 'menu')) {
      menu.classList.remove('open');
    }
    if (e.target.classList && e.target.classList.contains('v-modal')) { closeModals(); return; }
    if (!t) return;

    if (t.hasAttribute('data-checkout')) { e.preventDefault(); checkout(t.getAttribute('data-checkout'), t); return; }
    if (t.hasAttribute('data-plan')) { e.preventDefault(); checkout(t.getAttribute('data-plan'), t); return; }

    var v = t.dataset.v;
    if (v === 'close') { closeModals(); }
    else if (v === 'signin') { e.preventDefault(); openSignIn(); }
    else if (v === 'plans') { e.preventDefault(); openPlans(); }
    else if (v === 'menu') {
      var mm = $('#vMenu'); if (mm) { var o = mm.classList.toggle('open'); t.setAttribute('aria-expanded', o ? 'true' : 'false'); }
    }
    else if (v === 'portal') { e.preventDefault(); portal(t); }
    else if (v === 'signout') { e.preventDefault(); signOut(); }
    else if (v === 'burger') { var n = $('.v-nav'); if (n) n.classList.toggle('open'); }
    else if (v === 'back') {
      var m = $('#vSignIn');
      m.querySelector('[data-step="code"]').hidden = true;
      m.querySelector('[data-step="email"]').hidden = false;
      setTimeout(function () { m.querySelector('#vEmail').focus(); }, 60);
    }
    else if (v === 'resend') {
      var m2 = $('#vSignIn');
      if (m2 && m2.dataset.email) {
        m2.querySelector('[data-step="code"]').hidden = true;
        m2.querySelector('[data-step="email"]').hidden = false;
        sendCode(m2.dataset.email, m2).then(function (ok) { if (ok) msg(m2.querySelector('[data-m="code"]'), 'A new code is on its way.', 'ok'); });
      }
    }
  });

  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.matches('[data-v="emailForm"]')) {
      e.preventDefault();
      var m = $('#vSignIn');
      var email = f.querySelector('#vEmail').value.trim().toLowerCase();
      var box = m.querySelector('[data-m="email"]');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg(box, 'That email does not look right.'); return; }
      box.className = 'v-msg';
      sendCode(email, m);
    }
    if (f.matches('[data-v="codeForm"]')) {
      e.preventDefault();
      var m3 = $('#vSignIn');
      var code = f.querySelector('#vCode').value.replace(/\D/g, '');
      var box3 = m3.querySelector('[data-m="code"]');
      if (code.length !== 6) { msg(box3, 'Enter the 6 digit code from the email.'); return; }
      var btn = f.querySelector('button[type="submit"]');
      busy(btn, true, 'Checking');
      api('/api/auth/verify', { body: { challenge: m3.dataset.challenge, code: code }, auth: false }).then(function (d) {
        busy(btn, false);
        if (d && d.ok && d.token) {
          setToken(d.token);
          setMe(d.me || { email: d.email, premium: !!d.premium });
          closeModals();
          toast(d.me && d.me.premium ? 'Welcome back. Premium is open.' : 'Signed in as ' + (d.me ? d.me.email : ''), d.me && d.me.premium ? 'teal' : '');
          var next = afterSignIn; afterSignIn = null;
          if (typeof next === 'function') next(state.me);
        } else {
          msg(box3, (d && d.error) || 'That code is not right, or it expired.');
        }
      });
    }
  });

  document.addEventListener('input', function (e) {
    if (e.target.id === 'vCode') {
      var v = e.target.value.replace(/\D/g, '').slice(0, 6);
      if (e.target.value !== v) e.target.value = v;
      if (v.length === 6) { var f = e.target.form; if (f && f.requestSubmit) f.requestSubmit(); }
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeModals(); var mm = $('#vMenu'); if (mm) mm.classList.remove('open'); }
  });

  /* ---------- header scroll state + reading progress ---------- */
  var head = $('.v-head');
  var prog = $('.v-progress');
  var article = $('[data-progress]');
  var raf = null;
  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = null;
      if (head) head.classList.toggle('scrolled', window.scrollY > 24);
      if (prog && article) {
        var r = article.getBoundingClientRect();
        var total = r.height - window.innerHeight * 0.6;
        var done = Math.min(Math.max(-r.top + 90, 0), Math.max(total, 1));
        prog.style.width = (total > 0 ? (done / total) * 100 : 0).toFixed(2) + '%';
      }
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- reveal on scroll ---------- */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    Array.prototype.forEach.call(document.querySelectorAll('.rv'), function (el) { io.observe(el); });
  } else {
    Array.prototype.forEach.call(document.querySelectorAll('.rv'), function (el) { el.classList.add('in'); });
  }

  /* ---------- boot ---------- */
  renderAccount();
  var qs = new URLSearchParams(location.search);
  if (qs.get('checkout') === 'success' && qs.get('session_id')) {
    var sid = qs.get('session_id');
    history.replaceState({}, '', location.pathname + location.hash);
    api('/api/auth/checkout', { body: { session_id: sid }, auth: false }).then(function (d) {
      if (d && d.ok && d.token) {
        setToken(d.token);
        setMe(d.me || { email: d.email, premium: true });
        document.dispatchEvent(new CustomEvent('vault:welcome', { detail: state.me }));
      } else {
        refreshMe();
        toast((d && d.error) || 'Payment received. Sign in with the email you used at checkout to open Premium.');
      }
    });
  } else {
    if (qs.get('checkout') === 'cancel') {
      history.replaceState({}, '', location.pathname + location.hash);
      setTimeout(function () { toast('Checkout cancelled. Nothing was charged.'); }, 400);
    }
    refreshMe();
  }

  window.Vault = {
    config: CONFIG, api: api, me: function () { return state.me; }, ready: function () { return state.ready; },
    isPremium: isPremium, refresh: refreshMe, signIn: openSignIn, plans: openPlans, checkout: checkout,
    portal: portal, toast: toast, esc: esc
  };
})();
