/*!
 * Pay Calculator, second mode: "Convert a pay rate".
 * The user enters an amount per minute / hour / day / week / month / year and sees the
 * equivalent for every other period, based on an editable schedule (hours/day, days/week, weeks/year).
 * Only time units are converted; the selected currency is kept as-is (no exchange rates).
 * Also handles the switch between the two Pay Calculator modes.
 */
(function () {
  'use strict';
  var WH = window.WH, C = window.WHCalc, t = WH.t;
  var form = WH.$('#rate-form');
  if (!form) return;

  var STORE_KEY = 'payrate', MODE_KEY = 'paymode';
  var f = {
    amount: WH.$('#rc-amount'), unit: WH.$('#rc-unit'), target: WH.$('#rc-target'),
    hpd: WH.$('#rc-hpd'), dpw: WH.$('#rc-dpw'), wpy: WH.$('#rc-wpy')
  };
  var resultsEl = WH.$('#rc-results');
  var statusEl = WH.$('#rc-status');
  var hoursMode = WH.$('#pay-hours-mode'), convertMode = WH.$('#pay-convert-mode');
  var modeRadios = WH.$$('input[name="pay-mode"]');
  var last = null;

  /* ---------- Mode switch ---------- */
  function setMode(mode, focus) {
    var convert = mode === 'convert';
    convertMode.hidden = !convert;
    hoursMode.hidden = convert;
    modeRadios.forEach(function (r) { r.checked = r.value === (convert ? 'convert' : 'hours'); });
    WH.store.set(MODE_KEY, convert ? 'convert' : 'hours');
    WH.refreshCurrencySymbols(document); // prefix widths can only be measured once visible
    if (focus) (convert ? f.amount : WH.$('#pay-rate')).focus();
  }
  modeRadios.forEach(function (r) {
    r.addEventListener('change', function () { if (r.checked) setMode(r.value, false); });
  });

  /* ---------- Rendering ---------- */
  function li(label, value, cls) {
    return '<li' + (cls ? ' class="' + cls + '"' : '') + '><span>' + label + '</span><span class="num">' + value + '</span></li>';
  }
  function status(msg) { statusEl.innerHTML = msg ? '<div class="alert alert-error">' + WH.esc(msg) + '</div>' : ''; }
  function emptyState() {
    var ex = C.convertRate({ amount: 20, unit: 'hour' });
    resultsEl.innerHTML = '<h2>' + t('rc.title') + '</h2><p class="results-empty">' + t('rc.empty') + '</p>' +
      '<p class="results-empty">' + t('rc.example', { a: WH.money(20), y: WH.money(ex.values.year) }) + '</p>';
  }

  function calculate() {
    var errs = [];
    var amount = WH.readNumber(f.amount, { required: true, min: 0.01, max: C.MAX_MONEY, label: t('rc.amount') });
    var hpd = WH.readNumber(f.hpd, { required: true, min: 0.25, max: 24, label: t('rc.hpd') });
    var dpw = WH.readNumber(f.dpw, { required: true, min: 0.5, max: 7, label: t('rc.dpw') });
    var wpy = WH.readNumber(f.wpy, { required: true, min: 1, max: 53, label: t('rc.wpy') });
    [amount, hpd, dpw, wpy].forEach(function (r) { if (r.error) errs.push(r.error); });
    if (errs.length) { status(errs.length > 1 ? t('err.fix') : errs[0]); return null; }
    status('');
    return {
      amount: amount.value, unit: f.unit.value, target: f.target.value,
      hpd: hpd.value, dpw: dpw.value, wpy: wpy.value,
      r: C.convertRate({ amount: amount.value, unit: f.unit.value, hoursPerDay: hpd.value, daysPerWeek: dpw.value, weeksPerYear: wpy.value })
    };
  }

  function render(x) {
    var r = x.r;
    var html = '<h2>' + t('rc.title') + '</h2>' +
      '<div class="result-main"><div class="label">' + t('rc.equiv', { per: t('pu.' + x.target) }) + '</div>' +
      '<div class="value">' + WH.money(r.values[x.target]) + '</div>' +
      '<div class="sub">' + t('rc.entered', { amount: WH.money(x.amount), per: t('pu.' + x.unit) }) + '</div></div>' +
      '<h3 class="result-h">' + t('rc.all') + '</h3><ul class="result-list">';
    C.RATE_UNITS.forEach(function (u) {
      var label = t('u.' + u) + (u === x.unit ? ' <small>(' + t('rc.yours') + ')</small>' : '');
      html += li(label, WH.money(r.values[u]), u === x.target ? 'highlight' : (u === x.unit ? 'total' : ''));
    });
    html += '</ul>' +
      '<p class="result-note">' + t('rc.basis', {
        h: WH.num(x.hpd, x.hpd % 1 ? 2 : 0), d: WH.num(x.dpw, x.dpw % 1 ? 2 : 0), w: WH.num(x.wpy, x.wpy % 1 ? 2 : 0),
        hy: WH.num(r.hoursPerYear, r.hoursPerYear % 1 ? 2 : 0), wm: WH.num(r.weeksPerMonth, 2)
      }) + '</p>' +
      '<div class="notice notice-warn" style="margin-top:12px"><p>' + t('rc.note') + '</p></div>' +
      '<div class="btn-row no-print" style="margin-top:14px"><button type="button" class="btn btn-outline" id="rc-use-hourly">' + t('rc.useHourly') + '</button></div>';
    resultsEl.innerHTML = html;
    WH.$('#rc-use-hourly').addEventListener('click', function () {
      var hourly = Math.round(r.values.hour * 100) / 100;
      var rate = WH.$('#pay-rate');
      rate.value = WH.inputNum(hourly);
      setMode('hours', false);
      rate.dispatchEvent(new Event('input', { bubbles: true }));
      rate.focus();
    });
  }

  function run(scroll) {
    if (f.amount.value.trim() === '') { // nothing to convert yet: no error, just the explanation
      WH.setError(f.amount, null); emptyState(); last = null;
      // Still check the schedule fields so mistakes show right away.
      var bad = [WH.readNumber(f.hpd, { required: true, min: 0.25, max: 24, label: t('rc.hpd') }),
        WH.readNumber(f.dpw, { required: true, min: 0.5, max: 7, label: t('rc.dpw') }),
        WH.readNumber(f.wpy, { required: true, min: 1, max: 53, label: t('rc.wpy') })].filter(function (r) { return r.error; });
      status(bad.length ? bad[0].error : '');
      return false;
    }
    var x = calculate();
    if (!x) { emptyState(); last = null; return false; } // never show stale results next to an error
    render(x); last = x;
    if (scroll) {
      WH.flash(WH.$('.result-main', resultsEl));
      if (window.matchMedia('(max-width: 900px)').matches) resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return true;
  }

  /* ---------- Persistence ---------- */
  function save() {
    var d = {};
    Object.keys(f).forEach(function (k) { d[k] = f[k].value; });
    WH.store.set(STORE_KEY, d);
  }
  function load() {
    var d = WH.store.get(STORE_KEY, null);
    if (!d) return;
    Object.keys(f).forEach(function (k) {
      if (d[k] == null || d[k] === '') return;
      if (f[k].tagName === 'SELECT' && C.RATE_UNITS.indexOf(d[k]) === -1) return;
      f[k].value = d[k];
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (f.amount.value.trim() === '') {
      WH.readNumber(f.amount, { required: true, label: t('rc.amount') });
      status(t('err.required', { label: t('rc.amount') }));
      f.amount.focus();
      return;
    }
    if (!run(true)) { var bad = WH.$('[aria-invalid="true"]', form); if (bad) bad.focus(); }
    save();
  });
  form.addEventListener('input', function () { run(false); save(); });
  form.addEventListener('change', function () { run(false); save(); });
  form.addEventListener('reset', function () {
    setTimeout(function () { // defaults come back from the HTML: 8 h/day, 5 days/week, 52 weeks/year
      WH.$$('.input', form).forEach(function (i) { WH.setError(i, null); });
      WH.store.remove(STORE_KEY);
      status(''); emptyState(); f.amount.focus();
    }, 0);
  });

  // Same numbers in a new currency: only the display changes.
  WH.onCurrency(function () { if (last) run(false); else emptyState(); });

  load();
  var startMode = window.location.hash === '#convert' ? 'convert' : WH.store.get(MODE_KEY, 'hours');
  setMode(startMode, false);
  run(false);
})();
