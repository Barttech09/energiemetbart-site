/*
 * Onzichtbare reCAPTCHA v3-koppeling voor de formulieren op energiemetbart.nl.
 * Netlify Forms ondersteunt zelf alleen het zichtbare v2-vinkje, dus dit script
 * regelt v3 los: het haalt bij het versturen een score-token op bij Google,
 * laat een Netlify Function die score verifiëren, en stuurt het formulier pas
 * daadwerkelijk (native) in als dat in orde is.
 *
 * Opt-in per formulier via: <form data-recaptcha-action="contact"> ...
 * Bij een technische storing (script/functie niet bereikbaar) wordt het
 * formulier gewoon verstuurd, zodat een storing nooit een lead blokkeert.
 */
(function () {
  var SITE_KEY = '6LeBaoAtAAAAAM9u2LeLGnMfwsvmlEIpxyjekU4x';
  var scriptLoading = false;
  var readyCallbacks = [];

  function loadRecaptchaScript(cb) {
    if (window.grecaptcha) { cb(); return; }
    readyCallbacks.push(cb);
    if (scriptLoading) return;
    scriptLoading = true;
    var s = document.createElement('script');
    s.src = 'https://www.google.com/recaptcha/api.js?render=' + SITE_KEY;
    s.onload = function () {
      readyCallbacks.forEach(function (fn) { fn(); });
      readyCallbacks = [];
    };
    s.onerror = function () {
      // Kon het reCAPTCHA-script niet laden (bv. geblokkeerd): niet blokkeren.
      readyCallbacks.forEach(function (fn) { fn(true); });
      readyCallbacks = [];
    };
    document.head.appendChild(s);
  }

  function submitNatively(form) {
    HTMLFormElement.prototype.submit.call(form);
  }

  function showError(form, message) {
    var el = form.querySelector('.recaptcha-error');
    if (!el) {
      el = document.createElement('p');
      el.className = 'recaptcha-error';
      el.style.cssText = 'color:#b0392f; font-size:0.85rem; margin:8px 0 0;';
      var submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn && submitBtn.parentNode) {
        submitBtn.insertAdjacentElement('afterend', el);
      } else {
        form.appendChild(el);
      }
    }
    el.textContent = message;
  }

  function guardForm(form, actionName) {
    if (form.dataset.recaptchaGated === 'true') return;
    form.dataset.recaptchaGated = 'true';

    form.addEventListener('submit', function (ev) {
      if (form.dataset.recaptchaVerified === 'true') {
        // Al geverifieerd (na herindienen): laat de native submit gewoon door.
        return;
      }
      ev.preventDefault();

      var submitBtn = form.querySelector('button[type="submit"]');
      var originalText = submitBtn ? submitBtn.textContent : null;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Even geduld…';
      }

      function fallbackSubmit() {
        form.dataset.recaptchaVerified = 'true';
        submitNatively(form);
      }

      loadRecaptchaScript(function (failed) {
        if (failed || !window.grecaptcha) { fallbackSubmit(); return; }
        window.grecaptcha.ready(function () {
          window.grecaptcha.execute(SITE_KEY, { action: actionName }).then(function (token) {
            fetch('/api/verify-recaptcha', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: token, action: actionName })
            }).then(function (res) { return res.json(); }).then(function (data) {
              if (data && data.ok) {
                fallbackSubmit();
              } else {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
                showError(form, 'We konden dit formulier niet automatisch als spamvrij verifiëren. Probeer het nogmaals, of neem rechtstreeks contact op via telefoon of e-mail.');
              }
            }).catch(fallbackSubmit);
          }).catch(fallbackSubmit);
        });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('form[data-recaptcha-action]').forEach(function (form) {
      guardForm(form, form.getAttribute('data-recaptcha-action'));
    });
  });
})();
