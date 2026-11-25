/*!
 * Work Hours Calculator: start time, end time, break -> total, break, net hours.
 * Supports 12/24-hour input, shifts that cross midnight, and English/French/Arabic.
 */
(function () {
  'use strict';
  var WH = window.WH, C = window.WHCalc, t = WH.t;
  var form = WH.$('#wh-form');
  if (!form) return;

  var STORE_KEY = 'workhours';
  var startF = WH.$('#wh-start-field'), endF = WH.$('#wh-end-field');
  var startIn = WH.$('.time-input', startF), endIn = WH.$('.time-input', endF);
  var breakIn = WH.$('#wh-break'), unitIn = WH.$('#wh-break-unit');
  var resultsEl = WH.$('#wh-results');
  var statusEl = WH.$('#wh-status');
  var live = false; // becomes true after the first successful Calculate

  function status(msg) {
    statusEl.innerHTML = msg ? '<div class="alert alert-error">' + WH.esc(msg) + '</div>' : '';
  }

  function emptyState() {
    resultsEl.innerHTML = '<h2>' + t('wh.title') + '</h2>' +
      '<p class="results-empty">' + t('wh.empty1') + '</p>' +
      '<p class="results-empty">' + t('wh.empty2') + '</p>';
  }

  function li(label, value, cls) {
    return '<li' + (cls ? ' class="' + cls + '"' : '') + '><span>' + label + '</span><span class="num">' + value + '</span></li>';
  }
  function dec(min) { return WH.num(C.toDecimalHours(min), 2); }

  /** Validate every field. Returns the calculation or null (and shows errors). */
  function calculate() {
    var errors = [];
    var s = WH.readTime(startF), e = WH.readTime(endF);
    var sErr = s.empty ? t('wh.needStart') : (s.error ? WH.err(s.error) : null);
    var eErr = e.empty ? t('wh.needEnd') : (e.error ? WH.err(e.error) : null);
    WH.setError(startIn, sErr); WH.setError(endIn, eErr);
    if (sErr) errors.push(sErr);
    if (eErr) errors.push(eErr);

    var unit = unitIn.value;
    var b = WH.readNumber(breakIn, { min: 0, max: unit === 'hours' ? 23.99 : 1439, label: t('wh.break') });
    if (b.error) errors.push(b.error);
    if (errors.length) { status(errors.length > 1 ? t('err.fix') : errors[0]); return null; }

    var breakMin = Math.round(unit === 'hours' ? b.value * 60 : b.value);
    var r = C.workShift(s.minutes, e.minutes, breakMin);
    if (r.error) {
      var msg = WH.err(r.error, { brk: WH.hmWords(r.breakMin || 0), span: WH.hmWords(r.span || 0) });
      WH.setError(r.field === 'break' ? breakIn : endIn, msg);
      status(msg);
      return null;
    }
    status('');
    return { r: r, start: s.minutes, end: e.minutes };
  }

  function render(x) {
    var r = x.r, use12 = WH.timeFormat.use12;
    var amPm = { AM: WH.$('.ampm option[value="AM"]', startF).textContent, PM: WH.$('.ampm option[value="PM"]', startF).textContent };
    function clock(m) { var f = C.formatClock(m, use12); return '<bdi>' + f.text + (use12 ? ' ' + amPm[f.meridiem] : '') + '</bdi>'; }
    resultsEl.innerHTML = '<h2>' + t('wh.title') + '</h2>' +
      '<div class="result-main"><div class="label">' + t('wh.net') + '</div>' +
      '<div class="value"><bdi>' + C.formatHM(r.net) + '</bdi></div>' +
      '<div class="sub">' + WH.hmWords(r.net) + ' &middot; <strong>' + dec(r.net) + '</strong> ' + t('wh.decimal') + '</div></div>' +
      (r.overnight ? '<p class="badge-line"><span class="badge">' + t('wh.overnight') + '</span> ' + t('wh.overnightNote') + '</p>' : '') +
      '<ul class="result-list">' +
      li(t('wh.shift'), clock(x.start) + ' &ndash; ' + clock(x.end)) +
      li(t('wh.total'), '<bdi>' + C.formatHM(r.span) + '</bdi> <small>(' + dec(r.span) + ')</small>') +
      li(t('wh.break'), '<bdi>&minus;' + C.formatHM(r.breakMin) + '</bdi> <small>(' + dec(r.breakMin) + ')</small>') +
      li(t('wh.net'), '<bdi>' + C.formatHM(r.net) + '</bdi> <small>(' + dec(r.net) + ')</small>', 'total') +
      '</ul>' +
      '<div class="btn-row no-print" style="margin-top:18px">' +
      '<a class="btn btn-outline" id="wh-to-pay" href="' + form.getAttribute('data-pay-url') + '?hours=' + C.toDecimalHours(r.net) + '">' + t('wh.toPay') + '</a></div>' +
      '<p class="result-note">' + t('wh.note') + '</p>';
  }

  function run(scroll) {
    var x = calculate();
    if (!x) { emptyState(); return false; } // never show stale results next to an error
    render(x);
    live = true;
    if (scroll) {
      WH.flash(WH.$('.result-main', resultsEl));
      if (window.matchMedia('(max-width: 900px)').matches) resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return true;
  }

  function save() {
    WH.store.set(STORE_KEY, {
      s: startIn.value, sm: WH.$('.ampm', startF).value,
      e: endIn.value, em: WH.$('.ampm', endF).value,
      b: breakIn.value, u: unitIn.value, live: live
    });
  }

  function load() {
    var d = WH.store.get(STORE_KEY, null);
    if (!d) return false;
    startIn.value = d.s || ''; WH.$('.ampm', startF).value = d.sm === 'PM' ? 'PM' : 'AM';
    endIn.value = d.e || ''; WH.$('.ampm', endF).value = d.em === 'AM' ? 'AM' : 'PM';
    breakIn.value = d.b || ''; unitIn.value = d.u === 'hours' ? 'hours' : 'minutes';
    return !!d.live;
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (!run(true)) {
      var bad = WH.$('[aria-invalid="true"]', form);
      if (bad) bad.focus();
    }
    save();
  });

  // After results are shown, keep them in sync with every change.
  form.addEventListener('input', function () { if (live) run(false); save(); });
  form.addEventListener('change', function () { if (live) run(false); save(); });

  form.addEventListener('reset', function () {
    setTimeout(function () {
      live = false;
      [startIn, endIn, breakIn].forEach(function (i) { WH.setError(i, null); });
      WH.$('.ampm', startF).value = 'AM'; WH.$('.ampm', endF).value = 'PM';
      WH.store.remove(STORE_KEY);
      status(''); emptyState();
      startIn.focus();
    }, 0);
  });

  var wasLive = load();
  WH.bindTimeFormat(WH.$$('input[name="wh-format"]', form), form, function () { if (live) run(false); save(); });
  emptyState();
  if (wasLive) run(false);
})();
