/* ============================================================
   Vision Estimators — main interactivity
   - Page loader
   - Custom cursor
   - Header (scroll state, scroll progress, mobile menu)
   - Scroll-reveal observer
   - Stats count-up
   - Hero parallax accent shape
   - FAQ accordion
   - Contact form (validation + mock submit)
   - Mark active nav link
   ============================================================ */

(function () {
  'use strict';

  /* ---------- Theme (light/dark) ---------- */
  function initTheme() {
    const root = document.documentElement;
    const stored = localStorage.getItem('ve-theme');
    if (stored === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');

    document.querySelectorAll('.theme-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const isDark = root.getAttribute('data-theme') === 'dark';
        if (isDark) {
          root.removeAttribute('data-theme');
          localStorage.setItem('ve-theme', 'light');
        } else {
          root.setAttribute('data-theme', 'dark');
          localStorage.setItem('ve-theme', 'dark');
        }
      });
    });
  }

  /* ---------- Page loader ---------- */
  function initPageLoader() {
    const loader = document.querySelector('.page-loader');
    if (!loader) return;
    setTimeout(() => {
      loader.classList.add('hidden-loader');
    }, 2000);
  }

  /* ---------- Custom cursor ---------- */
  function initCustomCursor() {
    if (window.matchMedia('(hover: none)').matches) return;
    const cursor = document.querySelector('.custom-cursor');
    const ring = document.querySelector('.custom-cursor-ring');
    if (!cursor || !ring) return;

    let mouseX = 0, mouseY = 0;
    let ringX = 0, ringY = 0;

    const onMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      cursor.style.left = mouseX + 'px';
      cursor.style.top = mouseY + 'px';
    };
    const onDown = () => {
      cursor.style.width = '18px';
      cursor.style.height = '18px';
    };
    const onUp = () => {
      cursor.style.width = '12px';
      cursor.style.height = '12px';
    };
    const tick = () => {
      ringX += (mouseX - ringX) * 0.12;
      ringY += (mouseY - ringY) * 0.12;
      ring.style.left = ringX + 'px';
      ring.style.top = ringY + 'px';
      requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    requestAnimationFrame(tick);
  }

  /* ---------- Header scroll/progress + mobile menu ---------- */
  function initHeader() {
    const header = document.querySelector('.site-header');
    const progress = document.querySelector('.scroll-progress-bar');
    const toggle = document.querySelector('.mobile-toggle');
    const closeBtn = document.querySelector('.mobile-menu .close-btn');
    const menu = document.querySelector('.mobile-menu');
    const mobileLinks = document.querySelectorAll('.mobile-menu a');

    const onScroll = () => {
      if (header) {
        if (window.scrollY > 40) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
      }
      if (progress) {
        const doc = document.documentElement;
        const sh = doc.scrollHeight - doc.clientHeight;
        const pct = sh > 0 ? (window.scrollY / sh) * 100 : 0;
        progress.style.width = pct + '%';
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const openMenu = () => {
      if (!menu) return;
      menu.classList.add('open');
      document.body.style.overflow = 'hidden';
    };
    const closeMenu = () => {
      if (!menu) return;
      menu.classList.remove('open');
      document.body.style.overflow = '';
    };

    toggle && toggle.addEventListener('click', openMenu);
    closeBtn && closeBtn.addEventListener('click', closeMenu);
    mobileLinks.forEach((a) => a.addEventListener('click', closeMenu));

    // mobile services submenu accordion
    const submenu = document.querySelector('.mobile-submenu');
    const submenuToggle = submenu && submenu.querySelector('.mobile-submenu-toggle');
    if (submenuToggle) {
      submenuToggle.addEventListener('click', () => {
        const isOpen = submenu.classList.toggle('open');
        submenuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    }

    // mark active nav link
    const path = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link, .mobile-menu .links a').forEach((a) => {
      const href = a.getAttribute('href');
      if (!href) return;
      if (href === path || (path === '' && href === 'index.html') ||
          (path === 'index.html' && href === 'index.html')) {
        a.classList.add('active');
      }
    });
  }

  /* ---------- Scroll reveal ---------- */
  function initScrollReveal() {
    const els = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active');
            observer.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: '0px 0px -60px 0px', threshold: 0.08 }
    );
    els.forEach((el) => observer.observe(el));
  }

  /* ---------- Stats count-up ---------- */
  function initCountUp() {
    const nums = document.querySelectorAll('[data-countup]');
    if (!nums.length) return;
    const animate = (el) => {
      const target = parseInt(el.dataset.countup, 10) || 0;
      const suffix = el.dataset.suffix || '';
      const duration = 1800;
      const start = performance.now();
      const tick = (now) => {
        const elapsed = now - start;
        const p = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.floor(eased * target) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animate(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.3 }
    );
    nums.forEach((el) => observer.observe(el));
  }

  /* ---------- Hero parallax accent shape ---------- */
  function initHeroParallax() {
    const hero = document.querySelector('.hero');
    const shape = hero && hero.querySelector('.accent-shape');
    if (!hero || !shape) return;
    hero.addEventListener('mousemove', (e) => {
      const rect = hero.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      shape.style.transform = `translate(${x * 20}px, ${y * 20}px) rotate(${0}deg)`;
    });
  }

  /* ---------- FAQ accordion ---------- */
  function initFaq() {
    const items = document.querySelectorAll('.faq-item');
    if (!items.length) return;
    items.forEach((item, idx) => {
      const btn = item.querySelector('.faq-toggle');
      if (idx === 0) item.classList.add('open');
      btn && btn.setAttribute('aria-expanded', item.classList.contains('open') ? 'true' : 'false');
      btn && btn.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        items.forEach((i) => {
          i.classList.remove('open');
          const b = i.querySelector('.faq-toggle');
          b && b.setAttribute('aria-expanded', 'false');
        });
        if (!isOpen) {
          item.classList.add('open');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  /* ---------- Contact form ---------- */
  function initContactForm() {
    const form = document.querySelector('#contact-form');
    if (!form) return;
    const submitBtn = form.querySelector('button[type="submit"]');
    const successPanel = document.querySelector('#contact-success');

    const setError = (name, msg) => {
      const field = form.querySelector(`[name="${name}"]`);
      const errEl = form.querySelector(`[data-err="${name}"]`);
      if (msg) {
        field && field.classList.add('has-error');
        errEl && (errEl.textContent = msg);
      } else {
        field && field.classList.remove('has-error');
        errEl && (errEl.textContent = '');
      }
    };

    form.querySelectorAll('input, textarea, select').forEach((el) => {
      el.addEventListener('input', () => setError(el.name, ''));
      el.addEventListener('change', () => setError(el.name, ''));
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      let valid = true;
      if (!data.name || !data.name.trim()) { setError('name', 'Name is required'); valid = false; }
      if (!data.email || !/\S+@\S+\.\S+/.test(data.email)) { setError('email', 'Valid email required'); valid = false; }
      if (!data.projectType) { setError('projectType', 'Please select a project type'); valid = false; }
      if (!data.message || !data.message.trim()) { setError('message', 'Message is required'); valid = false; }
      if (!valid) return;

      submitBtn.disabled = true;
      const orig = submitBtn.innerHTML;
      submitBtn.innerHTML = `${window.VEIcons.buildSvg('ArrowPathIcon', { size: 18, className: 'spin' })} Sending Request...`;

      setTimeout(() => {
        if (successPanel) {
          form.style.display = 'none';
          successPanel.style.display = 'flex';
          const nameOut = successPanel.querySelector('[data-out="name"]');
          const emailOut = successPanel.querySelector('[data-out="email"]');
          if (nameOut) nameOut.textContent = data.name;
          if (emailOut) emailOut.textContent = data.email;
        } else {
          submitBtn.disabled = false;
          submitBtn.innerHTML = orig;
        }
      }, 1800);
    });
  }

  /* ---------- Scroll-to-top button ---------- */
  function initScrollTop() {
    const btn = document.querySelector('.scroll-top');
    if (!btn) return;
    const onScroll = () => {
      if (window.scrollY > 400) btn.classList.add('visible');
      else btn.classList.remove('visible');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    onScroll();
  }

  /* ---------- Boot ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initPageLoader();
    initHeader();
    initScrollReveal();
    initCountUp();
    initHeroParallax();
    initFaq();
    initContactForm();
    initScrollTop();
  });
})();
