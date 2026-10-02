/* =====================================================================
   Vision Estimators — UI behaviour
   Navigation · reveal · counters · tilt · story scroll · accordions ·
   filters · contact form · lazy 3D scene loader
   ===================================================================== */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var BASE = ((document.currentScript && document.currentScript.src) || '').replace(/js\/main\.js(\?.*)?$/, '');

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* ---------- Year ---------- */
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- Mobile menu ---------- */
  var burger = $('.burger');
  var menu = $('#mobile-menu');
  var mainEl = $('main');
  var footEl = $('.site-footer');
  function setMenu(open) {
    if (!menu) return;
    doc.classList.toggle('nav-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.setAttribute('aria-hidden', String(!open));
    if (open) menu.removeAttribute('inert'); else menu.setAttribute('inert', '');
    if (mainEl) mainEl.inert = open;
    if (footEl) footEl.inert = open;
    if (open) {
      var first = menu.querySelector('a');
      if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 60);
    }
  }
  if (burger && menu) {
    burger.addEventListener('click', function () { setMenu(!doc.classList.contains('nav-open')); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && doc.classList.contains('nav-open')) { setMenu(false); burger.focus(); }
    });
    window.matchMedia('(min-width: 1001px)').addEventListener('change', function (e) { if (e.matches) setMenu(false); });
  }

  /* ---------- Reveal on scroll ---------- */
  $$('[data-stagger]').forEach(function (g) {
    var step = +g.getAttribute('data-stagger') || 70;
    Array.prototype.forEach.call(g.children, function (c, i) { c.style.setProperty('--d', i * step); });
  });
  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('is-in'); revealIO.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  $$('[data-reveal],[data-inview]').forEach(function (el) { revealIO.observe(el); });

  /* ---------- Counters ---------- */
  function fmt(v, dec) { return v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
  var countIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      countIO.unobserve(en.target);
      var el = en.target, to = parseFloat(el.getAttribute('data-count')), dec = +(el.getAttribute('data-decimals') || 0);
      if (reduce) { el.textContent = fmt(to, dec); return; }
      var t0 = performance.now(), dur = 1700;
      (function tick(now) {
        var k = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
        el.textContent = fmt(to * e, dec);
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }, { threshold: 0.6 });
  $$('[data-count]').forEach(function (el) {
    if (!reduce) el.textContent = fmt(0, +(el.getAttribute('data-decimals') || 0));
    countIO.observe(el);
  });

  /* ---------- 3D tilt + spotlight ---------- */
  if (finePointer && !reduce) {
    $$('[data-tilt]').forEach(function (el) {
      var max = +el.getAttribute('data-tilt') || 5, raf = 0;
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () {
          el.classList.add('is-tilting');
          el.style.setProperty('--ry', ((x - 0.5) * max * 2).toFixed(2) + 'deg');
          el.style.setProperty('--rx', ((0.5 - y) * max * 2).toFixed(2) + 'deg');
          el.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
          el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
        });
      });
      el.addEventListener('pointerleave', function () {
        cancelAnimationFrame(raf);
        el.classList.remove('is-tilting');
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });

    /* estimator workspace parallax */
    $$('[data-ws]').forEach(function (ws) {
      var stage = $('.ws__stage', ws);
      ws.addEventListener('pointermove', function (e) {
        var r = ws.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        stage.style.setProperty('--wy', (-20 + x * 16).toFixed(2) + 'deg');
        stage.style.setProperty('--wx', (14 - y * 12).toFixed(2) + 'deg');
      });
      ws.addEventListener('pointerleave', function () { stage.style.removeProperty('--wx'); stage.style.removeProperty('--wy'); });
    });
  }

  /* ---------- Accordion ---------- */
  $$('.faq__item').forEach(function (item) {
    var btn = $('.faq__q', item), ans = $('.faq__a', item);
    if (!btn || !ans) return;
    ans.inert = true;
    btn.addEventListener('click', function () {
      var open = !item.classList.contains('is-open');
      item.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
      ans.inert = !open;
    });
  });

  /* ---------- Project filters ---------- */
  $$('[data-filter-group]').forEach(function (group) {
    var btns = $$('.filter', group);
    var grid = $(group.getAttribute('data-filter-group'));
    if (!grid) return;
    var cards = $$('[data-cat]', grid);
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-filter');
        btns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        cards.forEach(function (c) {
          var show = f === 'all' || c.getAttribute('data-cat').split(' ').indexOf(f) > -1;
          if (show) {
            c.classList.remove('is-hidden');
            void c.offsetWidth;
            c.classList.remove('is-fading');
          } else {
            c.classList.add('is-fading');
            setTimeout(function () { if (c.classList.contains('is-fading')) c.classList.add('is-hidden'); }, 320);
          }
        });
      });
    });
  });

  /* ---------- Scroll-driven pieces ---------- */
  var header = $('[data-header]');
  var parallax = reduce ? [] : $$('[data-parallax]');
  var timelines = $$('[data-timeline]');
  var sticky = $('.sticky-cta');
  var heroEl = $('.hero, .page-hero');

  /* story */
  var story = $('[data-story]');
  var storySteps = story ? $$('.story-step', story) : [];
  var storyPipes = story ? $$('[data-pipe]', story) : [];
  var storyLines = story ? $$('.pipe-line', story) : [];
  var storyCount = story ? $('[data-story-count]', story) : null;
  var PIPE_AT = [0, 2, 5, 6, 6.7];
  var lastStep = 0;

  function flyTags() {
    $$('.story__tags .tag', story).forEach(function (tag) {
      var row = $('.boq tr[data-row="' + tag.getAttribute('data-row') + '"]', story);
      var chip = $('.tag__chip', tag);
      if (!row || !chip) return;
      var a = chip.getBoundingClientRect(), b = row.getBoundingClientRect();
      tag.style.setProperty('--fx', (b.left + b.width * 0.3 - a.left).toFixed(0) + 'px');
      tag.style.setProperty('--fy', (b.top + b.height / 2 - (a.top + a.height / 2) + 24).toFixed(0) + 'px');
    });
  }

  function updateStory() {
    if (!story) return;
    var r = story.getBoundingClientRect();
    var total = Math.max(1, story.offsetHeight - window.innerHeight);
    var p = clamp(-r.top / total, 0, 1);
    var N = 7, pos = p * N, step = clamp(Math.floor(pos) + 1, 1, N);
    story.__p = p;
    if (story.__scene) story.__scene.setProgress(p);
    if (step !== lastStep) {
      if (step >= 5 && lastStep < 5) flyTags();
      for (var i = 1; i <= N; i++) story.classList.toggle('is-s' + i, i <= step);
      storySteps.forEach(function (s, idx) {
        s.classList.toggle('is-active', idx === step - 1);
        s.classList.toggle('is-done', idx < step - 1);
        var b = $('.story-step__h', s);
        if (b) b.setAttribute('aria-current', idx === step - 1 ? 'step' : 'false');
      });
      if (storyCount) storyCount.textContent = '0' + step;
      lastStep = step;
    }
    storyPipes.forEach(function (el, i) { el.classList.toggle('is-on', pos >= PIPE_AT[i]); });
    storyLines.forEach(function (el, i) {
      var f = clamp((pos - PIPE_AT[i]) / (PIPE_AT[i + 1] - PIPE_AT[i]), 0, 1);
      el.style.setProperty('--f', f.toFixed(3));
    });
  }
  storySteps.forEach(function (s, i) {
    var b = $('.story-step__h', s);
    if (!b) return;
    b.addEventListener('click', function () {
      var top = story.getBoundingClientRect().top + window.scrollY;
      var total = story.offsetHeight - window.innerHeight;
      window.scrollTo({ top: top + total * ((i + 0.4) / 7), behavior: reduce ? 'auto' : 'smooth' });
    });
  });

  function updateTimelines(vh) {
    timelines.forEach(function (tl) {
      var r = tl.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      var line = vh * 0.62;
      tl.style.setProperty('--p', clamp((line - r.top) / r.height, 0, 1).toFixed(4));
      $$('.tl-step', tl).forEach(function (s) {
        var sr = s.getBoundingClientRect();
        s.classList.toggle('is-reached', sr.top + sr.height / 2 < line);
      });
    });
  }

  function updateParallax(vh) {
    for (var i = 0; i < parallax.length; i++) {
      var el = parallax[i], host = el.parentElement, r = host.getBoundingClientRect();
      if (r.bottom < -80 || r.top > vh + 80) continue;
      var c = (r.top + r.height / 2 - vh / 2) / vh;
      el.style.setProperty('--py', (c * r.height * -0.1).toFixed(1) + 'px');
    }
  }

  function updateSticky(vh) {
    if (!sticky) return;
    var past = window.scrollY > (heroEl ? heroEl.offsetHeight * 0.55 : 420);
    var nearEnd = footEl && footEl.getBoundingClientRect().top < vh;
    sticky.classList.toggle('is-visible', past && !nearEnd);
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var vh = window.innerHeight;
      if (header) header.classList.toggle('is-scrolled', window.scrollY > 12);
      updateStory();
      updateTimelines(vh);
      updateParallax(vh);
      updateSticky(vh);
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  /* ---------- Ambient cycling for tickers (used when 3D is not running) ---------- */
  function cycle(container, selector, cls, ms, owner) {
    if (!container || reduce) return;
    var items = $$(selector, container), i = 0;
    if (!items.length) return;
    setInterval(function () {
      if (owner && owner.__scene) return;
      items.forEach(function (it, k) { it.classList.toggle(cls, k === i); });
      i = (i + 1) % items.length;
    }, ms);
  }
  var heroScene = $('.hero [data-scene]');
  cycle($('.hero__ticker'), '.ticker__item', 'is-active', 2600, heroScene);
  var finalScene = $('.final [data-scene]');
  cycle($('.final .phase'), 'span', 'is-on', 1800, finalScene);

  /* ---------- Civil feature highlight ---------- */
  $$('[data-civil]').forEach(function (root) {
    var sceneEl = $('[data-scene]', root);
    function hot(key) {
      $$('[data-feature]', root).forEach(function (b) { b.classList.toggle('is-hot', b.getAttribute('data-feature') === key); });
      $$('.pin', root).forEach(function (p) { p.classList.toggle('is-hot', p.getAttribute('data-anchor') === key); });
      if (sceneEl && sceneEl.__scene) sceneEl.__scene.highlight(key);
    }
    $$('[data-feature]', root).forEach(function (b) {
      var key = b.getAttribute('data-feature');
      b.addEventListener('mouseenter', function () { hot(key); });
      b.addEventListener('focus', function () { hot(key); });
      b.addEventListener('mouseleave', function () { hot(null); });
      b.addEventListener('blur', function () { hot(null); });
      b.addEventListener('click', function () { hot(key); });
    });
  });

  /* ---------- Contact form ---------- */
  var form = $('[data-form]');
  if (form) initForm(form);

  function initForm(form) {
    form.noValidate = true;
    var params = new URLSearchParams(window.location.search);
    function preselect(sel, wanted) {
      if (!sel || !wanted) return;
      Array.prototype.some.call(sel.options, function (o) {
        if (o.value === wanted || o.getAttribute('data-slug') === wanted) { sel.value = o.value; return true; }
        return false;
      });
    }
    preselect(form.elements.service, params.get('service'));
    preselect(form.elements.project_type, params.get('project'));

    /* files: collected in JS so they can be dropped, listed and removed */
    var input = $('input[type="file"]', form), list = $('.file-list', form), drop = $('.dropzone', form);
    var holder = $('[data-file-holder]', form);
    var files = [], MAX_TOTAL = 10 * 1024 * 1024, MAXN = 10;
    var fileErr = $('#err-files', form);
    if (input) input.removeAttribute('name'); /* files are re-attached individually on submit */
    function size(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
    function total() { return files.reduce(function (a, f) { return a + f.size; }, 0); }
    function setFileError(msg) {
      if (!fileErr) return;
      fileErr.textContent = msg;
      fileErr.closest('.field').classList.toggle('has-error', !!msg);
    }
    function renderFiles() {
      list.innerHTML = '';
      files.forEach(function (f, i) {
        var li = document.createElement('li');
        li.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5"/></svg>';
        var name = document.createElement('span'); name.textContent = f.name; li.appendChild(name);
        var s2 = document.createElement('small'); s2.textContent = size(f.size); li.appendChild(s2);
        var rm = document.createElement('button'); rm.type = 'button'; rm.setAttribute('aria-label', 'Remove ' + f.name);
        rm.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
        rm.addEventListener('click', function () { files.splice(i, 1); setFileError(''); renderFiles(); });
        li.appendChild(rm);
        list.appendChild(li);
      });
    }
    function addFiles(fl) {
      var msg = '';
      Array.prototype.forEach.call(fl, function (f) {
        if (files.length >= MAXN) { msg = 'You can attach up to ' + MAXN + ' files. Please share a download link for larger sets.'; return; }
        if (total() + f.size > MAX_TOTAL) { msg = 'Attachments are limited to 10 MB in total — please share a download link (e.g. Google Drive or Dropbox) in your message for larger files.'; return; }
        files.push(f);
      });
      setFileError(msg);
      renderFiles();
    }
    if (input && list && drop) {
      input.addEventListener('change', function () { addFiles(input.files); input.value = ''; });
      ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('is-drag'); }); });
      ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('is-drag'); }); });
      drop.addEventListener('drop', function (e) { if (e.dataTransfer) addFiles(e.dataTransfer.files); });
    }

    /* validation */
    var rules = {
      name: function (v) { return v.trim().length >= 2 || 'Please enter your full name.'; },
      email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Please enter a valid email address.'; },
      phone: function (v) { return !v.trim() || /^[+()\d\s.-]{6,20}$/.test(v.trim()) || 'Please enter a valid phone number.'; },
      project_type: function (v) { return !!v || 'Please select a project type.'; },
      service: function (v) { return !!v || 'Please select the service you need.'; },
      message: function (v) { return v.trim().length >= 10 || 'Please tell us a little about the project (at least 10 characters).'; },
      consent: function (v, el) { return el.checked || 'Please confirm you agree to the Privacy Policy.'; }
    };
    function check(el) {
      var rule = rules[el.name];
      if (!rule) return true;
      var res = rule(el.value, el), field = el.closest('.field');
      var err = field && $('.field__err', field);
      var ok = res === true;
      if (field) field.classList.toggle('has-error', !ok);
      el.setAttribute('aria-invalid', String(!ok));
      if (err) err.textContent = ok ? '' : res;
      return ok;
    }
    Object.keys(rules).forEach(function (n) {
      var el = form.elements[n];
      if (!el) return;
      el.addEventListener('blur', function () { if (el.value || el.type === 'checkbox') check(el); });
      el.addEventListener('input', function () { if (el.getAttribute('aria-invalid') === 'true') check(el); });
      el.addEventListener('change', function () { if (el.getAttribute('aria-invalid') === 'true') check(el); });
    });

    var status = $('.form__status', form), btn = $('button[type="submit"]', form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstBad = null;
      Object.keys(rules).forEach(function (n) {
        var el = form.elements[n];
        if (el && !check(el) && !firstBad) firstBad = el;
      });
      if (total() > MAX_TOTAL) { setFileError('Attachments are limited to 10 MB in total.'); if (!firstBad) firstBad = input; }
      if (firstBad) { firstBad.focus(); return; }
      if (form.elements._honey && form.elements._honey.value) { done(); return; } /* spam trap */

      var action = form.getAttribute('action') || '';
      if (!/^https?:\/\//.test(action)) { done(); return; } /* no email service configured */

      /* thank-you redirect back to this site (only possible when served over http/https) */
      var next = $('[data-next]', form);
      if (next) {
        if (/^https?:$/.test(window.location.protocol)) next.value = new URL('thank-you.html', window.location.href).href;
        else next.parentNode.removeChild(next);
      }
      /* attach each selected file as its own field */
      if (holder) {
        holder.innerHTML = '';
        if (files.length && window.DataTransfer) {
          files.forEach(function (f, i) {
            var dt = new DataTransfer(); dt.items.add(f);
            var fi = document.createElement('input');
            fi.type = 'file'; fi.name = 'attachment_' + (i + 1); fi.files = dt.files;
            holder.appendChild(fi);
          });
        }
      }
      btn.classList.add('is-loading');
      if (status) { status.classList.remove('is-error'); status.textContent = 'Sending your request…'; }
      HTMLFormElement.prototype.submit.call(form);
    });
    window.addEventListener('pageshow', function () { btn.classList.remove('is-loading'); });

    function done() {
      var ok = $('[data-form-success]');
      form.hidden = true;
      if (ok) { ok.hidden = false; ok.setAttribute('tabindex', '-1'); ok.focus(); }
    }
  }

  /* ---------- Lazy 3D scenes ---------- */
  var sceneEls = $$('[data-scene]');
  var conn = navigator.connection || {};
  var allow3D = sceneEls.length > 0 && !reduce && 'WebGLRenderingContext' in window &&
    !conn.saveData && !(navigator.deviceMemory && navigator.deviceMemory < 2) &&
    !/[?&]no3d\b/.test(window.location.search);

  var enginePromise = null;
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.async = true; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  function engine() {
    if (!enginePromise) {
      enginePromise = loadScript(BASE + 'assets/vendor/three.min.js')
        .then(function () { return loadScript(BASE + 'js/scenes.js'); })
        .then(function () { return window.VEScenes; });
    }
    return enginePromise;
  }
  var visIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { var c = en.target.__scene; if (c) c.setActive(en.isIntersecting); });
  }, { rootMargin: '120px 0px' });

  function mountScene(el) {
    engine().then(function (S) {
      if (!S) return;
      var ctrl = S.mount(el);
      if (!ctrl) return;
      el.__scene = ctrl;
      var root = el.closest('[data-story]');
      if (root) { root.__scene = ctrl; ctrl.setProgress(root.__p || 0); }
      visIO.observe(el);
    }).catch(function (err) { if (window.console) console.warn('3D scene unavailable, showing static image.', err); });
  }
  function idle(fn) { if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 1500 }); else setTimeout(fn, 250); }
  if (allow3D) {
    var startScenes = function () {
      var nearIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { nearIO.unobserve(en.target); mountScene(en.target); } });
      }, { rootMargin: '700px 0px' });
      sceneEls.forEach(function (el) { nearIO.observe(el); });
    };
    if (document.readyState === 'complete') idle(startScenes);
    else window.addEventListener('load', function () { idle(startScenes); }, { once: true });
  }
})();
