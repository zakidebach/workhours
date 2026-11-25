/*!
 * Pay Calculator: hourly rate x hours for a chosen pay period, optional overtime
 * (at the regular rate or an estimated 1.5x), plus equivalents for other periods.
 * No taxes or deductions are applied. English / French / Arabic.
 */
(function () {
  'use strict';
  var WH = window.WH, C = window.WHCalc, t = WH.t;
  var form = WH.$('#pay-form');
  if (!form) return;

  var STORE_KEY = 'pay';
  var f = {
    rate: WH.$('#pay-rate'), hours: WH.$('#pay-hours'), period: WH.$('#pay-period'),
    otOn: WH.$('#pay-ot-on'), ot: WH.$('#pay-ot'), ot15: WH.$('#pay-ot-15')
  };
  var otGroup = WH.$('#pay-ot-group');
  var resultsEl = WH.$('#pay-results');
  var statusEl = WH.$('#pay-status');
  var live = false;

  var MAX_HOURS = { daily: 24, weekly: 168, biweekly: 336, monthly: 744, annually: 8784 };
  function per(p) { return t('per.' + p); }

  function status(msg) { statusEl.innerHTML = msg ? '<div class="alert alert-error">' + WH.esc(msg) + '</div>' : ''; }
  function li(label, value, cls) {
    return '<li' + (cls ? ' class="' + cls + '"' : '') + '><span>' + label + '</span><span class="num">' + value + '</span></li>';
  }

  function syncLabels() {
    var p = per(f.period.value);
    WH.$('#pay-hours-label').textContent = t('pay.hoursLabel', { per: p });
    WH.$('#pay-ot-label').textContent = t('pay.otLabel', { per: p });
    otGroup.hidden = !f.otOn.checked;
  }

  function emptyState() {
    resultsEl.innerHTML = '<h2>' + t('pay.title') + '</h2><p class="results-empty">' + t('pay.empty1') + '</p>' +
      '<p class="results-empty">' + t('pay.empty2') + '</p>';
  }

  function calculate() {
    var errs = [];
    var period = f.period.value;
    var rate = WH.readNumber(f.rate, { required: true, min: 0.01, max: 100000, label: t('pay.rate') });
    var hours = WH.readNumber(f.hours, { required: true, min: 0, max: MAX_HOURS[period], label: t('pay.hours') });
    var ot = { value: 0 };
    if (f.otOn.checked) ot = WH.readNumber(f.ot, { required: true, min: 0, max: MAX_HOURS[period], label: t('pay.ot') });
    else WH.setError(f.ot, null);
    [rate, hours, ot].forEach(function (r) { if (r.error) errs.push(r.error); });
    if (!errs.length && hours.value + ot.value > MAX_HOURS[period]) {
      var msg = t('pay.maxHours', { max: MAX_HOURS[period], per: per(period) });
      WH.setError(f.ot.value && f.otOn.checked ? f.ot : f.hours, msg);
      errs.push(msg);
    }
    if (errs.length) { status(errs.length > 1 ? t('err.fix') : errs[0]); return null; }
    status('');
    var useOt = f.otOn.checked && ot.value > 0;
    var mult = useOt && f.ot15.checked ? 1.5 : 1;
    return {
      period: period, rate: rate.value, hours: hours.value, ot: useOt ? ot.value : 0, mult: mult,
      p: C.payCalc({ rate: rate.value, hours: hours.value, overtimeHours: useOt ? ot.value : 0, overtimeMultiplier: mult, period: period })
    };
  }

  function render(x) {
    var p = x.p, pr = per(x.period);
    var html = '<h2>' + t('pay.title') + '</h2>' +
      '<div class="result-main"><div class="label">' + t('pay.gross', { per: pr }) + '</div><div class="value">' + WH.money(p.gross) + '</div>' +
      '<div class="sub">' + t('pay.before') + ' &middot; ' + t('pay.hoursCount', { h: WH.num(p.totalHours, 2) }) + '</div></div>' +
      '<h3 class="result-h">' + t('pay.how') + '</h3><ul class="result-list">' +
      li(t('pay.regLine', { h: WH.num(x.hours, 2), rate: WH.money(x.rate) }), WH.money(p.regularPay));
    if (x.ot) {
      html += li(t('pay.otLine', { h: WH.num(x.ot, 2), rate: WH.money(p.overtimeRate) }) + ' ' + (x.mult === 1.5 ? t('pay.ot15') : t('pay.otReg')), WH.money(p.overtimePay));
    }
    html += li(t('pay.gross', { per: pr }), WH.money(p.gross), 'total') + '</ul>';
    if (x.ot && x.mult === 1.5) {
      html += '<div class="notice notice-warn" style="margin-top:12px"><p>' + t('pay.otWarn') + '</p></div>';
    }
    html += '<h3 class="result-h">' + t('pay.other') + '</h3><ul class="result-list">';
    Object.keys(C.PERIODS).forEach(function (k) {
      html += li(t('period.' + k), WH.money(p.equivalents[k]), k === x.period ? 'highlight' : '');
    });
    html += '</ul><p class="result-note">' + t('pay.equivNote') + '</p>' +
      '<div class="btn-row no-print" style="margin-top:14px"><a class="btn btn-outline" href="' + form.getAttribute('data-budget-url') + '?income=' + p.equivalents.monthly + '">' + t('pay.toBudget') + '</a></div>';
    resultsEl.innerHTML = html;
  }

  function run(scroll) {
    var x = calculate();
    if (!x) { emptyState(); return false; } // never show stale results next to an error
    render(x); live = true;
    if (scroll) {
      WH.flash(WH.$('.result-main', resultsEl));
      if (window.matchMedia('(max-width: 900px)').matches) resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return true;
  }

  function save() {
    WH.store.set(STORE_KEY, {
      rate: f.rate.value, hours: f.hours.value, period: f.period.value,
      otOn: f.otOn.checked, ot: f.ot.value, ot15: f.ot15.checked, live: live
    });
  }
  function load() {
    var d = WH.store.get(STORE_KEY, null);
    if (d) {
      f.rate.value = d.rate || ''; f.hours.value = d.hours || '';
      if (C.PERIODS[d.period]) f.period.value = d.period;
      f.otOn.checked = !!d.otOn; f.ot.value = d.ot || ''; f.ot15.checked = !!d.ot15;
    }
    // Hours handed over from the Work Hours Calculator (?hours=8.5) -> one day of work.
    var m = /[?&]hours=([\d.]+)/.exec(window.location.search);
    if (m && isFinite(+m[1])) { f.hours.value = WH.inputNum(+m[1]); f.period.value = 'daily'; return !!f.rate.value; }
    return !!(d && d.live);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!run(true)) { var bad = WH.$('[aria-invalid="true"]', form); if (bad) bad.focus(); }
    save();
  });
  form.addEventListener('input', function () { syncLabels(); if (live) run(false); save(); });
  form.addEventListener('change', function () { syncLabels(); if (live) run(false); save(); });
  form.addEventListener('reset', function () {
    setTimeout(function () {
      live = false;
      WH.$$('.input', form).forEach(function (i) { WH.setError(i, null); });
      WH.store.remove(STORE_KEY);
      syncLabels(); status(''); emptyState();
      f.rate.focus();
    }, 0);
  });

  var wasLive = load();
  syncLabels();
  emptyState();
  if (wasLive) run(false);
})();
