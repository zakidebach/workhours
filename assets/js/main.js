/*!
 * WorkHours shared UI: navigation, animations, storage, time inputs, formatting.
 * Depends on calc.js (window.WHCalc) for time parsing.
 */
(function () {
  'use strict';
  var doc = document;
  doc.documentElement.classList.remove('no-js');

  var WH = window.WH = {};
  var C = window.WHCalc;
  var I = window.WHi18n || { lang: 'en', t: function (k) { return k; } };

  /* ---------- Language ---------- */
  WH.lang = I.lang;
  WH.t = I.t;
  WH.decimalComma = WH.lang === 'fr';
  // French uses 1 234,56; English and Arabic use 1,234.56 (Western digits, which Arabic-speaking users in the U.S. expect for money).
  var LOCALE = WH.lang === 'fr' ? 'fr-FR' : 'en-US';

  /* ---------- Formatting ---------- */
  var usd = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'USD' });
  WH.money = function (n) {
    var s = usd.format(n || 0);
    return WH.lang === 'ar' ? '<bdi>' + s + '</bdi>' : s; // keep "$1,234.56" left-to-right inside Arabic text
  };
  WH.moneyText = function (n) { return usd.format(n || 0); };
  WH.num = function (n, d) {
    return Number(n || 0).toLocaleString(LOCALE, { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d });
  };
  /** Percentage with at most one decimal: 0.125 -> "12.5%" (fr: "12,5 %"). */
  WH.pct = function (n) {
    if (!isFinite(n)) n = 0;
    var s = (n * 100).toFixed(1).replace(/\.0$/, '');
    return WH.lang === 'fr' ? s.replace('.', ',') + ' %' : s + '%';
  };
  /** Number as the user would type it in this language (fr uses a decimal comma). */
  WH.inputNum = function (n) { var s = String(n); return WH.decimalComma ? s.replace('.', ',') : s; };
  WH.hmWords = function (min) {
    return C.formatHMWords(min, { hr: WH.t('unit.hr'), hrs: WH.t('unit.hrs'), min: WH.t('unit.min') });
  };
  /** Translate a calc.js error code (e.g. "time.format"); returns plain text unchanged. */
  WH.err = function (code, vars) { return /^[a-z]+\.[A-Za-z0-9]+$/.test(code) ? WH.t(code, vars) : code; };

  /* ---------- Safe localStorage (data never leaves the device; kept separately per language) ---------- */
  var PREFIX = 'wh:' + WH.lang + ':';
  WH.store = {
    get: function (key, fallback) {
      try { var v = window.localStorage.getItem(PREFIX + key); return v == null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { window.localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
    },
    remove: function (key) {
      try { window.localStorage.removeItem(PREFIX + key); } catch (e) { /* ignore */ }
    }
  };

  /* ---------- DOM helpers ---------- */
  WH.$ = function (sel, ctx) { return (ctx || doc).querySelector(sel); };
  WH.$$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); };
  WH.el = function (tag, attrs, html) {
    var e = doc.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]);
    });
    if (html != null) e.innerHTML = html;
    return e;
  };
  WH.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var uid = 0;
  WH.uid = function (p) { uid += 1; return (p || 'f') + '-' + uid; };

  /** Mark an input invalid and show a message in its error element (if any). */
  WH.setError = function (input, msg, errEl) {
    if (!input) return;
    if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    var target = errEl || (input.getAttribute('aria-describedby') && doc.getElementById(input.getAttribute('aria-describedby').split(' ')[0]));
    if (target) target.textContent = msg || '';
  };

  /**
   * Read a numeric field with validation.
   * opts: {required, min, max, label, integer}
   * Returns {value} or {error}.
   */
  WH.readNumber = function (input, opts) {
    opts = opts || {};
    var v = C.parseNumber(input.value, WH.decimalComma);
    var label = opts.label || '';
    var err = null;
    function n(x) { return WH.inputNum(x); }
    if (v === null) {
      if (opts.required) err = WH.t('err.required', { label: label });
      else v = opts.fallback == null ? 0 : opts.fallback;
    } else if (isNaN(v)) err = WH.t('err.number');
    else if (opts.min != null && v < opts.min) err = WH.t('err.min', { label: label, min: n(opts.min) });
    else if (opts.max != null && v > opts.max) err = WH.t('err.max', { label: label, max: n(opts.max) });
    WH.setError(input, err);
    return err ? { error: err } : { value: v };
  };

  /** Brief highlight on a results box after recalculation. */
  WH.flash = function (el) {
    if (!el) return;
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  };

  WH.copyText = function (text, button) {
    function done(ok) {
      if (!button) return;
      var orig = button.getAttribute('data-label') || button.textContent;
      button.setAttribute('data-label', orig);
      button.textContent = ok ? WH.t('copied') : WH.t('copyFailed');
      setTimeout(function () { button.textContent = orig; }, 1600);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      var ta = WH.el('textarea'); ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0'; doc.body.appendChild(ta); ta.select();
      var ok = false; try { ok = doc.execCommand('copy'); } catch (e) { ok = false; }
      doc.body.removeChild(ta); done(ok);
    }
  };

  /* ---------- Time inputs with 12h / 24h support ---------- */
  // Default: 24-hour clock in French, 12-hour (AM/PM) in English and Arabic.
  WH.timeFormat = { use12: WH.store.get('timeFormat', WH.lang === 'fr' ? '24' : '12') === '12' };

  /** Read a time field. Returns {empty}|{error}|{minutes}. */
  WH.readTime = function (fieldWrap) {
    var input = fieldWrap.querySelector('.time-input');
    var sel = fieldWrap.querySelector('.ampm');
    return C.parseTime(input.value, WH.timeFormat.use12, sel.value);
  };

  /** Write minutes into a time field using the current format. */
  WH.writeTime = function (fieldWrap, minutes) {
    var input = fieldWrap.querySelector('.time-input');
    var sel = fieldWrap.querySelector('.ampm');
    if (minutes == null) { input.value = ''; return; }
    var f = C.formatClock(minutes, WH.timeFormat.use12);
    input.value = f.text; sel.value = f.meridiem;
  };

  /**
   * Attach the 12h/24h toggle. `scope` gets class fmt-24 when 24-hour is active.
   * onChange is called after values are converted.
   */
  WH.bindTimeFormat = function (radios, scope, onChange) {
    function apply(use12, convert) {
      var fields = WH.$$('.time-field', scope).map(function (tf) { return tf.parentNode; });
      var values = convert ? fields.map(function (f) { var r = WH.readTime(f); return r.minutes != null ? r.minutes : undefined; }) : [];
      WH.timeFormat.use12 = use12;
      scope.classList.toggle('fmt-24', !use12);
      fields.forEach(function (f, i) {
        var input = f.querySelector('.time-input');
        input.placeholder = use12 ? '9:00' : '09:00';
        if (convert && values[i] !== undefined) WH.writeTime(f, values[i]);
      });
      WH.store.set('timeFormat', use12 ? '12' : '24');
      if (onChange) onChange();
    }
    radios.forEach(function (r) {
      r.checked = (r.value === '12') === WH.timeFormat.use12;
      r.addEventListener('change', function () { if (r.checked) apply(r.value === '12', true); });
    });
    apply(WH.timeFormat.use12, false);
  };

  /* ---------- Site chrome ---------- */
  function initNav() {
    var btn = WH.$('.nav-toggle');
    var nav = WH.$('#main-nav');
    if (!btn || !nav) return;
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.focus();
      }
    });
  }

  function initReveal() {
    var items = WH.$$('.reveal');
    if (!('IntersectionObserver' in window)) { items.forEach(function (i) { i.classList.add('is-visible'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (i) { io.observe(i); });
  }

  function initYear() {
    WH.$$('[data-year]').forEach(function (e) { e.textContent = String(new Date().getFullYear()); });
  }

  function initPrint() {
    WH.$$('[data-print]').forEach(function (b) { b.addEventListener('click', function () { window.print(); }); });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
  function boot() { initNav(); initReveal(); initYear(); initPrint(); }
})();
