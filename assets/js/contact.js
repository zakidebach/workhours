/*! Contact form: validates input and opens a pre-filled email (mailto:). No data is sent to any server. */
(function () {
  'use strict';
  var WH = window.WH, t = WH.t;
  var form = WH.$('#contact-form');
  if (!form) return;
  var name = WH.$('#cf-name'), topic = WH.$('#cf-topic'), msg = WH.$('#cf-message'), status = WH.$('#cf-status');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var nErr = name.value.trim() ? null : t('cf.name');
    var mErr = msg.value.trim().length >= 10 ? null : t('cf.msg');
    WH.setError(name, nErr); WH.setError(msg, mErr);
    if (nErr || mErr) { (nErr ? name : msg).focus(); return; }
    var to = form.getAttribute('data-email');
    var subject = 'WorkHours: ' + topic.value;
    var body = msg.value.trim() + '\n\n- ' + name.value.trim();
    window.location.href = 'mailto:' + to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    status.innerHTML = '<div class="alert alert-ok">' + WH.esc(t('cf.ok', { email: to })) + '</div>';
  });
})();
