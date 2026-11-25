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

  /* ---------- Currency (display only: amounts are never converted) ---------- */
  // Money is formatted for the page language: en-US, fr-FR, or Arabic with Western digits.
  var MONEY_LOCALE = WH.lang === 'fr' ? 'fr-FR' : (WH.lang === 'ar' ? 'ar-u-nu-latn' : 'en-US');
  var CUR_KEY = 'wh:currency'; // shared by all languages
  var curListeners = [];
  var moneyFmt = null;

  function knownCodes() { return (window.WH_CURRENCIES || []).map(function (c) { return c[0]; }); }
  function validCode(code) {
    if (!/^[A-Z]{3}$/.test(code || '')) return false;
    var list = knownCodes();
    if (list.length && list.indexOf(code) === -1) return false;
    try { new Intl.NumberFormat('en', { style: 'currency', currency: code }); return true; } catch (e) { return false; }
  }
  function readCurrency() {
    try { var c = window.localStorage.getItem(CUR_KEY); if (validCode(c)) return c; } catch (e) { /* storage unavailable */ }
    return 'USD'; // default currency
  }
  function buildFormatter() {
    try { moneyFmt = new Intl.NumberFormat(MONEY_LOCALE, { style: 'currency', currency: WH.currency }); }
    catch (e) { WH.currency = 'USD'; moneyFmt = new Intl.NumberFormat(MONEY_LOCALE, { style: 'currency', currency: 'USD' }); }
  }
  WH.currency = readCurrency();
  buildFormatter();

  /** Formatted amount as HTML (isolated so it reads correctly inside Arabic text). */
  WH.money = function (n) { return '<bdi>' + WH.esc(moneyFmt.format(n || 0)) + '</bdi>'; };
  /** Formatted amount as plain text (for attributes, aria-labels, copy). */
  WH.moneyText = function (n) { return moneyFmt.format(n || 0); };

  /** Short symbol for a currency: local symbol table, else the browser's narrow symbol, else the code. */
  WH.curSymbol = function (code) {
    code = code || WH.currency;
    var own = window.WH_CURRENCY_SYMBOLS && window.WH_CURRENCY_SYMBOLS[code];
    if (own) return own;
    try {
      var part = new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
        .formatToParts(0).filter(function (p) { return p.type === 'currency'; })[0];
      return part ? part.value : code;
    } catch (e) { return code; }
  };
  var displayNames = null;
  try { displayNames = new Intl.DisplayNames([WH.lang], { type: 'currency' }); } catch (e) { displayNames = null; }
  /** Currency name in the page language (falls back to the English name from currencies.js). */
  WH.curName = function (code, english) {
    var n = null;
    try { n = displayNames ? displayNames.of(code) : null; } catch (e) { n = null; }
    if (!n || n === code) n = english || code;
    return n.charAt(0).toUpperCase() + n.slice(1);
  };
  /** "US Dollar (USD – $)" or "Swiss Franc (CHF)" when the symbol is just the code. */
  WH.curLabel = function (code, english) {
    var sym = WH.curSymbol(code);
    // U+2068/U+2069 isolate the symbol so right-to-left symbols (ر.س) don't flip the closing bracket.
    return WH.curName(code, english) + ' (' + code + (sym && sym !== code ? ' – ⁨' + sym + '⁩' : '') + ')';
  };
  WH.onCurrency = function (fn) { curListeners.push(fn); };
  WH.setCurrency = function (code) {
    if (!validCode(code) || code === WH.currency) return;
    WH.currency = code;
    buildFormatter();
    try { window.localStorage.setItem(CUR_KEY, code); } catch (e) { /* storage unavailable */ }
    WH.refreshCurrencySymbols(doc);
    WH.$$('[data-currency-picker]').forEach(function (el) { if (el._sync) el._sync(); });
    curListeners.forEach(function (fn) { fn(code); });
  };
  /** Put the current symbol in every input prefix and make room for it. */
  WH.refreshCurrencySymbols = function (scope) {
    var sym = WH.curSymbol();
    WH.$$('.cur-sym', scope || doc).forEach(function (span) {
      span.textContent = sym;
      var input = span.parentNode.querySelector('.input');
      if (input) input.style.paddingLeft = Math.max(28, Math.ceil(span.getBoundingClientRect().width) + 20) + 'px';
    });
  };

  function normalize(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[ً-ْ]/g, ''); // also ignore Arabic diacritics
  }

  /**
   * Searchable currency picker (ARIA combobox). Mount into <div data-currency-picker></div>.
   * Type a name ("euro", "dinar", "دولار"), a code ("EUR") or a symbol ("€") to filter.
   */
  WH.mountCurrencyPicker = function (host) {
    var data = window.WH_CURRENCIES;
    if (!host || !data) return;
    var id = WH.uid('cur');
    var items = data.map(function (c) {
      var label = WH.curLabel(c[0], c[1]);
      return { code: c[0], label: label, search: normalize(label + ' ' + c[1] + ' ' + c[0] + ' ' + WH.curSymbol(c[0])) };
    }).sort(function (a, b) { return a.label.localeCompare(b.label, WH.lang); });
    host.classList.add('field', 'cur-field');
    host.innerHTML =
      '<label for="' + id + '">' + WH.t('cur.label') + '</label>' +
      '<div class="combo">' +
      '<input id="' + id + '" class="input combo-input" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" ' +
      'aria-controls="' + id + '-list" autocomplete="off" spellcheck="false" aria-describedby="' + id + '-note">' +
      '<svg class="combo-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>' +
      '<ul id="' + id + '-list" class="combo-list" role="listbox" aria-label="' + WH.esc(WH.t('cur.label')) + '" hidden></ul>' +
      '</div>' +
      '<span class="hint" id="' + id + '-note">' + WH.t('cur.note') + '</span>';
    var input = host.querySelector('input'), list = host.querySelector('ul');
    var shown = [], active = -1, open = false;

    function current() { for (var i = 0; i < items.length; i++) if (items[i].code === WH.currency) return items[i]; return items[0]; }
    function sync() { if (!open) input.value = current().label; }
    host._sync = sync;

    function render(filter) {
      var q = normalize(filter).trim();
      shown = q ? items.filter(function (it) { return it.search.indexOf(q) !== -1; }) : items.slice();
      if (q) { // exact code match first
        shown.sort(function (a, b) { return (b.code.toLowerCase() === q) - (a.code.toLowerCase() === q); });
      }
      list.innerHTML = shown.length ? shown.map(function (it, i) {
        var sel = it.code === WH.currency;
        return '<li id="' + id + '-o' + i + '" role="option" class="combo-opt' + (sel ? ' selected' : '') + '" aria-selected="' + sel + '" data-code="' + it.code + '">' +
          WH.esc(it.label) + '</li>';
      }).join('') : '<li class="combo-empty" role="option" aria-disabled="true">' + WH.t('cur.none') + '</li>';
      setActive(q ? 0 : Math.max(0, shown.indexOf(current())));
    }
    function setActive(i) {
      var opts = list.querySelectorAll('.combo-opt');
      if (!opts.length) { active = -1; input.removeAttribute('aria-activedescendant'); return; }
      active = Math.max(0, Math.min(i, opts.length - 1));
      for (var k = 0; k < opts.length; k++) opts[k].classList.toggle('active', k === active);
      input.setAttribute('aria-activedescendant', opts[active].id);
      var o = opts[active], top = o.offsetTop, bottom = top + o.offsetHeight;
      if (top < list.scrollTop) list.scrollTop = top; else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
    }
    function openList() {
      if (open) return;
      open = true; list.hidden = false; input.setAttribute('aria-expanded', 'true'); host.classList.add('open');
      input.value = ''; input.placeholder = WH.t('cur.search');
      render('');
    }
    function closeList() {
      if (!open) return;
      open = false; list.hidden = true; input.setAttribute('aria-expanded', 'false'); host.classList.remove('open');
      input.removeAttribute('aria-activedescendant'); input.placeholder = '';
      sync();
    }
    function choose(code) { closeList(); WH.setCurrency(code); sync(); }

    input.addEventListener('focus', openList);
    input.addEventListener('click', openList);
    input.addEventListener('input', function (e) {
      e.stopPropagation();
      var typed = input.value; // keep what was typed even if the list was closed (e.g. typing right after a choice)
      if (!open) { openList(); input.value = typed; }
      render(typed);
    });
    input.addEventListener('change', function (e) { e.stopPropagation(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) openList(); else setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (open) setActive(active - 1); }
      else if (e.key === 'Home' && open) { e.preventDefault(); setActive(0); }
      else if (e.key === 'End' && open) { e.preventDefault(); setActive(shown.length - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); if (open && active >= 0 && shown[active]) choose(shown[active].code); }
      else if (e.key === 'Escape') { if (open) { e.preventDefault(); closeList(); } }
      else if (e.key === 'Tab') { closeList(); }
    });
    input.addEventListener('blur', function () { setTimeout(closeList, 120); });
    list.addEventListener('mousedown', function (e) { e.preventDefault(); }); // keep focus on the input
    list.addEventListener('click', function (e) {
      var li = e.target.closest('.combo-opt');
      if (li) choose(li.getAttribute('data-code'));
    });
    var form = host.closest('form');
    if (form) form.addEventListener('reset', function () { setTimeout(sync, 0); }); // Reset keeps the chosen currency
    sync();
  };
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
  function initCurrency() {
    WH.$$('[data-currency-picker]').forEach(WH.mountCurrencyPicker);
    WH.refreshCurrencySymbols(doc);
  }

  function boot() { initNav(); initReveal(); initYear(); initPrint(); }
  // currencies.js loads after this file, so mount the picker once every deferred script has run.
  if (doc.readyState === 'complete') initCurrency(); else doc.addEventListener('DOMContentLoaded', initCurrency);
})();
