/*!
 * WorkHours calculation engine (pure functions, no DOM).
 * Every calculation on the site runs locally in the browser through this file.
 * Exposed as window.WHCalc (and module.exports when available, for testing).
 */
(function (root) {
  'use strict';

  var MIN_PER_DAY = 1440;
  var MAX_MONEY = 1e9; // $1 billion: upper bound for any money input

  /* ---------- Numbers ---------- */

  /** Convert Arabic-Indic / Persian digits and Arabic separators to ASCII. */
  function normalizeDigits(s) {
    return String(s == null ? '' : s)
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); })
      .replace(/٫/g, '.')      // Arabic decimal separator
      .replace(/[٬،]/g, ','); // Arabic thousands separator / comma
  }

  /**
   * Parse a user-entered number. Returns NaN when invalid, null when empty.
   * decimalComma=false (English, Arabic): "1,250.50" -> 1250.5
   * decimalComma=true  (French): "1 250,50" -> 1250.5 (a "." is also accepted as decimal point)
   */
  function parseNumber(raw, decimalComma) {
    var s = normalizeDigits(raw).trim().replace(/[$\s  ]/g, '').replace(/US$/i, '');
    if (decimalComma) {
      if (s.indexOf(',') !== -1) s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
    if (s === '') return null;
    if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    return parseFloat(s);
  }

  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

  /* ---------- Time ---------- */

  /**
   * Parse a clock time.
   * Accepts "9", "9:30", "0930", "930", "9:30 pm", "9pm", "21:30", "12a".
   * @param {string} raw      user text
   * @param {boolean} use12   12-hour mode is active
   * @param {string} meridiem 'AM' | 'PM' from the selector (used when the text has no am/pm)
   * Errors are codes (translated by the UI): time.format, time.minutes, time.hour12, time.hour24.
   * @returns {{empty:true}|{error:string}|{minutes:number}}
   */
  function parseTime(raw, use12, meridiem) {
    var s = normalizeDigits(raw).trim().toLowerCase().replace(/\s+/g, '').replace(/\./g, '')
      .replace(/ص$/, 'am').replace(/م$/, 'pm'); // Arabic AM/PM letters
    if (!s) return { empty: true };
    var typed = null, m;
    m = s.match(/(am|pm|a|p)$/);
    if (m) { typed = m[1].charAt(0) === 'a' ? 'am' : 'pm'; s = s.slice(0, -m[1].length); }
    var h, min;
    if (/^\d{1,2}$/.test(s)) { h = +s; min = 0; }
    else if (/^\d{3,4}$/.test(s)) { h = +s.slice(0, -2); min = +s.slice(-2); }
    else if ((m = s.match(/^(\d{1,2})[:h](\d{2})$/))) { h = +m[1]; min = +m[2]; }
    else return { error: 'time.format' };
    if (min > 59) return { error: 'time.minutes' };

    var mer = typed;
    if (!mer && use12) {
      // In 12-hour mode, values like 13:00 or 0:30 are clearly 24-hour, so accept them as-is.
      if (h === 0 || h >= 13) mer = null; else mer = String(meridiem || 'AM').toLowerCase();
    }
    if (mer) {
      if (h < 1 || h > 12) return { error: 'time.hour12' };
      h = (h % 12) + (mer === 'pm' ? 12 : 0);
    } else {
      if (h === 24 && min === 0) h = 0; // 24:00 = midnight
      if (h > 23) return { error: 'time.hour24' };
    }
    return { minutes: h * 60 + min };
  }

  /** Format minutes-since-midnight as {text:"9:05", meridiem:"AM"} (12h) or {text:"09:05"} (24h). */
  function formatClock(minutes, use12) {
    var t = ((minutes % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
    var h = Math.floor(t / 60), m = t % 60;
    var mm = (m < 10 ? '0' : '') + m;
    if (use12) {
      var h12 = h % 12 === 0 ? 12 : h % 12;
      return { text: h12 + ':' + mm, meridiem: h < 12 ? 'AM' : 'PM' };
    }
    return { text: (h < 10 ? '0' : '') + h + ':' + mm, meridiem: h < 12 ? 'AM' : 'PM' };
  }

  /** Duration minutes -> "8:30" (hours can exceed 24). */
  function formatHM(totalMinutes) {
    var neg = totalMinutes < 0;
    var t = Math.round(Math.abs(totalMinutes));
    var h = Math.floor(t / 60), m = t % 60;
    return (neg ? '-' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  /** Duration minutes -> "8 hrs 30 min" (unit labels can be localized: {hr, hrs, min}). */
  function formatHMWords(totalMinutes, units) {
    units = units || { hr: 'hr', hrs: 'hrs', min: 'min' };
    var t = Math.round(Math.abs(totalMinutes));
    var h = Math.floor(t / 60), m = t % 60;
    return h + ' ' + (h === 1 ? units.hr : units.hrs) + ' ' + m + ' ' + units.min;
  }

  /** Minutes -> decimal hours rounded to 2 places (e.g. 510 -> 8.5). */
  function toDecimalHours(totalMinutes) { return round2(totalMinutes / 60); }

  /**
   * One work shift.
   * If end <= start, the shift is treated as crossing midnight (overnight).
   * Errors are codes (shift.same, shift.breakNeg, shift.breakLong) with the field to highlight.
   * @returns {{span:number, breakMin:number, net:number, overnight:boolean}|{error:string, field:string, span?:number, breakMin?:number}}
   */
  function workShift(startMin, endMin, breakMin) {
    if (startMin === endMin) return { error: 'shift.same', field: 'end' };
    var span = endMin - startMin;
    var overnight = false;
    if (span < 0) { span += MIN_PER_DAY; overnight = true; }
    var br = breakMin || 0;
    if (br < 0) return { error: 'shift.breakNeg', field: 'break' };
    if (br >= span) return { error: 'shift.breakLong', field: 'break', span: span, breakMin: br };
    return { span: span, breakMin: br, net: span - br, overnight: overnight };
  }

  /* ---------- Pay ---------- */

  /** How many of each pay period fit in a year. Daily assumes a 5-day week (260 work days). */
  var PERIODS = { daily: 260, weekly: 52, biweekly: 26, monthly: 12, annually: 1 };

  /**
   * Gross pay for one pay period, plus equivalents for the other periods.
   * @param {object} o {rate, hours, overtimeHours=0, overtimeMultiplier=1, period}
   *   overtimeMultiplier is 1 (overtime paid at the regular rate) or 1.5 (time and a half).
   */
  function payCalc(o) {
    var mult = o.overtimeMultiplier || 1;
    var otHours = o.overtimeHours || 0;
    var regularPay = o.rate * o.hours;
    var overtimeRate = o.rate * mult;
    var overtimePay = overtimeRate * otHours;
    var gross = regularPay + overtimePay;
    var perYear = PERIODS[o.period];
    if (!perYear) throw new Error('Unknown pay period');
    var annual = gross * perYear;
    var equivalents = {};
    Object.keys(PERIODS).forEach(function (p) { equivalents[p] = round2(annual / PERIODS[p]); });
    var totalHours = o.hours + otHours;
    return {
      regularPay: round2(regularPay),
      overtimeRate: round2(overtimeRate),
      overtimePay: round2(overtimePay),
      gross: round2(gross),
      totalHours: totalHours,
      averageRate: totalHours > 0 ? round2(gross / totalHours) : 0,
      equivalents: equivalents
    };
  }

  /* ---------- Pay-rate conversion between time units ---------- */

  var RATE_UNITS = ['minute', 'hour', 'day', 'week', 'month', 'year'];

  /**
   * Convert a pay rate from one time unit to all others, using a work schedule.
   * Everything goes through the annual amount:
   *   minutes/yr = 60 × h × d × w, hours/yr = h × d × w, days/yr = d × w, weeks/yr = w, months/yr = 12.
   * A month is therefore w ÷ 12 weeks (52 ÷ 12 ≈ 4.33 by default), never exactly 4 weeks.
   * Only time units are converted; the currency is never changed.
   * @param {object} o {amount, unit, hoursPerDay=8, daysPerWeek=5, weeksPerYear=52}
   */
  function convertRate(o) {
    var h = o.hoursPerDay == null ? 8 : o.hoursPerDay;
    var d = o.daysPerWeek == null ? 5 : o.daysPerWeek;
    var w = o.weeksPerYear == null ? 52 : o.weeksPerYear;
    var perYear = { minute: 60 * h * d * w, hour: h * d * w, day: d * w, week: w, month: 12, year: 1 };
    if (!perYear[o.unit]) throw new Error('Unknown unit');
    var annual = o.amount * perYear[o.unit];
    var values = {};
    RATE_UNITS.forEach(function (u) { values[u] = annual / perYear[u]; });
    return { annual: annual, values: values, perYear: perYear, hoursPerYear: h * d * w, weeksPerMonth: w / 12 };
  }

  /* ---------- Budget ---------- */

  /**
   * Summarize a monthly budget.
   * @param {number} income monthly income
   * @param {Array<{amount:number, savings:boolean}>} items
   */
  function budgetSummary(income, items) {
    var expenses = 0, savings = 0;
    items.forEach(function (it) {
      if (it.savings) savings += it.amount; else expenses += it.amount;
    });
    var allocated = expenses + savings;
    var remaining = income - allocated;
    return {
      income: round2(income),
      expenses: round2(expenses),
      savings: round2(savings),
      allocated: round2(allocated),
      remaining: round2(remaining),
      over: remaining < -0.004,
      shares: items.map(function (it) { return income > 0 ? it.amount / income : 0; }),
      expenseRate: income > 0 ? expenses / income : 0,
      savingsRate: income > 0 ? savings / income : 0,
      remainingRate: income > 0 ? remaining / income : 0
    };
  }

  var api = {
    MAX_MONEY: MAX_MONEY,
    normalizeDigits: normalizeDigits,
    parseNumber: parseNumber,
    parseTime: parseTime,
    formatClock: formatClock,
    formatHM: formatHM,
    formatHMWords: formatHMWords,
    toDecimalHours: toDecimalHours,
    workShift: workShift,
    PERIODS: PERIODS,
    payCalc: payCalc,
    RATE_UNITS: RATE_UNITS,
    convertRate: convertRate,
    budgetSummary: budgetSummary,
    round2: round2
  };
  root.WHCalc = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
