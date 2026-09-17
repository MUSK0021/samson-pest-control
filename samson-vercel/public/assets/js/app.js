/* Samson Pest Control: site interactions.
   Needs lenis + gsap + ScrollTrigger + SplitText (loaded before this file). Everything degrades
   gracefully: without them, or with reduced motion, all content is simply visible. */
(function () {
  'use strict';

  var d = document;
  var html = d.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var gsap = window.gsap;
  var ST = window.ScrollTrigger;
  var hasGsap = !!(gsap && ST);
  if (!hasGsap) html.classList.remove('anim');
  var animOn = hasGsap && html.classList.contains('anim');
  window.__samson = true;

  function $(s, r) { return (r || d).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); }
  function safe(name, fn) {
    try { fn(); } catch (err) {
      if (window.console) console.warn('[samson] ' + name, err);
      html.classList.remove('anim');
    }
  }

  if (hasGsap) {
    gsap.registerPlugin(ST);
    if (window.SplitText) gsap.registerPlugin(window.SplitText);
    if (window.Flip) gsap.registerPlugin(window.Flip);
  }

  var PHONE = (function () { var a = $('.hdr__phone'); return a ? { href: a.getAttribute('href'), text: a.textContent.trim() } : { href: 'tel:+15702780325', text: '570-278-0325' }; })();

  /* ---------------------------------------------------------------- smooth scroll */
  var lenis = null;
  if (animOn && window.Lenis) {
    safe('lenis', function () {
      lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
      lenis.on('scroll', ST.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    });
  }

  function scrollToEl(el, immediate) {
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: -96, immediate: !!immediate, duration: 1.4 });
    else el.scrollIntoView({ behavior: immediate || reduce ? 'auto' : 'smooth', block: 'start' });
  }
  function hashTarget(hash) {
    if (!hash || hash.length < 2) return null;
    try { return d.getElementById(decodeURIComponent(hash.slice(1))); } catch (e) { return null; }
  }

  /* ---------------------------------------------------------------- header, progress, quickbar */
  var hdr = $('[data-hdr]');
  var progress = $('[data-progress]');
  var quickbar = $('[data-quickbar]');
  var menuOpen = false;
  var lastY = window.scrollY;

  function onScroll(y) {
    if (!hdr) return;
    hdr.classList.toggle('is-stuck', y > 30);
    if (y > 520 && y > lastY + 4 && !menuOpen && !hdr.matches(':focus-within')) hdr.classList.add('is-hidden');
    else if (y < lastY - 4 || y < 520) hdr.classList.remove('is-hidden');
    lastY = y;
    var max = html.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
    if (quickbar) {
      var nearEnd = y + window.innerHeight > html.scrollHeight - 420;
      quickbar.classList.toggle('is-on', y > window.innerHeight * 0.7 && !nearEnd && !menuOpen);
    }
  }
  if (lenis) lenis.on('scroll', function (e) { onScroll(e.scroll); });
  else window.addEventListener('scroll', function () { onScroll(window.scrollY); }, { passive: true });
  onScroll(window.scrollY);

  /* ---------------------------------------------------------------- mobile menu */
  safe('menu', function () {
    var menu = $('[data-menu]');
    var toggle = $('[data-menu-toggle]');
    if (!menu || !toggle) return;
    var bg = $('.menu__bg', menu);
    var links = $$('.menu__links a', menu);
    var foot = $('.menu__foot', menu);

    function setMenu(open, returnFocus) {
      if (open === menuOpen) return;
      menuOpen = open;
      toggle.setAttribute('aria-expanded', String(open));
      hdr.classList.toggle('menu-open', open);
      hdr.classList.remove('is-hidden');
      if (quickbar) quickbar.classList.remove('is-on');
      if (open) {
        menu.hidden = false;
        if (lenis) lenis.stop(); else html.style.overflow = 'hidden';
        if (animOn) {
          gsap.killTweensOf([bg, links, foot]);
          gsap.fromTo(bg, { clipPath: 'circle(0% at 100% 0%)' }, { clipPath: 'circle(150% at 100% 0%)', duration: 0.8, ease: 'expo.inOut' });
          gsap.fromTo(links, { yPercent: 110 }, { yPercent: 0, duration: 0.9, stagger: 0.05, delay: 0.25, ease: 'expo.out' });
          gsap.fromTo(foot, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7, delay: 0.45, ease: 'expo.out' });
        }
        setTimeout(function () { if (links[0]) links[0].focus({ preventScroll: true }); }, 60);
      } else {
        var finish = function () { menu.hidden = true; };
        if (lenis) lenis.start(); else html.style.overflow = '';
        if (animOn) {
          gsap.killTweensOf([bg, links, foot]);
          gsap.to([links, foot], { opacity: 0, duration: 0.25 });
          gsap.to(bg, { clipPath: 'circle(0% at 100% 0%)', duration: 0.6, ease: 'expo.inOut', onComplete: function () { gsap.set([links, foot], { clearProps: 'opacity' }); finish(); } });
        } else finish();
        if (returnFocus) toggle.focus();
      }
    }
    toggle.addEventListener('click', function () { setMenu(!menuOpen); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menuOpen) setMenu(false, true); });
    window.addEventListener('resize', function () { if (window.innerWidth > 1100 && menuOpen) setMenu(false); });
    menu.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (a && a.getAttribute('href').indexOf('tel:') !== 0 && a.getAttribute('href').indexOf('mailto:') !== 0) setTimeout(function () { setMenu(false); }, 400);
    });
    // keep keyboard focus inside the open menu
    menu.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = [toggle].concat($$('a, button', menu));
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  });

  /* ---------------------------------------------------------------- page transitions */
  safe('wipe', function () {
    var wipe = $('.wipe');
    if (!wipe) return;
    wipe.addEventListener('animationend', function () { html.classList.remove('wipe-in'); });
    window.addEventListener('pageshow', function (e) {
      if (e.persisted && hasGsap) gsap.set(wipe, { yPercent: 101, y: 0 });
    });
    d.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var href = a.getAttribute('href') || '';
      if (!href || a.target === '_blank' || a.hasAttribute('download') || a.classList.contains('skip')) return;
      if (/^(mailto:|tel:|sms:|javascript:)/i.test(href)) return;
      if (href.charAt(0) === '#') {
        var t = hashTarget(href);
        if (t) { e.preventDefault(); scrollToEl(t); if (history.replaceState) history.replaceState(null, '', href); }
        return;
      }
      var url;
      try { url = new URL(a.href, location.href); } catch (err) { return; }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) {
        if (url.hash && hashTarget(url.hash)) { e.preventDefault(); scrollToEl(hashTarget(url.hash)); }
        return;
      }
      if (/\.(pdf|jpe?g|png|webp|svg|zip|xml|txt)$/i.test(url.pathname) || url.pathname.indexOf('/api/') === 0) return;
      if (!animOn) return;
      e.preventDefault();
      try { sessionStorage.setItem('samson-wipe', '1'); } catch (err) { /* private mode */ }
      html.classList.remove('wipe-in');
      gsap.fromTo(wipe, { yPercent: 101, y: 0 }, { yPercent: 0, duration: 0.55, ease: 'expo.inOut', onComplete: function () { location.href = url.href; } });
    });
    // warm the cache for likely next pages
    if ('IntersectionObserver' in window) {
      var seen = {};
      d.addEventListener('pointerover', function (e) {
        var a = e.target.closest('a[href^="/"]');
        if (!a || seen[a.pathname] || a.pathname === location.pathname || a.pathname.indexOf('/api/') === 0) return;
        seen[a.pathname] = 1;
        var l = d.createElement('link'); l.rel = 'prefetch'; l.href = a.pathname; d.head.appendChild(l);
      }, { passive: true });
    }
  });

  /* ---------------------------------------------------------------- loader + hero intro */
  function heroIntro(delay) {
    var hero = $('[data-hero]');
    if (!hero || !animOn) return;
    var tl = gsap.timeline({ delay: delay });
    tl.to($$('.hero__title .line > span', hero), { y: 0, yPercent: 0, duration: 1.3, stagger: 0.11, ease: 'expo.out' })
      .to($$('[data-hero-fade]', hero), { opacity: 1, y: 0, duration: 1.1, stagger: 0.09, ease: 'expo.out' }, 0.2)
      .to($$('.hl__scribble path', hero), { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut' }, 0.75);
  }
  safe('intro', function () {
    var loader = $('.loader');
    if (loader && animOn && !html.classList.contains('seen')) {
      try { sessionStorage.setItem('samson-intro', '1'); } catch (e) { /* ignore */ }
      if (lenis) lenis.stop();
      gsap.timeline({ onComplete: function () { loader.remove(); if (lenis) lenis.start(); } })
        .to('.loader__mark', { opacity: 1, scale: 1, duration: 0.7, ease: 'back.out(1.8)' })
        .to('.loader__logo', { y: 0, duration: 0.7, ease: 'expo.out' }, 0.3)
        .to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.9, ease: 'expo.inOut' }, 1.15);
      heroIntro(1.45);
    } else {
      if (loader) loader.remove();
      heroIntro(html.classList.contains('wipe-in') ? 0.45 : 0.1);
    }
  });

  /* ---------------------------------------------------------------- pinned: pencil point story */
  safe('pencil', function () {
    var pencil = $('[data-pencil]');
    if (!pencil || !animOn) return;
    var media = $('[data-pencil-media]', pencil);
    var img = $('img', media);
    var dot = $('[data-pencil-dot]', pencil);
    var steps = $$('[data-step]', pencil);
    var bar = $('[data-pencil-progress]', pencil);
    var mobile = window.innerWidth < 900;
    var tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: pencil, start: 'top top', end: mobile ? '+=260%' : '+=340%', pin: true, scrub: 1, anticipatePin: 1 }
    });
    var inn = { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' };
    var out = { opacity: 0, y: -40, duration: 0.4, ease: 'power2.in' };
    gsap.set(steps, { xPercent: -50, yPercent: -50, x: 0, y: 40 });
    tl.to(steps[0], inn, 0.1)
      .to(steps[0], out, 1.0)
      .to(dot, { scale: 0.45, duration: 0.6 }, 1.0)
      .to(steps[1], inn, 1.3)
      .to(steps[1], out, 2.2)
      .to(dot, { opacity: 0, duration: 0.3 }, 2.3)
      .to(media, { clipPath: 'circle(75% at 50% 50%)', duration: 1.1, ease: 'power2.inOut' }, 2.3)
      .to(img, { scale: 1, duration: 1.4, ease: 'power2.out' }, 2.3)
      .to(steps[2], inn, 3.1)
      .to(steps[2], out, 4.0)
      .to(media, { opacity: 0.28, duration: 0.5 }, 4.0)
      .to(steps[3], inn, 4.3)
      .to({}, { duration: 0.5 }, 4.8);
    if (bar) tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: tl.duration(), ease: 'none' }, 0);
  });

  /* ---------------------------------------------------------------- pinned: seasons */
  safe('seasons', function () {
    var sec = $('[data-seasons]');
    if (!sec || !animOn) return;
    var track = $('[data-seasons-track]', sec);
    var bar = $('[data-seasons-bar]', sec);
    var mm = gsap.matchMedia();
    mm.add('(min-width: 900px)', function () {
      sec.classList.add('is-pinned');
      var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
      var tween = gsap.to(track, {
        x: function () { return -dist(); }, ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top top', end: function () { return '+=' + dist(); }, pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 }
      });
      if (bar) gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: sec, start: 'top top', end: function () { return '+=' + dist(); }, scrub: true, invalidateOnRefresh: true } });
      $$('.season', sec).forEach(function (s) {
        var word = $('.season__word', s);
        var card = $('.season__card', s);
        gsap.fromTo(word, { xPercent: 18 }, { xPercent: -18, ease: 'none', scrollTrigger: { trigger: s, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
        gsap.fromTo(card, { opacity: 0.25, scale: 0.9, rotate: -2 }, { opacity: 1, scale: 1, rotate: 0, ease: 'none', scrollTrigger: { trigger: s, containerAnimation: tween, start: 'left 95%', end: 'left 35%', scrub: true } });
      });
      return function () { sec.classList.remove('is-pinned'); gsap.set(track, { clearProps: 'transform' }); };
    });
    mm.add('(max-width: 899px)', function () {
      $$('.season__card', sec).forEach(function (c) {
        gsap.from(c, { opacity: 0, y: 50, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: c, start: 'top 88%', once: true } });
      });
    });
  });

  /* ---------------------------------------------------------------- pinned: about timeline */
  safe('timeline', function () {
    var sec = $('[data-timeline]');
    if (!sec) return;
    var items = $$('[data-tl]', sec);
    if (!animOn) { items.forEach(function (i) { i.classList.add('is-active'); }); return; }
    var track = $('[data-timeline-track]', sec);
    var fill = $('[data-timeline-fill]', sec);
    var mm = gsap.matchMedia();
    mm.add('(min-width: 900px)', function () {
      sec.classList.add('is-pinned');
      var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
      var tween = gsap.to(track, {
        x: function () { return -dist(); }, ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top top', end: function () { return '+=' + dist(); }, pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 }
      });
      gsap.fromTo(fill, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: sec, start: 'top top', end: function () { return '+=' + dist(); }, scrub: true, invalidateOnRefresh: true } });
      items.forEach(function (item) {
        ST.create({ trigger: item, containerAnimation: tween, start: 'left 72%', onEnter: function () { item.classList.add('is-active'); }, onLeaveBack: function () { item.classList.remove('is-active'); } });
      });
      return function () { sec.classList.remove('is-pinned'); gsap.set(track, { clearProps: 'transform' }); };
    });
    mm.add('(max-width: 899px)', function () {
      gsap.fromTo(fill, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: track, start: 'top 70%', end: 'bottom 70%', scrub: true } });
      items.forEach(function (item) {
        ST.create({ trigger: item, start: 'top 72%', onEnter: function () { item.classList.add('is-active'); }, onLeaveBack: function () { item.classList.remove('is-active'); } });
      });
    });
  });

  /* ---------------------------------------------------------------- reveals, parallax, counters */
  safe('reveals', function () {
    if (!animOn) return;
    var done = function (els) { return function () { els.forEach(function (el) { el.classList.add('is-in'); }); }; };
    ST.batch('[data-reveal]:not([data-reveal="clip"])', {
      start: 'top 90%', once: true,
      onEnter: function (batch) {
        gsap.to(batch, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08, overwrite: true, onComplete: done(batch), clearProps: 'transform,opacity' });
      }
    });
    $$('[data-reveal="clip"]').forEach(function (el) {
      gsap.fromTo(el, { clipPath: 'inset(100% 0% 0% 0% round 30px)' }, { clipPath: 'inset(0% 0% 0% 0% round 30px)', duration: 1.5, ease: 'expo.inOut', onComplete: done([el]), clearProps: 'clipPath', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });
    $$('[data-stagger]').forEach(function (el) {
      var kids = Array.prototype.slice.call(el.children);
      gsap.to(kids, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.06, onComplete: done(kids), clearProps: 'transform,opacity', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    });
  });

  safe('parallax', function () {
    if (!animOn) return;
    $$('[data-parallax]').forEach(function (el) {
      var amt = parseFloat(el.getAttribute('data-parallax')) || 0.12;
      gsap.fromTo(el, { yPercent: -amt * 45 }, { yPercent: amt * 45, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    var giant = $('.ftr__giant span');
    if (giant) gsap.fromTo(giant, { yPercent: 60 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.ftr__giant', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  });

  safe('counters', function () {
    if (!animOn) return;
    $$('[data-count]').forEach(function (el) {
      var target = parseFloat(el.getAttribute('data-count')) || 0;
      var obj = { v: 0 };
      el.textContent = '0';
      ST.create({
        trigger: el, start: 'top 92%', once: true,
        onEnter: function () {
          gsap.to(obj, { v: target, duration: target > 100 ? 2.4 : 1.6, ease: 'power3.out', onUpdate: function () { el.textContent = Math.round(obj.v).toLocaleString('en-US'); } });
        }
      });
    });
  });

  safe('scrub-words', function () {
    if (!animOn) return;
    $$('[data-scrub-words]').forEach(function (el) {
      var words = el.textContent.trim().split(/\s+/);
      el.setAttribute('aria-label', el.textContent.trim());
      el.textContent = '';
      words.forEach(function (w, i) {
        var s = d.createElement('span'); s.className = 'w'; s.setAttribute('aria-hidden', 'true'); s.textContent = w;
        el.appendChild(s);
        if (i < words.length - 1) el.appendChild(d.createTextNode(' '));
      });
      gsap.fromTo($$('.w', el), { opacity: 0.14 }, { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 48%', scrub: true } });
    });
  });

  safe('scramble', function () {
    $$('[data-scramble]').forEach(function (el) {
      if (!animOn) return;
      var final = el.textContent;
      var abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      var rnd = function () { return abc.charAt(Math.floor(Math.random() * abc.length)); };
      ST.create({
        trigger: el, start: 'top 85%', once: true,
        onEnter: function () {
          var frame = 0, total = 42;
          (function tick() {
            frame++;
            el.textContent = final.split('').map(function (ch, i) { return frame > (i + 1) * (total / final.length) ? ch : rnd(); }).join('');
            if (frame < total + 2) requestAnimationFrame(tick); else el.textContent = final;
          })();
        }
      });
    });
  });

  /* ---------------------------------------------------------------- marquee speed follows scroll velocity */
  safe('marquee', function () {
    var track = $('[data-marquee] .marquee__track');
    if (!track || reduce || !track.getAnimations || !lenis) return;
    var anim = track.getAnimations()[0];
    if (!anim) return;
    var timer;
    lenis.on('scroll', function (e) {
      var boost = 1 + Math.min(Math.abs(e.velocity) * 0.35, 6);
      anim.playbackRate = boost;
      clearTimeout(timer);
      timer = setTimeout(function () { gsap.to(anim, { playbackRate: 1, duration: 0.9, ease: 'power2.out' }); }, 90);
    });
  });

  /* ---------------------------------------------------------------- pointer effects */
  safe('magnetic', function () {
    if (!fine || reduce || !hasGsap) return;
    $$('[data-magnetic]').forEach(function (btn) {
      var xTo = gsap.quickTo(btn, 'x', { duration: 0.7, ease: 'elastic.out(1, 0.45)' });
      var yTo = gsap.quickTo(btn, 'y', { duration: 0.7, ease: 'elastic.out(1, 0.45)' });
      btn.addEventListener('pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.22);
        yTo((e.clientY - r.top - r.height / 2) * 0.32);
      });
      btn.addEventListener('pointerleave', function () { xTo(0); yTo(0); });
    });
  });

  safe('tilt', function () {
    $$('[data-tilt]').forEach(function (card) {
      var rx = null, ry = null;
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
        if (!fine || reduce || !hasGsap) return;
        if (!rx) {
          gsap.set(card, { transformPerspective: 1000 });
          rx = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3.out' });
          ry = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3.out' });
        }
        ry((px - 0.5) * 7);
        rx((0.5 - py) * 7);
      });
      card.addEventListener('pointerleave', function () { if (rx) { rx(0); ry(0); } });
    });
  });

  safe('cursor', function () {
    var c = $('.cursor');
    if (!c || !fine || !animOn) return;
    var dot = $('.cursor__dot', c), ring = $('.cursor__ring', c), label = $('.cursor__label', c);
    var dx = gsap.quickTo(dot, 'x', { duration: 0.08 }), dy = gsap.quickTo(dot, 'y', { duration: 0.08 });
    var rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3.out' }), ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3.out' });
    c.classList.add('is-hidden');
    var placed = false, overField = false;
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      if (!placed) { gsap.set([dot, ring], { x: e.clientX, y: e.clientY }); placed = true; }
      dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
      if (!overField) c.classList.remove('is-hidden');
    }, { passive: true });
    html.addEventListener('pointerleave', function () { c.classList.add('is-hidden'); });
    d.addEventListener('pointerover', function (e) {
      var labelled = e.target.closest('[data-cursor]');
      var link = e.target.closest('a, button, summary, label, select, .map-town, [role="button"]');
      var field = e.target.closest('input, textarea');
      c.classList.toggle('is-label', !!labelled);
      label.textContent = labelled ? labelled.getAttribute('data-cursor') : '';
      c.classList.toggle('is-link', !!link && !labelled);
      overField = !!field;
      if (overField || !placed) c.classList.add('is-hidden');
    });
  });

  safe('hover-img', function () {
    var box = $('.hover-img');
    if (!box || !fine || !animOn) return;
    var img = $('img', box);
    gsap.set(box, { xPercent: -50, yPercent: -50, x: 0, y: 0, scale: 0.6, opacity: 0 });
    var xTo = gsap.quickTo(box, 'x', { duration: 0.7, ease: 'power3.out' });
    var yTo = gsap.quickTo(box, 'y', { duration: 0.7, ease: 'power3.out' });
    var rTo = gsap.quickTo(box, 'rotation', { duration: 0.8, ease: 'power3.out' });
    var lastX = 0;
    window.addEventListener('pointermove', function (e) {
      xTo(e.clientX + 210); yTo(e.clientY);
      rTo(Math.max(-12, Math.min(12, (e.clientX - lastX) * 0.6)));
      lastX = e.clientX;
    }, { passive: true });
    $$('[data-hover-img]').forEach(function (row) {
      var pre = new Image(); pre.src = row.getAttribute('data-hover-img');
      row.addEventListener('pointerenter', function () {
        img.src = row.getAttribute('data-hover-img');
        gsap.to(box, { opacity: 1, scale: 1, duration: 0.6, ease: 'expo.out' });
      });
      row.addEventListener('pointerleave', function () { gsap.to(box, { opacity: 0, scale: 0.6, duration: 0.4, ease: 'power2.out' }); });
    });
  });

  /* ---------------------------------------------------------------- FAQ accordions */
  safe('faq', function () {
    $$('.faq__item').forEach(function (det) {
      var sum = $('summary', det), body = $('.faq__body', det);
      sum.addEventListener('click', function (e) {
        if (!hasGsap || reduce) return;
        e.preventDefault();
        gsap.killTweensOf(body);
        if (det.open) {
          gsap.to(body, { height: 0, duration: 0.45, ease: 'power3.inOut', onComplete: function () { det.open = false; body.style.height = ''; ST.refresh(); } });
        } else {
          det.open = true;
          gsap.fromTo(body, { height: 0 }, { height: 'auto', duration: 0.65, ease: 'expo.out', onComplete: function () { body.style.height = ''; ST.refresh(); } });
        }
      });
    });
  });

  /* ---------------------------------------------------------------- service area map + town checker */
  safe('map', function () {
    $$('[data-map]').forEach(function (map) {
      var towns = $$('.map-town', map);
      var links = $$('.map-link', map);
      var tip = $('.map-tip', map);
      if (animOn) {
        var hq = towns.filter(function (t) { return t.classList.contains('is-hq'); });
        var rest = towns.filter(function (t) { return !t.classList.contains('is-hq'); });
        gsap.timeline({ scrollTrigger: { trigger: map, start: 'top 78%', once: true } })
          .to(hq, { opacity: 1, duration: 0.5 })
          .to(links, { strokeDashoffset: 0, duration: 1.3, stagger: 0.035, ease: 'power2.inOut' }, 0.15)
          .to(rest, { opacity: 1, duration: 0.45, stagger: 0.035 }, 0.55);
      }
      function show(t) {
        var dot = $('.map-dot', t);
        var r = dot.getBoundingClientRect(), mr = map.getBoundingClientRect();
        tip.textContent = t.getAttribute('data-town');
        var small = d.createElement('small'); small.textContent = t.getAttribute('data-county') + ' County';
        tip.appendChild(small);
        tip.style.left = (r.left + r.width / 2 - mr.left) + 'px';
        tip.style.top = (r.top - mr.top) + 'px';
        tip.classList.add('is-on');
      }
      function hide() { tip.classList.remove('is-on'); }
      towns.forEach(function (t) {
        t.addEventListener('pointerenter', function () { show(t); });
        t.addEventListener('focus', function () { show(t); });
        t.addEventListener('click', function () { show(t); });
        t.addEventListener('pointerleave', hide);
        t.addEventListener('blur', hide);
      });
    });
  });

  safe('town-check', function () {
    $$('[data-town-check]').forEach(function (form) {
      var input = $('input', form), out = $('[data-town-result]', form);
      var data = JSON.parse($('[data-town-data]', form).textContent);
      var norm = function (s) { return s.toLowerCase().replace(/[^a-z]/g, ''); };
      var index = Object.keys(data).map(function (n) { return [norm(n), n]; });
      var timer;
      function run() {
        var raw = input.value.trim(), q = norm(raw);
        $$('.map-town.is-match, [data-town-item].is-match').forEach(function (x) { x.classList.remove('is-match'); });
        out.className = 'town-check__result';
        out.textContent = '';
        if (q.length < 3) return;
        var hit = index.filter(function (p) { return p[0] === q; })[0] || index.filter(function (p) { return p[0].indexOf(q) === 0; })[0];
        if (hit) {
          var name = hit[1];
          out.classList.add('is-yes');
          out.textContent = 'Yes! ' + name + ' is in our ' + data[name] + ' County service area.';
          $$('.map-town, [data-town-item]').forEach(function (x) {
            if (x.getAttribute('data-town') === name || x.getAttribute('data-town-item') === name) x.classList.add('is-match');
          });
        } else {
          out.classList.add('is-maybe');
          out.appendChild(d.createTextNode(raw + ' is not on our list, but we may still serve it. Call '));
          var a = d.createElement('a'); a.href = PHONE.href; a.textContent = PHONE.text;
          out.appendChild(a);
          out.appendChild(d.createTextNode(' to ask.'));
        }
      }
      input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 160); });
      input.addEventListener('change', run);
      form.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    });
  });

  /* ---------------------------------------------------------------- pest library */
  var openPest = null;
  safe('library', function () {
    var grid = $('[data-pest-grid]');
    if (!grid) return;
    var cards = $$('[data-pest]', grid);
    var search = $('[data-pest-search]');
    var filters = $$('[data-filter]');
    var count = $('[data-pest-count]');
    var empty = $('[data-pest-empty]');
    var group = 'all';
    var timer;

    if (animOn) gsap.from(cards, { opacity: 0, y: 40, duration: 0.9, stagger: 0.04, ease: 'expo.out', clearProps: 'transform,opacity', scrollTrigger: { trigger: grid, start: 'top 90%', once: true } });

    function apply() {
      var q = search.value.trim().toLowerCase();
      var state = animOn && window.Flip ? window.Flip.getState(cards) : null;
      var n = 0;
      cards.forEach(function (c) {
        var ok = (group === 'all' || c.getAttribute('data-group') === group) && (!q || c.getAttribute('data-name').indexOf(q) !== -1);
        c.hidden = !ok;
        if (ok) n++;
      });
      count.textContent = n === cards.length ? 'Showing all ' + n + ' pests' : 'Showing ' + n + ' of ' + cards.length + ' pests';
      empty.hidden = n > 0;
      if (state) {
        window.Flip.from(state, {
          duration: 0.65, ease: 'expo.out', absolute: true, scale: false,
          onEnter: function (els) { return gsap.fromTo(els, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.5, clearProps: 'transform' }); },
          onLeave: function (els) { return gsap.to(els, { opacity: 0, scale: 0.92, duration: 0.3 }); },
          onComplete: function () { ST.refresh(); }
        });
      }
    }
    filters.forEach(function (b) {
      b.addEventListener('click', function () {
        group = b.getAttribute('data-filter');
        filters.forEach(function (x) { var on = x === b; x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', String(on)); });
        apply();
      });
    });
    search.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(apply, 140); });

    var dlg = $('[data-pest-dialog]');
    if (!dlg || typeof dlg.showModal !== 'function') return;
    var opener = null;
    openPest = function (card, fromClick) {
      $('[data-pest-dialog-icon]', dlg).innerHTML = $('.pest__icon', card).innerHTML;
      $('[data-pest-dialog-title]', dlg).textContent = $('.pest__name', card).textContent;
      $('[data-pest-dialog-group]', dlg).textContent = $('.pest__group', card).textContent;
      $('[data-pest-dialog-body]', dlg).innerHTML = $('.pest__detail', card).innerHTML;
      opener = fromClick ? $('[data-pest-open]', card) : null;
      dlg.showModal();
      $('.pest-dialog__inner', dlg).scrollTop = 0;
      if (lenis) lenis.stop();
      if (history.replaceState) history.replaceState(null, '', '#' + card.id);
    };
    cards.forEach(function (card) {
      $('[data-pest-open]', card).addEventListener('click', function () { openPest(card, true); });
    });
    $('[data-pest-close]', dlg).addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', function () {
      if (lenis) lenis.start();
      if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
      if (opener) opener.focus();
    });
    window.addEventListener('hashchange', function () {
      var t = location.hash && d.getElementById(location.hash.slice(1));
      if (t && t.hasAttribute('data-pest') && !dlg.open) { scrollToEl(t, true); openPest(t, false); }
    });
    var fromHash = location.hash && d.getElementById(location.hash.slice(1));
    if (fromHash && fromHash.hasAttribute('data-pest')) {
      setTimeout(function () { scrollToEl(fromHash, true); openPest(fromHash, false); }, 350);
    }
  });

  /* ---------------------------------------------------------------- packages: plan finder + guarantee line */
  safe('finder', function () {
    var finder = $('[data-finder]');
    var wrap = $('[data-plans]');
    if (!finder || !wrap) return;
    var opts = $$('[data-finder-opt]', finder);
    var out = $('[data-finder-result]', finder);
    var plans = $$('[data-plan]', wrap);
    var original = plans.slice();
    function name(slug) { var p = plans.filter(function (x) { return x.getAttribute('data-plan') === slug; })[0]; return p ? $('.plan__name', p).textContent : ''; }
    function reorder(first) {
      var state = animOn && window.Flip ? window.Flip.getState(plans) : null;
      var order = first ? [first].concat(original.filter(function (p) { return p !== first; })) : original;
      order.forEach(function (p) { wrap.appendChild(p); });
      if (state) window.Flip.from(state, { duration: 0.8, ease: 'expo.inOut', absolute: false });
    }
    opts.forEach(function (o) {
      o.addEventListener('change', function () {
        var on = {};
        opts.forEach(function (x) { if (x.checked) on[x.value] = true; });
        plans.forEach(function (p) { p.classList.remove('is-recommended'); });
        out.textContent = '';
        if (!Object.keys(on).length) { out.textContent = 'Pick one or more and we will point you to a plan.'; reorder(null); return; }
        var pick = 'home-protection', note = '';
        if (on.lawn) pick = 'all-in-one';
        else if (on.ticks) pick = 'flea-tick';
        else if (on.rodents) pick = 'rodent';
        if (on.rodents && pick !== 'rodent') note = ' Mention your mouse or rat concerns during your estimate too.';
        var card = plans.filter(function (p) { return p.getAttribute('data-plan') === pick; })[0];
        card.classList.add('is-recommended');
        out.appendChild(d.createTextNode('We recommend the '));
        var s = d.createElement('strong'); s.textContent = name(pick); out.appendChild(s);
        out.appendChild(d.createTextNode('.' + note + ' Your free estimate confirms the right fit.'));
        reorder(card);
      });
    });
  });

  safe('gline', function () {
    var g = $('[data-gline]');
    if (!g || !animOn) return;
    gsap.timeline({ scrollTrigger: { trigger: g, start: 'top 82%', end: 'bottom 45%', scrub: 1 } })
      .fromTo('[data-gline-fill]', { scaleX: 0 }, { scaleX: 1, ease: 'none', duration: 1 }, 0)
      .fromTo($$('.gline__visits span', g), { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, stagger: 0.25, duration: 0.12 }, 0)
      .fromTo('[data-gline-bug]', { opacity: 0, y: -24 }, { opacity: 1, y: 0, duration: 0.12 }, 0.4)
      .fromTo('[data-gline-free]', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.12 }, 0.5);
  });

  /* ---------------------------------------------------------------- forms */
  safe('forms', function () {
    var params = new URLSearchParams(location.search);
    $$('[data-form]').forEach(function (form) {
      var sel = $('select[name="service"]', form);
      if (sel && (params.get('plan') || params.get('service'))) {
        var opt = Array.prototype.filter.call(sel.options, function (o) {
          return (params.get('plan') && o.getAttribute('data-plan') === params.get('plan')) || (params.get('service') && o.getAttribute('data-service') === params.get('service'));
        })[0];
        if (opt) sel.value = opt.value;
      }
      var status = $('[data-form-status]', form);
      var success = form.nextElementSibling && form.nextElementSibling.hasAttribute('data-form-success') ? form.nextElementSibling : null;
      var emailRe = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

      $$('input, textarea', form).forEach(function (el) {
        el.addEventListener('input', function () { var f = el.closest('.field'); if (f) f.classList.remove('is-invalid'); });
      });

      form.addEventListener('submit', function (e) {
        var bad = null;
        $$('[required]', form).forEach(function (el) {
          var v = el.value.trim();
          var ok = el.type === 'email' ? emailRe.test(v) : v.length > 0;
          var f = el.closest('.field'); if (f) f.classList.toggle('is-invalid', !ok);
          if (!ok && !bad) bad = el;
        });
        if (bad) {
          e.preventDefault();
          status.className = 'form__status is-error';
          status.textContent = 'Please add your name, a valid email address and a short message.';
          bad.focus();
          return;
        }
        if (!window.fetch || !window.FormData || !window.URLSearchParams) return; // normal post + redirect
        e.preventDefault();
        form.classList.add('is-loading');
        status.className = 'form__status';
        status.textContent = 'Sending...';
        fetch(form.action, { method: 'POST', headers: { Accept: 'application/json' }, body: new URLSearchParams(new FormData(form)) })
          .then(function (res) { return res.json().catch(function () { return {}; }).then(function (data) { return { res: res, data: data }; }); })
          .then(function (r) {
            if (r.res.ok && r.data.ok) {
              status.textContent = '';
              if (success) {
                form.hidden = true;
                success.hidden = false;
                success.focus({ preventScroll: true });
                if (animOn) gsap.from(success.children, { opacity: 0, y: 30, duration: 0.9, stagger: 0.1, ease: 'expo.out' });
                ST.refresh();
              } else status.textContent = 'Thanks! Your request is on its way.';
              return;
            }
            throw new Error(r.data.error || 'send failed');
          })
          .catch(function (err) {
            status.className = 'form__status is-error';
            status.textContent = err && err.message === 'invalid'
              ? 'Please add your name, a valid email address and a short message.'
              : 'Sorry, your message could not be sent right now. Please call ' + PHONE.text + ' and we will take care of you.';
          })
          .then(function () { form.classList.remove('is-loading'); });
      });
    });
  });

  /* ---------------------------------------------------------------- split headings (after fonts), final refresh */
  function splits() {
    safe('splits', function () {
      $$('[data-split]').forEach(function (el) {
        if (!animOn || !window.SplitText) { el.style.visibility = 'visible'; return; }
        var hero = el.getAttribute('data-split') === 'hero';
        window.SplitText.create(el, {
          type: 'lines', mask: 'lines', linesClass: 'split-line', autoSplit: true,
          onSplit: function (self) {
            gsap.set(el, { visibility: 'visible' });
            return gsap.from(self.lines, {
              yPercent: 115, duration: 1.2, ease: 'expo.out', stagger: 0.09, delay: hero ? (html.classList.contains('wipe-in') ? 0.4 : 0.1) : 0,
              scrollTrigger: hero ? null : { trigger: el, start: 'top 90%', once: true }
            });
          }
        });
      });
    });
    if (hasGsap) {
      ST.sort();
      ST.refresh();
      if (location.hash && !$('[data-pest-grid]')) {
        var t = hashTarget(location.hash);
        if (t) setTimeout(function () { scrollToEl(t, true); }, 80);
      }
    }
  }
  var fontsDone = false;
  function once() { if (!fontsDone) { fontsDone = true; splits(); } }
  if (d.fonts && d.fonts.ready) { d.fonts.ready.then(once); setTimeout(once, 1800); } else once();
  window.addEventListener('load', function () { if (hasGsap) ST.refresh(); });
})();
