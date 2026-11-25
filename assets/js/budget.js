/*!
 * Salary Breakdown: split a monthly salary across editable expense categories.
 * Shows totals, remaining money, each category's share, savings rate and a donut chart.
 * Everything stays in the browser (localStorage only). English / French / Arabic.
 */
(function () {
  'use strict';
  var WH = window.WH, C = window.WHCalc, t = WH.t;
  var root = WH.$('#budget');
  if (!root) return;

  var STORE_KEY = 'budget';
  var MAX_CATEGORIES = 20;
  // Categorical palette, assigned in fixed order (validated set). Slot 0 = folded into "Other".
  var COLORS = [null, '#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
  var OTHER_COLOR = '#8a8985';
  var LEFT_COLOR = '#e4e3df';
  var DEFAULTS = [
    ['bd.cat.rent', false], ['bd.cat.food', false], ['bd.cat.taxes', false], ['bd.cat.transport', false], ['bd.cat.bills', false],
    ['bd.cat.shopping', false], ['bd.cat.savings', true], ['bd.cat.fun', false], ['bd.cat.other', false]
  ];

  var incomeIn = WH.$('#bd-income');
  var listEl = WH.$('#bd-list');
  var resultsEl = WH.$('#bd-results');
  var statusEl = WH.$('#bd-status');
  var addBtn = WH.$('#bd-add');
  var addSavingsBtn = WH.$('#bd-add-savings');
  var items = [];
  var nextId = 1;

  var ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  /* ---------- Model ---------- */
  function freeSlot() {
    var used = items.map(function (i) { return i.slot; });
    for (var s = 1; s < COLORS.length; s++) if (used.indexOf(s) === -1) return s;
    return 0;
  }
  function makeItem(name, savings, amount, slot) {
    var it = { id: nextId++, name: name, savings: !!savings, amount: amount || '' };
    it.slot = slot == null ? freeSlot() : slot;
    return it;
  }
  function defaults() {
    items = [];
    DEFAULTS.forEach(function (d) { items.push(makeItem(t(d[0]), d[1], '')); });
  }
  function colorOf(it) { return it.slot ? COLORS[it.slot] : OTHER_COLOR; }

  /* ---------- Rows ---------- */
  function renderRows() {
    listEl.innerHTML = '';
    items.forEach(function (it) {
      var row = WH.el('div', { class: 'bd-row', 'data-id': it.id });
      var nid = 'bd-n-' + it.id, aid = 'bd-a-' + it.id, eid = 'bd-e-' + it.id;
      var nm = WH.esc(it.name || t('bd.thisCat'));
      row.innerHTML =
        '<span class="swatch" style="background:' + colorOf(it) + '" aria-hidden="true"></span>' +
        '<div class="bd-name"><label class="sr-only" for="' + nid + '">' + t('bd.catName') + '</label>' +
        '<input id="' + nid + '" class="input bd-name-in" type="text" maxlength="40" placeholder="' + WH.esc(t('bd.catName')) + '">' +
        (it.savings ? '<span class="badge badge-green">' + t('bd.savings') + '</span>' : '') + '</div>' +
        '<div class="bd-amount"><label class="sr-only" for="' + aid + '">' + t('bd.amountFor', { name: nm }) + '</label>' +
        '<div class="input-prefix"><span class="cur-sym">' + WH.esc(WH.curSymbol()) + '</span><input id="' + aid + '" class="input bd-amount-in" type="text" inputmode="decimal" autocomplete="off" placeholder="' + WH.inputNum('0.00') + '" aria-describedby="' + eid + '"></div></div>' +
        '<span class="bd-share">0%</span>' +
        '<button type="button" class="btn btn-danger-ghost btn-icon bd-del" aria-label="' + WH.esc(t('bd.delete', { name: it.name || t('bd.category') })) + '" title="' + WH.esc(t('bd.deleteTitle')) + '">' + ICON_X + '</button>' +
        '<span class="field-error bd-err" id="' + eid + '"></span>';
      row.querySelector('.bd-name-in').value = it.name;
      row.querySelector('.bd-amount-in').value = it.amount;
      listEl.appendChild(row);
    });
    addBtn.disabled = items.length >= MAX_CATEGORIES;
    addSavingsBtn.hidden = items.some(function (i) { return i.savings; });
    WH.refreshCurrencySymbols(listEl);
  }

  function itemFor(el) {
    var row = el.closest('.bd-row');
    if (!row) return null;
    var id = +row.getAttribute('data-id');
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return { item: items[i], row: row, index: i };
    return null;
  }

  /* ---------- Calculation ---------- */
  function compute() {
    var errors = 0;
    var inc = WH.readNumber(incomeIn, { min: 0, max: C.MAX_MONEY, label: t('bd.income') });
    if (inc.error) errors++;
    var values = items.map(function (it) {
      var input = WH.$('.bd-row[data-id="' + it.id + '"] .bd-amount-in', listEl);
      var r = WH.readNumber(input, { min: 0, max: C.MAX_MONEY, label: t('bd.amount') });
      if (r.error) { errors++; return 0; }
      return r.value;
    });
    var income = inc.error ? 0 : inc.value;
    var summary = C.budgetSummary(income, items.map(function (it, i) { return { amount: values[i], savings: it.savings }; }));
    return { errors: errors, income: income, incomeEmpty: incomeIn.value.trim() === '', values: values, s: summary };
  }

  var pct = WH.pct;

  function li(label, value, cls) {
    return '<li' + (cls ? ' class="' + cls + '"' : '') + '><span>' + label + '</span><span class="num">' + value + '</span></li>';
  }

  function render(x) {
    var s = x.s;
    items.forEach(function (it, i) {
      var el = WH.$('.bd-row[data-id="' + it.id + '"] .bd-share', listEl);
      if (el) el.textContent = x.income > 0 ? pct(s.shares[i]) : '–';
    });

    statusEl.innerHTML = x.errors ? '<div class="alert alert-error">' + t('bd.fixAmounts') + '</div>' : '';

    if (x.incomeEmpty && s.allocated === 0) {
      resultsEl.innerHTML = '<h2>' + t('bd.title') + '</h2><p class="results-empty">' + t('bd.empty1') + '</p>' +
        '<p class="results-empty">' + t('bd.empty2') + '</p>';
      return;
    }

    var html = '<h2>' + t('bd.title') + '</h2>';
    if (s.over) {
      html += '<div class="alert alert-error bd-over" role="alert">' + t('bd.over', { amt: WH.money(-s.remaining) }) + '</div>';
    } else if (x.incomeEmpty || x.income === 0) {
      html += '<div class="alert alert-error" role="alert">' + t('bd.needIncome') + '</div>';
    }

    html += '<ul class="result-list">' +
      li(t('bd.income'), WH.money(s.income)) +
      li(t('bd.expenses'), WH.money(s.expenses) + (x.income > 0 ? ' <small>(' + pct(s.expenseRate) + ')</small>' : '')) +
      li(t('bd.savings'), WH.money(s.savings)) +
      li(s.over ? t('bd.short') : t('bd.left'), WH.money(Math.abs(s.remaining)), 'total' + (s.over ? ' negative' : '')) +
      '</ul>';

    html += '<div class="bd-rate"><div><span class="label">' + t('bd.rate') + '</span><strong>' + (x.income > 0 ? pct(s.savingsRate) : '–') + '</strong></div>' +
      '<div><span class="label">' + t('bd.unassigned') + '</span><strong>' + (x.income > 0 ? pct(Math.max(0, s.remainingRate)) : '–') + '</strong></div></div>';

    html += chart(x);
    resultsEl.innerHTML = html;
    bindChart();
  }

  /* ---------- Donut chart (SVG, no library) ---------- */
  function slices(x) {
    var s = x.s, out = [], other = 0, otherNames = [];
    items.forEach(function (it, i) {
      var v = x.values[i];
      if (v <= 0) return;
      if (it.slot) out.push({ name: it.name || t('bd.untitled'), value: v, color: COLORS[it.slot] });
      else { other += v; otherNames.push(it.name || t('bd.untitled')); }
    });
    if (other > 0) out.push({ name: otherNames.length === 1 ? otherNames[0] : t('bd.otherCats'), value: other, color: OTHER_COLOR });
    if (!s.over && s.remaining > 0) out.push({ name: t('bd.left'), value: s.remaining, color: LEFT_COLOR, left: true });
    return out;
  }

  function arcPath(cx, cy, r0, r1, a0, a1) {
    var large = a1 - a0 > Math.PI ? 1 : 0;
    function pt(r, a) { return (cx + r * Math.sin(a)).toFixed(2) + ' ' + (cy - r * Math.cos(a)).toFixed(2); }
    if (a1 - a0 >= Math.PI * 2 - 1e-6) { // full ring: two halves
      return 'M' + pt(r1, 0) + 'A' + r1 + ' ' + r1 + ' 0 1 1 ' + pt(r1, Math.PI) + 'A' + r1 + ' ' + r1 + ' 0 1 1 ' + pt(r1, 0) +
        'M' + pt(r0, 0) + 'A' + r0 + ' ' + r0 + ' 0 1 0 ' + pt(r0, Math.PI) + 'A' + r0 + ' ' + r0 + ' 0 1 0 ' + pt(r0, 0) + 'Z';
    }
    return 'M' + pt(r1, a0) + 'A' + r1 + ' ' + r1 + ' 0 ' + large + ' 1 ' + pt(r1, a1) +
      'L' + pt(r0, a1) + 'A' + r0 + ' ' + r0 + ' 0 ' + large + ' 0 ' + pt(r0, a0) + 'Z';
  }

  function chart(x) {
    var sl = slices(x);
    var total = sl.reduce(function (a, b) { return a + b.value; }, 0);
    if (total <= 0) return '<p class="result-note">' + t('bd.noChart') + '</p>';
    var base = x.s.over ? total : Math.max(total, x.income);
    var cx = 110, cy = 110, r1 = 100, r0 = 64, a = 0, paths = '', rows = '';
    sl.forEach(function (d, i) {
      var a1 = a + (d.value / total) * Math.PI * 2;
      var share = base > 0 ? d.value / base : 0;
      var label = d.name + ': ' + WH.moneyText(d.value) + ' (' + pct(share) + ')';
      paths += '<path class="slice" d="' + arcPath(cx, cy, r0, r1, a, a1) + '" fill="' + d.color + '" tabindex="0" role="img" aria-label="' + WH.esc(label) +
        '" data-name="' + WH.esc(d.name) + '" data-value="' + WH.esc(WH.moneyText(d.value)) + '" data-share="' + WH.esc(pct(share)) + '" data-i="' + i + '"><title>' + WH.esc(label) + '</title></path>';
      rows += '<tr data-i="' + i + '"><td><span class="swatch" style="background:' + d.color + '"></span>' + WH.esc(d.name) + '</td><td>' + WH.money(d.value) + '</td><td>' + pct(share) + '</td></tr>';
      a = a1;
    });
    var centerLabel = x.s.over ? t('bd.centerSpend') : t('bd.left');
    var centerValue = x.s.over ? WH.moneyText(total) : WH.moneyText(Math.max(0, x.s.remaining));
    return '<figure class="donut-wrap">' +
      '<figcaption class="donut-title">' + t('bd.chartTitle') + (x.s.over ? ' <small>' + t('bd.chartOver') + '</small>' : '') + '</figcaption>' +
      '<div class="donut"><svg viewBox="0 0 220 220" role="group" aria-label="' + WH.esc(t('bd.chartAria')) + '">' + paths + '</svg>' +
      '<div class="donut-center" aria-hidden="true"><span class="dc-label" data-default="' + WH.esc(centerLabel) + '">' + WH.esc(centerLabel) + '</span>' +
      '<strong class="dc-value" data-default="' + WH.esc(centerValue) + '" dir="ltr">' + WH.esc(centerValue) + '</strong>' +
      '<span class="dc-share" data-default=""></span></div></div>' +
      '<table class="donut-table"><caption class="sr-only">' + t('bd.tableCaption') + '</caption><thead><tr><th scope="col">' + t('bd.colCat') + '</th><th scope="col">' + t('bd.colAmt') + '</th><th scope="col">' + (x.s.over ? t('bd.colPctSpend') : t('bd.colPctInc')) + '</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '</figure>';
  }

  function bindChart() {
    var center = WH.$('.donut-center', resultsEl);
    if (!center) return;
    var lab = WH.$('.dc-label', center), val = WH.$('.dc-value', center), sh = WH.$('.dc-share', center);
    function show(el) {
      lab.textContent = el.getAttribute('data-name'); val.textContent = el.getAttribute('data-value'); sh.textContent = el.getAttribute('data-share');
      WH.$$('.slice', resultsEl).forEach(function (p) { p.classList.toggle('dim', p !== el); });
      WH.$$('.donut-table tr', resultsEl).forEach(function (r) { r.classList.toggle('active', r.getAttribute('data-i') === el.getAttribute('data-i')); });
    }
    function reset() {
      [lab, val, sh].forEach(function (e) { e.textContent = e.getAttribute('data-default'); });
      WH.$$('.slice', resultsEl).forEach(function (p) { p.classList.remove('dim'); });
      WH.$$('.donut-table tr', resultsEl).forEach(function (r) { r.classList.remove('active'); });
    }
    WH.$$('.slice', resultsEl).forEach(function (p) {
      p.addEventListener('mouseenter', function () { show(p); });
      p.addEventListener('focus', function () { show(p); });
      p.addEventListener('mouseleave', reset);
      p.addEventListener('blur', reset);
    });
    WH.$$('.donut-table tbody tr', resultsEl).forEach(function (r) {
      r.addEventListener('mouseenter', function () { var p = WH.$('.slice[data-i="' + r.getAttribute('data-i') + '"]', resultsEl); if (p) show(p); });
      r.addEventListener('mouseleave', reset);
    });
  }

  /* ---------- Persistence ---------- */
  function save() {
    WH.store.set(STORE_KEY, {
      income: incomeIn.value,
      items: items.map(function (it) { return { name: it.name, amount: it.amount, savings: it.savings, slot: it.slot }; })
    });
  }
  function load() {
    var d = WH.store.get(STORE_KEY, null);
    if (d && Array.isArray(d.items)) {
      items = [];
      d.items.slice(0, MAX_CATEGORIES).forEach(function (x) {
        var slot = typeof x.slot === 'number' && x.slot >= 0 && x.slot < COLORS.length ? x.slot : null;
        items.push(makeItem(String(x.name || '').slice(0, 40), x.savings, String(x.amount || '').slice(0, 20), slot));
      });
      incomeIn.value = d.income || '';
    } else defaults();
    var m = /[?&]income=([\d.]+)/.exec(window.location.search);
    if (m && isFinite(+m[1])) incomeIn.value = WH.inputNum(+m[1]);
  }

  function update() { render(compute()); save(); }

  /* ---------- Events ---------- */
  listEl.addEventListener('input', function (e) {
    var found = itemFor(e.target);
    if (!found) return;
    if (e.target.classList.contains('bd-name-in')) {
      found.item.name = e.target.value;
      found.row.querySelector('.bd-del').setAttribute('aria-label', t('bd.delete', { name: e.target.value || t('bd.category') }));
    } else found.item.amount = e.target.value;
    update();
  });

  listEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.bd-del');
    if (!btn) return;
    var found = itemFor(btn);
    if (!found) return;
    items.splice(found.index, 1);
    renderRows();
    update();
    // Keep keyboard focus in the list after deleting.
    var rows = WH.$$('.bd-row', listEl);
    var target = rows[Math.min(found.index, rows.length - 1)];
    (target ? target.querySelector('.bd-del') : addBtn).focus();
  });

  incomeIn.addEventListener('input', update);

  addBtn.addEventListener('click', function () {
    if (items.length >= MAX_CATEGORIES) return;
    items.push(makeItem('', false, ''));
    renderRows(); update();
    WH.$$('.bd-name-in', listEl).pop().focus();
  });

  addSavingsBtn.addEventListener('click', function () {
    items.push(makeItem(t('bd.cat.savings'), true, ''));
    renderRows(); update();
    WH.$$('.bd-amount-in', listEl).pop().focus();
  });

  WH.$('#bd-reset').addEventListener('click', function () {
    if (!window.confirm(t('bd.resetConfirm'))) return;
    WH.store.remove(STORE_KEY);
    incomeIn.value = '';
    WH.setError(incomeIn, null);
    nextId = 1; defaults(); renderRows(); update();
    incomeIn.focus();
  });

  // A new currency only changes how amounts are shown: same numbers, no conversion.
  WH.onCurrency(update);

  load();
  renderRows();
  update();
})();
