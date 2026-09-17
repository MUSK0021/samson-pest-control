/* Samson Pest Control: "a line pests do not want to cross". A top down yard where ants march toward
   the house. With protection on, a glowing perimeter turns them away. Cursor or finger scatters them.
   Plain canvas 2D, pauses when off screen. */
(function () {
  'use strict';
  var canvas = document.querySelector('[data-perimeter]');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var toggle = document.querySelector('[data-perimeter-toggle]');
  var outBlocked = document.querySelector('[data-perimeter-blocked]');
  var outInside = document.querySelector('[data-perimeter-inside]');

  var W = 0, H = 0, DPR = 1, R = 100, cx = 0, cy = 0, houseW = 0, houseH = 0;
  var lawn = null;
  var on = true;
  var ringAlpha = 1;
  var ringPulse = 0;
  var blocked = 0, inside = 0, shownBlocked = -1, shownInside = -1;
  var ants = [], sparks = [];
  var pointer = { x: -9999, y: -9999 };
  var visible = false, running = false, last = 0, time = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ---------------------------------------------------------------- scene */
  function buildLawn() {
    lawn = document.createElement('canvas');
    lawn.width = Math.round(W * DPR);
    lawn.height = Math.round(H * DPR);
    var g = lawn.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, 0);

    var base = g.createLinearGradient(0, 0, W, H);
    base.addColorStop(0, '#356b25');
    base.addColorStop(1, '#2a5a1e');
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);

    // mowing stripes
    g.save();
    g.translate(W / 2, H / 2);
    g.rotate(-0.5);
    var stripe = Math.max(34, W / 12);
    for (var x = -W * 1.5, i = 0; x < W * 1.5; x += stripe, i++) {
      g.fillStyle = i % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)';
      g.fillRect(x, -H * 1.5, stripe, H * 3);
    }
    g.restore();

    // grass texture
    var tufts = Math.round(W * H / 90);
    for (var t = 0; t < tufts; t++) {
      var tx = Math.random() * W, ty = Math.random() * H;
      g.strokeStyle = Math.random() > 0.5 ? 'rgba(120,190,80,0.18)' : 'rgba(10,40,10,0.18)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(tx, ty);
      g.lineTo(tx + rand(-2, 2), ty - rand(2, 5));
      g.stroke();
    }

    // walkway from the house to the bottom edge
    g.fillStyle = '#c9bf9f';
    var pw = houseW * 0.16;
    g.fillRect(cx - pw / 2, cy + houseH / 2, pw, H - cy - houseH / 2);
    g.fillStyle = 'rgba(0,0,0,0.08)';
    for (var s = cy + houseH / 2 + 10; s < H; s += 18) g.fillRect(cx - pw / 2, s, pw, 2);

    // trees and shrubs
    var trees = [[0.12, 0.2, 0.09], [0.88, 0.16, 0.075], [0.9, 0.84, 0.1], [0.08, 0.86, 0.07], [0.6, 0.06, 0.05]];
    trees.forEach(function (tr) {
      var x = tr[0] * W, y = tr[1] * H, r = tr[2] * Math.min(W, H) * 1.3;
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.beginPath(); g.ellipse(x + r * 0.25, y + r * 0.3, r, r * 0.9, 0, 0, Math.PI * 2); g.fill();
      var tg = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
      tg.addColorStop(0, '#5c9e36');
      tg.addColorStop(1, '#1f4a17');
      g.fillStyle = tg;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    });

    // house (top down roof)
    var hx = cx - houseW / 2, hy = cy - houseH / 2;
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(hx + 8, hy + 10, houseW, houseH);
    g.fillStyle = '#3a3f3b';
    g.fillRect(hx, hy, houseW, houseH);
    g.fillStyle = '#474d48';
    g.beginPath();
    g.moveTo(hx, hy); g.lineTo(hx + houseH / 2, cy); g.lineTo(hx, hy + houseH); g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(hx + houseW, hy); g.lineTo(hx + houseW - houseH / 2, cy); g.lineTo(hx + houseW, hy + houseH); g.closePath(); g.fill();
    g.fillStyle = '#2f3430';
    g.beginPath();
    g.moveTo(hx, hy); g.lineTo(hx + houseW, hy); g.lineTo(hx + houseW - houseH / 2, cy); g.lineTo(hx + houseH / 2, cy); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(hx + houseH / 2, cy); g.lineTo(hx + houseW - houseH / 2, cy); g.stroke();
    g.fillStyle = '#6b4a3a';
    g.fillRect(hx + houseW * 0.7, hy + houseH * 0.12, houseW * 0.08, houseW * 0.08);
  }

  function resize() {
    var r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cx = W / 2; cy = H * 0.48;
    R = Math.min(W, H) * 0.33;
    houseW = R * 1.05; houseH = R * 0.72;
    buildLawn();
    if (!ants.length) seed();
    if (reduce || !running) draw();
  }

  /* ---------------------------------------------------------------- ants */
  function spawn(a, scatter) {
    var side = Math.floor(Math.random() * 4), m = 24;
    if (side === 0) { a.x = rand(0, W); a.y = -m; }
    else if (side === 1) { a.x = W + m; a.y = rand(0, H); }
    else if (side === 2) { a.x = rand(0, W); a.y = H + m; }
    else { a.x = -m; a.y = rand(0, H); }
    if (scatter) {
      var ang = Math.random() * Math.PI * 2, dist = rand(R * 1.25, Math.max(W, H) * 0.6);
      a.x = cx + Math.cos(ang) * dist; a.y = cy + Math.sin(ang) * dist;
    }
    a.angle = Math.atan2(cy - a.y, cx - a.x) + rand(-0.4, 0.4);
    a.speed = rand(22, 38);
    a.turn = 0;
    a.phase = Math.random() * 10;
    a.state = 'in';
    a.alpha = 1;
    a.wait = scatter ? 0 : rand(0, 2.5);
    a.size = rand(0.85, 1.2) * Math.max(0.8, Math.min(W, H) / 520);
    a.scared = 0;
  }
  function seed() {
    ants = [];
    var n = W < 520 ? 22 : 36;
    for (var i = 0; i < n; i++) { var a = {}; spawn(a, true); ants.push(a); }
  }

  function angleDiff(a, b) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function burst(x, y) {
    for (var i = 0; i < 10; i++) {
      var ang = Math.random() * Math.PI * 2, sp = rand(20, 70);
      sparks.push({ x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: rand(0.35, 0.7), max: 0.7 });
    }
  }

  function update(dt) {
    time += dt;
    ringAlpha += ((on ? 1 : 0) - ringAlpha) * Math.min(1, dt * 5);
    ringPulse = Math.max(0, ringPulse - dt * 2.5);
    for (var i = 0; i < ants.length; i++) {
      var a = ants[i];
      if (a.wait > 0) { a.wait -= dt; continue; }
      var dx = cx - a.x, dy = cy - a.y, d = Math.sqrt(dx * dx + dy * dy);
      var speed = a.speed;

      // cursor scares
      var px = a.x - pointer.x, py = a.y - pointer.y, pd = Math.sqrt(px * px + py * py);
      if (pd < 90) { a.scared = 0.8; a.angle += angleDiff(a.angle, Math.atan2(py, px)) * Math.min(1, dt * 10); }
      if (a.scared > 0) { a.scared -= dt; speed *= 2.4; }

      if (a.state === 'in') {
        a.turn += (Math.random() - 0.5) * dt * 7;
        a.turn *= 0.94;
        if (a.scared <= 0) a.angle += angleDiff(a.angle, Math.atan2(dy, dx)) * dt * 1.6;
        a.angle += a.turn * dt;
        if (on && d < R + 4) {
          a.state = 'out';
          a.angle = Math.atan2(-dy, -dx) + rand(-0.7, 0.7);
          a.speed = rand(40, 60);
          blocked++;
          ringPulse = 1;
          burst(cx - dx / d * R, cy - dy / d * R);
        } else if (!on && Math.abs(dx) < houseW * 0.42 && Math.abs(dy) < houseH * 0.4) {
          a.state = 'inside';
          inside++;
        }
      } else if (a.state === 'out') {
        a.turn += (Math.random() - 0.5) * dt * 4;
        a.turn *= 0.95;
        a.angle += a.turn * dt;
        if (a.x < -40 || a.x > W + 40 || a.y < -40 || a.y > H + 40) spawn(a, false);
      } else if (a.state === 'inside') {
        a.alpha -= dt * 2.2;
        speed *= 0.4;
        if (a.alpha <= 0) spawn(a, false);
      }
      a.x += Math.cos(a.angle) * speed * dt;
      a.y += Math.sin(a.angle) * speed * dt;
      a.phase += speed * dt * 0.45;
    }
    for (var s = sparks.length - 1; s >= 0; s--) {
      var p = sparks[s];
      p.life -= dt;
      if (p.life <= 0) { sparks.splice(s, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92;
    }
  }

  /* ---------------------------------------------------------------- drawing */
  function drawAnt(a) {
    var s = a.size;
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.angle);
    ctx.globalAlpha = Math.max(0, a.alpha);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(1.5, 2.5, 9 * s, 3.2 * s, 0, 0, Math.PI * 2); ctx.fill();
    // legs
    ctx.strokeStyle = '#140f0c';
    ctx.lineWidth = 1.1 * s;
    ctx.lineCap = 'round';
    for (var i = 0; i < 3; i++) {
      var swing = Math.sin(a.phase + i * 2.1) * 0.45;
      var baseX = (1 - i) * 2.4 * s;
      for (var side = -1; side <= 1; side += 2) {
        var ang = side * (1.25 + (i - 1) * 0.5) + (side * swing * (i % 2 ? -1 : 1));
        var kx = baseX + Math.cos(ang) * 3.2 * s, ky = Math.sin(ang) * 3.2 * s;
        var fx = kx + Math.cos(ang + side * -0.5 + (1 - i) * 0.3) * 3.4 * s, fy = ky + Math.sin(ang + side * -0.5) * 3.4 * s;
        ctx.beginPath(); ctx.moveTo(baseX, 0); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
      }
    }
    // antennae
    var wag = Math.sin(a.phase * 0.7) * 0.2;
    ctx.beginPath(); ctx.moveTo(6.5 * s, -1 * s); ctx.lineTo(9.5 * s, (-3.2 + wag) * s); ctx.lineTo(11.5 * s, (-2.2 + wag) * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6.5 * s, 1 * s); ctx.lineTo(9.5 * s, (3.2 - wag) * s); ctx.lineTo(11.5 * s, (2.2 - wag) * s); ctx.stroke();
    // body: abdomen, thorax, head
    ctx.fillStyle = '#1b1310';
    ctx.beginPath(); ctx.ellipse(-5.2 * s, 0, 4.4 * s, 3.1 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0.6 * s, 0, 2.6 * s, 1.6 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5 * s, 0, 2.2 * s, 2 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath(); ctx.ellipse(-6 * s, -1.1 * s, 1.8 * s, 0.9 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawRing() {
    if (ringAlpha < 0.02) {
      ctx.save();
      ctx.setLineDash([4, 10]);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.globalAlpha = ringAlpha;
    var glow = ctx.createRadialGradient(cx, cy, R * 0.82, cx, cy, R * 1.18);
    glow.addColorStop(0, 'rgba(93,175,82,0)');
    glow.addColorStop(0.5, 'rgba(120,210,100,' + (0.2 + ringPulse * 0.25) + ')');
    glow.addColorStop(1, 'rgba(0,170,175,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.18, 0, Math.PI * 2); ctx.arc(cx, cy, R * 0.82, 0, Math.PI * 2, true); ctx.fill();
    ctx.setLineDash([10, 12]);
    ctx.lineDashOffset = -time * 26;
    ctx.strokeStyle = 'rgba(200,245,180,' + (0.75 + ringPulse * 0.25) + ')';
    ctx.lineWidth = 2 + ringPulse * 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(0,170,175,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R + 7, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function draw() {
    if (!lawn) return;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(lawn, 0, 0, W, H);
    drawRing();
    for (var i = 0; i < ants.length; i++) if (ants[i].wait <= 0) drawAnt(ants[i]);
    for (var s = 0; s < sparks.length; s++) {
      var p = sparks[s];
      ctx.fillStyle = 'rgba(190,245,160,' + (p.life / p.max) + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
    }
    if (pointer.x > -999) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 26 + Math.sin(time * 6) * 3, 0, Math.PI * 2); ctx.stroke();
    }
    if (shownBlocked !== blocked && outBlocked) { outBlocked.textContent = blocked; shownBlocked = blocked; }
    if (shownInside !== inside && outInside) { outInside.textContent = inside; shownInside = inside; }
  }

  function loop(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }
  function play() {
    if (running || reduce || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }
  function pause() { running = false; }

  /* ---------------------------------------------------------------- events */
  if (toggle) {
    toggle.addEventListener('click', function () {
      on = !on;
      toggle.setAttribute('aria-pressed', String(on));
      var label = toggle.querySelector('.toggle__label');
      if (label) label.textContent = on ? label.getAttribute('data-on') : label.getAttribute('data-off');
      if (reduce) { ringAlpha = on ? 1 : 0; draw(); }
    });
  }
  function setPointer(e) {
    var r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
  }
  canvas.addEventListener('pointermove', setPointer, { passive: true });
  canvas.addEventListener('pointerdown', function (e) {
    setPointer(e);
    for (var i = 0; i < ants.length; i++) {
      var a = ants[i], dx = a.x - pointer.x, dy = a.y - pointer.y;
      if (dx * dx + dy * dy < 150 * 150) { a.scared = 1.2; a.angle = Math.atan2(dy, dx); }
    }
    burst(pointer.x, pointer.y);
  }, { passive: true });
  canvas.addEventListener('pointerleave', function () { pointer.x = -9999; pointer.y = -9999; });
  canvas.addEventListener('pointercancel', function () { pointer.x = -9999; pointer.y = -9999; });

  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 150); }, { passive: true });
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); else play(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) { if (!W) resize(); play(); } else pause();
    }, { rootMargin: '100px' }).observe(canvas);
  } else { visible = true; play(); }

  resize();
})();
