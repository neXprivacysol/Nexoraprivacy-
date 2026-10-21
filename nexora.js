window.NX_DEFAULT_NET='devnet';
/* Nexora shared script: navigation, wallet connection, form helpers and eleven canvas animations. */
(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var PAGES = [
    ['shield', 'Shield'], ['send', 'Send'], ['swap', 'Swap'], ['vault', 'Vault'],
    ['wallets', 'Wallets'], ['features', 'Features'], ['security', 'Security'],
    ['docs', 'Docs'], ['help', 'Help']
  ];

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function white(a) { return 'rgba(255,255,255,' + Math.max(0, Math.min(1, a)).toFixed(3) + ')'; }

  /* ------------------------------------------------------------------ */
  /* Animations. Each factory receives (w, h, mouse) and returns draw(ctx, t) */
  /* ------------------------------------------------------------------ */
  var ANIMS = {};

  /* 1. Constellation sphere: the Nexora mark */
  function makeSphere(n, link, longN, mini) {
    return function (w, h, m) {
      var R = rng(7), pts = [], edges = [], seen = {}, i, j;
      for (i = 0; i < n; i++) {
        var u = R() * 2 - 1, a = R() * TAU, s = Math.sqrt(1 - u * u);
        pts.push({ x: s * Math.cos(a), y: u, z: s * Math.sin(a), b: R(), sx: 0, sy: 0, sz: 0 });
      }
      function add(p, q) {
        var k = p < q ? p * n + q : q * n + p;
        if (!seen[k]) { seen[k] = 1; edges.push([pts[p], pts[q]]); }
      }
      for (i = 0; i < n; i++) {
        var near = [];
        for (j = 0; j < n; j++) {
          if (i === j) continue;
          var dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, dz = pts[i].z - pts[j].z;
          var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d < link) near.push([d, j]);
        }
        near.sort(function (p, q) { return p[0] - q[0]; });
        for (j = 0; j < Math.min(2, near.length); j++) add(i, near[j][1]);
      }
      var tries = 0;
      while (longN > 0 && tries < 4000) {
        tries++;
        var p = (R() * n) | 0, q = (R() * n) | 0;
        if (p === q) continue;
        var ex = pts[p].x - pts[q].x, ey = pts[p].y - pts[q].y, ez = pts[p].z - pts[q].z;
        var dd = Math.sqrt(ex * ex + ey * ey + ez * ez);
        if (dd > 0.7 && dd < 1.5) { add(p, q); longN--; }
      }
      var tx = 0.5, ty = 0.5;
      return function (ctx, t) {
        tx += ((m ? m.x : 0.5) - tx) * 0.05; ty += ((m ? m.y : 0.5) - ty) * 0.05;
        var cx = w / 2, cy = h / 2, rad = Math.min(w, h) * (mini ? 0.46 : 0.44);
        var ay = t * 0.14 + (tx - 0.5) * 0.9, ax = -0.25 + (ty - 0.5) * 0.6;
        var ca = Math.cos(ay), sa = Math.sin(ay), cb = Math.cos(ax), sb = Math.sin(ax), k, p2, e, d2;
        for (k = 0; k < pts.length; k++) {
          p2 = pts[k];
          var x1 = p2.x * ca + p2.z * sa, z1 = -p2.x * sa + p2.z * ca;
          p2.sx = cx + x1 * rad; p2.sy = cy + (p2.y * cb - z1 * sb) * rad; p2.sz = p2.y * sb + z1 * cb;
        }
        ctx.lineWidth = mini ? 0.6 : 0.7;
        for (k = 0; k < edges.length; k++) {
          e = edges[k];
          d2 = ((e[0].sz + e[1].sz) / 2 + 1) / 2;
          ctx.strokeStyle = white(0.1 + 0.42 * d2);
          ctx.beginPath(); ctx.moveTo(e[0].sx, e[0].sy); ctx.lineTo(e[1].sx, e[1].sy); ctx.stroke();
        }
        for (k = 0; k < pts.length; k++) {
          p2 = pts[k];
          d2 = (p2.sz + 1) / 2;
          var r = (mini ? 0.9 : 0.8) + p2.b * p2.b * (mini ? 1.3 : 2.1) * (0.5 + d2);
          if (p2.b > 0.86) {
            ctx.fillStyle = white(0.14 * d2);
            ctx.beginPath(); ctx.arc(p2.sx, p2.sy, r * 4, 0, TAU); ctx.fill();
          }
          ctx.fillStyle = white(0.3 + 0.7 * d2);
          ctx.beginPath(); ctx.arc(p2.sx, p2.sy, r, 0, TAU); ctx.fill();
        }
      };
    };
  }
  ANIMS.sphere = makeSphere(430, 0.3, 42, false);
  ANIMS.logo = makeSphere(120, 0.5, 8, true);

  /* 2. Orbit: nodes on tilted ellipses sending pulses to a core (connect) */
  ANIMS.orbit = function (w, h) {
    var R = rng(3), base = Math.min(w, h), nodes = [], i;
    for (i = 0; i < 9; i++) {
      nodes.push({ a: base * (0.14 + 0.05 * i), b: base * (0.08 + 0.028 * i), rot: (i % 3) * 0.6 - 0.5, ph: R() * TAU, sp: (0.22 + 0.07 * (i % 4)) * (i % 2 ? 1 : -1) });
    }
    return function (ctx, t) {
      var cx = w * 0.62, cy = h * 0.5, i2, nd;
      if (w < 700) cx = w * 0.5;
      ctx.lineWidth = 1;
      for (i2 = 0; i2 < nodes.length; i2++) {
        nd = nodes[i2];
        ctx.strokeStyle = white(0.1);
        ctx.beginPath(); ctx.ellipse(cx, cy, nd.a, nd.b, nd.rot, 0, TAU); ctx.stroke();
      }
      var pulse = 1 + 0.12 * Math.sin(t * 2);
      ctx.strokeStyle = white(0.7); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, base * 0.045 * pulse, 0, TAU); ctx.stroke();
      ctx.fillStyle = white(0.95); ctx.beginPath(); ctx.arc(cx, cy, base * 0.014, 0, TAU); ctx.fill();
      ctx.lineWidth = 1;
      for (i2 = 0; i2 < nodes.length; i2++) {
        nd = nodes[i2];
        var th = nd.ph + t * nd.sp;
        var ex = nd.a * Math.cos(th), ey = nd.b * Math.sin(th);
        var x = cx + ex * Math.cos(nd.rot) - ey * Math.sin(nd.rot);
        var y = cy + ex * Math.sin(nd.rot) + ey * Math.cos(nd.rot);
        ctx.strokeStyle = white(0.12);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(cx, cy); ctx.stroke();
        var u = (t * 0.45 + i2 * 0.37) % 1;
        ctx.fillStyle = white(0.9 * (1 - u));
        ctx.beginPath(); ctx.arc(x + (cx - x) * u, y + (cy - y) * u, 2.2, 0, TAU); ctx.fill();
        ctx.fillStyle = white(0.9);
        ctx.fillRect(x - 4, y - 4, 8, 8);
        ctx.strokeStyle = white(0.35);
        ctx.strokeRect(x - 8, y - 8, 16, 16);
      }
    };
  };

  /* 3. Mesh: drifting network nodes (wallets) */
  ANIMS.mesh = function (w, h, m) {
    var R = rng(11), n = Math.max(40, Math.min(120, (w * h / 13000) | 0)), pts = [], i, last = 0;
    for (i = 0; i < n; i++) pts.push({ x: R() * w, y: R() * h, vx: (R() - 0.5) * 24, vy: (R() - 0.5) * 24, r: 1 + R() * 1.6 });
    return function (ctx, t) {
      var dt = Math.min(0.05, t - last); last = t; if (dt < 0) dt = 0;
      var j, p, q, d, lim = 130;
      for (i = 0; i < n; i++) {
        p = pts[i]; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
      ctx.lineWidth = 0.8;
      for (i = 0; i < n; i++) {
        for (j = i + 1; j < n; j++) {
          p = pts[i]; q = pts[j];
          d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < lim) { ctx.strokeStyle = white((1 - d / lim) * 0.5); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
        }
      }
      for (i = 0; i < n; i++) {
        p = pts[i]; ctx.fillStyle = white(0.85);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      }
    };
  };

  /* 4. Vortex: particles spiral into a ring (shield) */
  ANIMS.vortex = function (w, h) {
    var R = rng(5), base = Math.min(w, h), maxR = Math.hypot(w, h) * 0.5, r0 = base * 0.1, n = 320, ps = [], i, last = 0;
    for (i = 0; i < n; i++) ps.push({ a: R() * TAU, r: r0 + R() * (maxR - r0), s: 0.6 + R() * 0.9 });
    return function (ctx, t) {
      var dt = Math.min(0.05, t - last); last = t; if (dt < 0) dt = 0;
      var cx = w * 0.5, cy = h * 0.5, p, k;
      for (k = 0; k < n; k++) {
        p = ps[k];
        var pa = p.a, pr = p.r;
        p.r -= (30 + (p.r / maxR) * 140) * p.s * dt;
        p.a += (90 / Math.max(p.r, 40)) * p.s * dt * 1.4;
        if (p.r < r0) { p.r = maxR * (0.7 + Math.random() * 0.3); p.a = Math.random() * TAU; pa = p.a; pr = p.r; }
        var x0 = cx + Math.cos(pa) * pr, y0 = cy + Math.sin(pa) * pr * 0.82;
        var x1 = cx + Math.cos(p.a) * p.r, y1 = cy + Math.sin(p.a) * p.r * 0.82;
        var al = 0.2 + 0.7 * (1 - (p.r - r0) / (maxR - r0));
        ctx.strokeStyle = white(al); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.fillStyle = white(al); ctx.fillRect(x1 - 1, y1 - 1, 2, 2);
      }
      var pulse = 1 + 0.06 * Math.sin(t * 3);
      ctx.strokeStyle = white(0.85); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(cx, cy, r0 * pulse, r0 * pulse * 0.82, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = white(0.25); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(cx, cy, r0 * 1.5, r0 * 1.5 * 0.82, 0, 0, TAU); ctx.stroke();
    };
  };

  /* 5. Streams: particles split across routes and rejoin (send) */
  ANIMS.streams = function (w, h) {
    var R = rng(9), K = 6, i, routes = [], ps = [];
    var S = { x: w * 0.08, y: h * 0.5 }, E = { x: w * 0.92, y: h * 0.5 };
    for (i = 0; i < K; i++) routes.push({ m: { x: w * 0.5, y: h * (0.18 + 0.64 * i / (K - 1)) } });
    function q(p0, c, p1, u) {
      var a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c2 = u * u;
      return { x: a * p0.x + b * c.x + c2 * p1.x, y: a * p0.y + b * c.y + c2 * p1.y };
    }
    function at(k, u) {
      var r = routes[k];
      if (u < 1) return q(S, { x: w * 0.3, y: S.y }, r.m, u);
      return q(r.m, { x: w * 0.7, y: E.y }, E, u - 1);
    }
    for (i = 0; i < 90; i++) ps.push({ k: (R() * K) | 0, u: R() * 2, v: 0.14 + R() * 0.2 });
    var last = 0;
    return function (ctx, t) {
      var dt = Math.min(0.05, t - last); last = t; if (dt < 0) dt = 0;
      var k, s, p;
      ctx.lineWidth = 1;
      for (k = 0; k < K; k++) {
        ctx.strokeStyle = white(0.1); ctx.beginPath();
        for (s = 0; s <= 40; s++) { p = at(k, s / 20 * 0.9999); if (s === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
        ctx.stroke();
        ctx.strokeStyle = white(0.7); ctx.strokeRect(routes[k].m.x - 4, routes[k].m.y - 4, 8, 8);
      }
      for (k = 0; k < ps.length; k++) {
        var pp = ps[k];
        pp.u += pp.v * dt;
        if (pp.u >= 2) { pp.u = 0; pp.k = (Math.random() * K) | 0; }
        var a = at(pp.k, pp.u), b = at(pp.k, Math.max(0, pp.u - 0.05));
        var f = Math.sin(pp.u / 2 * Math.PI);
        ctx.strokeStyle = white(0.6 * f); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(a.x, a.y); ctx.stroke();
        ctx.fillStyle = white(0.4 + 0.6 * f); ctx.beginPath(); ctx.arc(a.x, a.y, 2, 0, TAU); ctx.fill();
      }
      [S, E].forEach(function (pt, idx) {
        var pr = 1 + 0.15 * Math.sin(t * 2 + idx);
        ctx.fillStyle = white(0.95); ctx.beginPath(); ctx.arc(pt.x, pt.y, 5, 0, TAU); ctx.fill();
        ctx.strokeStyle = white(0.5); ctx.beginPath(); ctx.arc(pt.x, pt.y, 14 * pr, 0, TAU); ctx.stroke();
      });
    };
  };

  /* 6. Binary: two point-spheres orbit and trade particles (swap) */
  ANIMS.binary = function (w, h) {
    var R = rng(21), n = 70, i, j;
    function build(seed) {
      var Rr = rng(seed), pts = [], edges = [];
      for (i = 0; i < n; i++) { var u = Rr() * 2 - 1, a = Rr() * TAU, s = Math.sqrt(1 - u * u); pts.push({ x: s * Math.cos(a), y: u, z: s * Math.sin(a) }); }
      for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
        var d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y, pts[i].z - pts[j].z);
        if (d < 0.5) edges.push([i, j]);
      }
      return { pts: pts, edges: edges };
    }
    var A = build(31), B = build(32), base = Math.min(w, h);
    var xs = [], ps = [];
    for (i = 0; i < 18; i++) ps.push({ u: R(), v: 0.18 + R() * 0.22, dir: i % 2 ? 1 : -1, off: (R() - 0.5) * 0.5 });
    function drawS(ctx, S, cx, cy, rad, rot, hollow) {
      var k, pr = [], c = Math.cos(rot), s = Math.sin(rot);
      for (k = 0; k < S.pts.length; k++) {
        var p = S.pts[k], x1 = p.x * c + p.z * s, z1 = -p.x * s + p.z * c;
        pr.push([cx + x1 * rad, cy + p.y * rad, z1]);
      }
      ctx.lineWidth = 0.7;
      for (k = 0; k < S.edges.length; k++) {
        var e = S.edges[k], a = pr[e[0]], b = pr[e[1]];
        ctx.strokeStyle = white(0.1 + 0.3 * ((a[2] + b[2]) / 2 + 1) / 2);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      for (k = 0; k < pr.length; k++) {
        var d = (pr[k][2] + 1) / 2;
        if (hollow) { ctx.strokeStyle = white(0.4 + 0.5 * d); ctx.beginPath(); ctx.arc(pr[k][0], pr[k][1], 2.2, 0, TAU); ctx.stroke(); }
        else { ctx.fillStyle = white(0.35 + 0.65 * d); ctx.beginPath(); ctx.arc(pr[k][0], pr[k][1], 1.9, 0, TAU); ctx.fill(); }
      }
    }
    return function (ctx, t) {
      var cx = w * 0.5, cy = h * 0.5, D = Math.min(w * 0.3, base * 0.3), th = t * 0.5;
      var ax = cx + D * Math.cos(th), ay = cy + D * 0.3 * Math.sin(th);
      var bx = cx - D * Math.cos(th), by = cy - D * 0.3 * Math.sin(th);
      var sA = 1 + 0.25 * Math.sin(th), sB = 1 - 0.25 * Math.sin(th), rad = base * 0.13;
      if (sA < sB) { drawS(ctx, A, ax, ay, rad * sA, t * 0.4, false); drawS(ctx, B, bx, by, rad * sB, -t * 0.4, true); }
      else { drawS(ctx, B, bx, by, rad * sB, -t * 0.4, true); drawS(ctx, A, ax, ay, rad * sA, t * 0.4, false); }
      var last = ps.length, k;
      for (k = 0; k < last; k++) {
        var p = ps[k];
        p.u = (p.u + p.v / 60) % 1;
        var from = p.dir > 0 ? { x: ax, y: ay } : { x: bx, y: by };
        var to = p.dir > 0 ? { x: bx, y: by } : { x: ax, y: ay };
        var arc = Math.sin(p.u * Math.PI) * base * 0.14 * p.dir;
        var px = from.x + (to.x - from.x) * p.u, py = from.y + (to.y - from.y) * p.u - arc + p.off * 20 * Math.sin(p.u * Math.PI);
        ctx.fillStyle = white(0.9 * Math.sin(p.u * Math.PI)); ctx.beginPath(); ctx.arc(px, py, 2.2, 0, TAU); ctx.fill();
      }
    };
  };

  /* 7. Radar: rotating sweep with blips (vault) */
  ANIMS.radar = function (w, h) {
    var R = rng(17), blips = [], i;
    for (i = 0; i < 22; i++) blips.push({ a: R() * TAU, r: 0.15 + R() * 0.8 });
    return function (ctx, t) {
      var cx = w * 0.5, cy = h * 0.5, rad = Math.min(w, h) * 0.46, k;
      ctx.lineWidth = 1;
      for (k = 1; k <= 4; k++) { ctx.strokeStyle = white(0.12 + (k === 4 ? 0.2 : 0)); ctx.beginPath(); ctx.arc(cx, cy, rad * k / 4, 0, TAU); ctx.stroke(); }
      ctx.setLineDash([2, 9]); ctx.lineDashOffset = -t * 10; ctx.strokeStyle = white(0.4);
      ctx.beginPath(); ctx.arc(cx, cy, rad * 1.07, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      for (k = 0; k < 72; k++) {
        var a = k / 72 * TAU, l = k % 6 === 0 ? 12 : 5;
        ctx.strokeStyle = white(k % 6 === 0 ? 0.5 : 0.2);
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); ctx.lineTo(cx + Math.cos(a) * (rad - l), cy + Math.sin(a) * (rad - l)); ctx.stroke();
      }
      ctx.strokeStyle = white(0.1);
      ctx.beginPath(); ctx.moveTo(cx - rad, cy); ctx.lineTo(cx + rad, cy); ctx.moveTo(cx, cy - rad); ctx.lineTo(cx, cy + rad); ctx.stroke();
      var sw = (t * 0.9) % TAU;
      for (k = 0; k < 46; k++) {
        var aa = sw - k * 0.014;
        ctx.strokeStyle = white(0.5 * (1 - k / 46)); ctx.lineWidth = k === 0 ? 1.6 : 1;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(aa) * rad, cy + Math.sin(aa) * rad); ctx.stroke();
      }
      for (k = 0; k < blips.length; k++) {
        var b = blips[k], diff = ((sw - b.a) % TAU + TAU) % TAU, br = Math.max(0, 1 - diff / (TAU * 0.7));
        var bx = cx + Math.cos(b.a) * rad * b.r, by = cy + Math.sin(b.a) * rad * b.r;
        ctx.fillStyle = white(0.08 + 0.9 * br * br); ctx.beginPath(); ctx.arc(bx, by, 2.4, 0, TAU); ctx.fill();
        if (br > 0.8) { ctx.strokeStyle = white((br - 0.8) * 3); ctx.beginPath(); ctx.arc(bx, by, 8, 0, TAU); ctx.stroke(); }
      }
    };
  };

  /* 8. Wave: dot matrix ripple (features) */
  ANIMS.wave = function (w, h, m) {
    var sp = 26, cols = Math.ceil(w / sp) + 1, rows = Math.ceil(h / sp) + 1, base = Math.min(w, h);
    return function (ctx, t) {
      var cx = w * 0.5 + Math.cos(t * 0.3) * w * 0.22 + ((m ? m.x : 0.5) - 0.5) * w * 0.3;
      var cy = h * 0.5 + Math.sin(t * 0.4) * h * 0.16 + ((m ? m.y : 0.5) - 0.5) * h * 0.3;
      var i, j;
      for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
        var x = i * sp, y = j * sp, d = Math.hypot(x - cx, y - cy);
        var k = (Math.sin(d / 36 - t * 2.4) + 1) / 2, f = 1 / (1 + d / (base * 0.8));
        var s = 1 + k * 4.2 * (0.35 + f);
        ctx.fillStyle = white(0.08 + 0.7 * k * (0.3 + f));
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
    };
  };

  /* 9. Scanner: hex lattice with a scan line and lock-on brackets (security) */
  ANIMS.scanner = function (w, h) {
    var s = 24, hx = [], c, r, rows, cols, rh = Math.sqrt(3) * s;
    cols = Math.ceil(w / (1.5 * s)) + 2; rows = Math.ceil(h / rh) + 2;
    for (c = 0; c < cols; c++) for (r = 0; r < rows; r++) hx.push({ x: c * 1.5 * s, y: r * rh + (c % 2 ? rh / 2 : 0) });
    function hexPath(ctx, x, y, rr) {
      for (var k = 0; k < 6; k++) { var a = k / 6 * TAU; if (k === 0) ctx.moveTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); else ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); }
      ctx.closePath();
    }
    return function (ctx, t) {
      var k, p, band = 90, scanY = ((t * 110) % (h + band * 2)) - band;
      ctx.lineWidth = 1; ctx.strokeStyle = white(0.1); ctx.beginPath();
      for (k = 0; k < hx.length; k++) hexPath(ctx, hx[k].x, hx[k].y, s * 0.92);
      ctx.stroke();
      for (k = 0; k < hx.length; k++) {
        p = hx[k]; var d = Math.abs(p.y - scanY);
        if (d < band) {
          var f = 1 - d / band;
          ctx.fillStyle = white(0.22 * f * f); ctx.strokeStyle = white(0.6 * f);
          ctx.beginPath(); hexPath(ctx, p.x, p.y, s * 0.92); ctx.fill(); ctx.stroke();
        }
      }
      var g = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 4);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.28)');
      ctx.fillStyle = g; ctx.fillRect(0, scanY - 40, w, 44);
      ctx.strokeStyle = white(0.9); ctx.beginPath(); ctx.moveTo(0, scanY); ctx.lineTo(w, scanY); ctx.stroke();
      var slot = Math.floor(t / 2.4), hsh = (Math.imul(slot + 7, 2654435761) >>> 0) % hx.length, tg = hx[hsh];
      var life = (t / 2.4) % 1, sz = s * (1.9 - 0.5 * Math.min(1, life * 3)), al = Math.sin(life * Math.PI);
      ctx.strokeStyle = white(al); ctx.lineWidth = 1.6; var L = 9;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (q) {
        var bx = tg.x + q[0] * sz, by = tg.y + q[1] * sz;
        ctx.beginPath(); ctx.moveTo(bx, by - q[1] * L); ctx.lineTo(bx, by); ctx.lineTo(bx - q[0] * L, by); ctx.stroke();
      });
    };
  };

  /* 10. Rain: falling monochrome glyphs (docs) */
  ANIMS.rain = function (w, h) {
    var colw = 20, cols = Math.ceil(w / colw), R = rng(41), cs = [], i;
    var set = '01NEXORA<>/{}[]=+*#';
    for (i = 0; i < cols; i++) cs.push({ sp: 36 + R() * 90, off: R() * 2000, len: 8 + ((R() * 12) | 0) });
    return function (ctx, t) {
      ctx.font = '14px "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';
      ctx.textBaseline = 'top';
      var i2, k;
      for (i2 = 0; i2 < cols; i2++) {
        var c = cs[i2], span = h + c.len * 18, head = (t * c.sp + c.off) % span;
        for (k = 0; k < c.len; k++) {
          var y = head - k * 18;
          if (y < -18 || y > h) continue;
          var seed = (i2 * 131 + ((y / 18) | 0) * 17 + Math.floor(t * (k === 0 ? 10 : 2.5))) | 0;
          var ch = set.charAt(Math.abs(Math.imul(seed, 2654435761) >>> 0) % set.length);
          ctx.fillStyle = k === 0 ? white(1) : white(0.65 * (1 - k / c.len));
          ctx.fillText(ch, i2 * colw, y);
        }
      }
    };
  };

  /* 11. Sonar: expanding rings that light up hidden points (help) */
  ANIMS.sonar = function (w, h) {
    var R = rng(51), pts = [], i;
    for (i = 0; i < 26; i++) pts.push({ a: R() * TAU, r: 0.12 + R() * 0.85 });
    return function (ctx, t) {
      var cx = w * 0.5, cy = h * 0.5, maxR = Math.min(w, h) * 0.5, k, rings = [];
      for (k = 0; k < 5; k++) {
        var u = (t / 1.8 + k / 5) % 1;
        rings.push([u * maxR, 1 - u]);
        ctx.strokeStyle = white(0.55 * (1 - u)); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(cx, cy, u * maxR, 0, TAU); ctx.stroke();
      }
      ctx.setLineDash([3, 8]); ctx.lineDashOffset = t * 6; ctx.strokeStyle = white(0.25);
      ctx.beginPath(); ctx.arc(cx, cy, maxR, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = white(0.12); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - maxR, cy); ctx.lineTo(cx + maxR, cy); ctx.moveTo(cx, cy - maxR); ctx.lineTo(cx, cy + maxR); ctx.stroke();
      for (k = 0; k < pts.length; k++) {
        var p = pts[k], pr = p.r * maxR, b = 0, j;
        for (j = 0; j < rings.length; j++) b = Math.max(b, Math.max(0, 1 - Math.abs(rings[j][0] - pr) / 18) * rings[j][1]);
        var x = cx + Math.cos(p.a) * pr, y = cy + Math.sin(p.a) * pr;
        ctx.fillStyle = white(0.1 + 0.9 * b); ctx.beginPath(); ctx.arc(x, y, 2 + b * 2.5, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = white(0.95); ctx.beginPath(); ctx.arc(cx, cy, 4, 0, TAU); ctx.fill();
    };
  };

  /* 12. HUD sphere: engineered node mesh with blueprint annotations (home hero) */
  ANIMS.hud = function (w, h, m) {
    var S = Math.min(w, h), cx = w / 2, cy = h / 2, rad = S * 0.25, N = 520, i, j, R = rng(13);
    var fs = Math.max(8.5, S / 42), pad = Math.max(10, S * 0.03) + 4;
    var font = fs + 'px "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';
    var pts = [], adj = [], edges = [], GA = Math.PI * (3 - Math.sqrt(5));
    for (i = 0; i < N; i++) {
      var yy = 1 - (i + 0.5) / N * 2, rr = Math.sqrt(1 - yy * yy), th = i * GA;
      var jx = Math.cos(th) * rr + (R() - 0.5) * 0.02, jy = yy + (R() - 0.5) * 0.02, jz = Math.sin(th) * rr + (R() - 0.5) * 0.02;
      var jl = Math.sqrt(jx * jx + jy * jy + jz * jz);
      pts.push({ x: jx / jl, y: jy / jl, z: jz / jl, sx: 0, sy: 0, sz: 0 });
      adj.push([]);
    }
    for (i = 0; i < N; i++) for (j = i + 1; j < N; j++) {
      var dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, dz = pts[i].z - pts[j].z;
      if (dx * dx + dy * dy + dz * dz < 0.04) { edges.push([pts[i], pts[j]]); adj[i].push(j); adj[j].push(i); }
    }
    var ez = new Float32Array(edges.length), degree = 2 * edges.length / N;
    var lit = [], used = {};
    while (lit.length < 16) { var ix = (R() * N) | 0; if (!used[ix]) { used[ix] = 1; lit.push({ i: ix, ph: R() }); } }
    var tx = 0.5, ty = 0.5, SEG = 72;

    function hexPath(ctx, r) {
      ctx.beginPath();
      for (var q = 0; q < 6; q++) { var a = q / 6 * TAU + Math.PI / 6; if (q === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath();
    }
    function pad2(n, len, dec) { var v = n.toFixed(dec); while (v.length < len) v = '0' + v; return v; }

    return function (ctx, t) {
      tx += ((m ? m.x : 0.5) - tx) * 0.04; ty += ((m ? m.y : 0.5) - ty) * 0.04;
      var ay = t * 0.18 + (tx - 0.5) * 0.5, ax = -0.32 + (ty - 0.5) * 0.3;
      var ca = Math.cos(ay), sa = Math.sin(ay), cb = Math.cos(ax), sb = Math.sin(ax);
      var k, p, e, a, b, x, y, pass, al;

      /* blueprint grid crosses */
      ctx.strokeStyle = white(0.1); ctx.lineWidth = 1; ctx.beginPath();
      for (x = 18; x < w; x += 36) for (y = 18; y < h; y += 36) { ctx.moveTo(x - 2, y); ctx.lineTo(x + 2, y); ctx.moveTo(x, y - 2); ctx.lineTo(x, y + 2); }
      ctx.stroke();

      /* corner brackets */
      var L = Math.max(14, S * 0.06), c0 = 2;
      ctx.strokeStyle = white(0.7); ctx.lineWidth = 1.2; ctx.beginPath();
      ctx.moveTo(c0, c0 + L); ctx.lineTo(c0, c0); ctx.lineTo(c0 + L, c0);
      ctx.moveTo(w - c0 - L, c0); ctx.lineTo(w - c0, c0); ctx.lineTo(w - c0, c0 + L);
      ctx.moveTo(c0, h - c0 - L); ctx.lineTo(c0, h - c0); ctx.lineTo(c0 + L, h - c0);
      ctx.moveTo(w - c0 - L, h - c0); ctx.lineTo(w - c0, h - c0); ctx.lineTo(w - c0, h - c0 - L);
      ctx.stroke();

      /* orbit rings: dashed ring, tick ring, degree readouts, orbiting marker */
      var r1 = rad * 1.32, r2 = rad * 1.5;
      ctx.lineWidth = 1; ctx.setLineDash([5, 6]); ctx.lineDashOffset = -t * 6; ctx.strokeStyle = white(0.4);
      ctx.beginPath(); ctx.arc(cx, cy, r1, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = white(0.2); ctx.beginPath(); ctx.arc(cx, cy, r2, 0, TAU); ctx.stroke();
      ctx.beginPath();
      for (k = 0; k < 72; k++) {
        var ta = k / 72 * TAU - Math.PI / 2, tl = k % 6 === 0 ? 8 : 3.5;
        ctx.moveTo(cx + Math.cos(ta) * r2, cy + Math.sin(ta) * r2); ctx.lineTo(cx + Math.cos(ta) * (r2 - tl), cy + Math.sin(ta) * (r2 - tl));
      }
      ctx.strokeStyle = white(0.45); ctx.stroke();
      ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = white(0.4);
      [['000', 0], ['090', 90], ['180', 180], ['270', 270]].forEach(function (d) {
        var da = d[1] * Math.PI / 180 - Math.PI / 2;
        ctx.fillText(d[0], cx + Math.cos(da) * (r2 + 17), cy + Math.sin(da) * (r2 + 17));
      });
      ctx.fillStyle = white(0.8);
      ctx.beginPath(); ctx.moveTo(cx - 4, cy - r2 - 9); ctx.lineTo(cx + 4, cy - r2 - 9); ctx.lineTo(cx, cy - r2 - 3); ctx.closePath(); ctx.fill();
      var am = t * 0.35;
      ctx.save(); ctx.translate(cx + Math.cos(am) * r1, cy + Math.sin(am) * r1); ctx.rotate(am + Math.PI);
      ctx.fillStyle = white(0.95); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-7, -4); ctx.lineTo(-7, 4); ctx.closePath(); ctx.fill(); ctx.restore();

      /* project nodes */
      for (k = 0; k < N; k++) {
        p = pts[k];
        var x1 = p.x * ca + p.z * sa, z1 = -p.x * sa + p.z * ca;
        p.sx = cx + x1 * rad; p.sy = cy + (p.y * cb - z1 * sb) * rad; p.sz = p.y * sb + z1 * cb;
      }

      /* equator ring, back half (behind the mesh) */
      var er = rad * 1.07, yo = rad * 0.045, ph0 = t * 0.04, ring = [];
      for (k = 0; k <= SEG; k++) {
        var f = k / SEG * TAU + ph0, rx = Math.cos(f) * er, rz = Math.sin(f) * er;
        ring.push({ x: cx + rx, y1: cy + (-yo * cb) - rz * sb, y2: cy + (yo * cb) - rz * sb, z: rz });
      }
      ctx.lineWidth = 1; ctx.strokeStyle = white(0.16);
      [1, 2].forEach(function (lane) {
        ctx.beginPath();
        for (k = 0; k <= SEG; k++) {
          var q = ring[k], qy = lane === 1 ? q.y1 : q.y2;
          if (q.z <= 0) { if (k > 0 && ring[k - 1].z <= 0) ctx.lineTo(q.x, qy); else ctx.moveTo(q.x, qy); }
        }
        ctx.stroke();
      });

      /* mesh edges in three depth buckets */
      for (k = 0; k < edges.length; k++) ez[k] = (edges[k][0].sz + edges[k][1].sz) / 2;
      [[-2, -0.1, 0.08], [-0.1, 0.35, 0.2], [0.35, 2, 0.42]].forEach(function (bk) {
        ctx.strokeStyle = white(bk[2]); ctx.lineWidth = 0.8; ctx.beginPath();
        for (k = 0; k < edges.length; k++) {
          if (ez[k] >= bk[0] && ez[k] < bk[1]) { ctx.moveTo(edges[k][0].sx, edges[k][0].sy); ctx.lineTo(edges[k][1].sx, edges[k][1].sy); }
        }
        ctx.stroke();
      });

      /* lit cells: brightness, links to neighbours */
      var litNow = 0;
      lit.forEach(function (c) {
        var v = Math.sin(t * 0.7 + c.ph * TAU); c.b = v > 0 ? v * v * v : 0;
        if (c.b > 0.5) litNow++;
        p = pts[c.i];
        if (c.b > 0.05 && p.sz > 0.2) {
          ctx.strokeStyle = white(0.9 * c.b); ctx.lineWidth = 1.2; ctx.beginPath();
          adj[c.i].forEach(function (n) { ctx.moveTo(p.sx, p.sy); ctx.lineTo(pts[n].sx, pts[n].sy); });
          ctx.stroke();
        }
      });

      /* node dots, square pixels, three depth buckets */
      [[-2, -0.1, 0.25, 1.2], [-0.1, 0.35, 0.55, 1.5], [0.35, 2, 0.95, 1.9]].forEach(function (bk) {
        ctx.fillStyle = white(bk[2]);
        for (k = 0; k < N; k++) {
          p = pts[k];
          if (p.sz >= bk[0] && p.sz < bk[1]) ctx.fillRect(p.sx - bk[3] / 2, p.sy - bk[3] / 2, bk[3], bk[3]);
        }
      });

      /* lit hex cells, flattened toward the limb */
      lit.forEach(function (c) {
        p = pts[c.i];
        if (p.sz <= 0.2) return;
        var th2 = Math.atan2(p.sy - cy, p.sx - cx), size = (3.6 + 2.4 * c.b) * (rad / 90 > 1.6 ? 1.6 : Math.max(0.8, rad / 90));
        ctx.save(); ctx.translate(p.sx, p.sy); ctx.rotate(th2); ctx.scale(Math.max(0.55, p.sz), 1);
        ctx.fillStyle = white(0.1 + 0.18 * c.b); hexPath(ctx, size * 2.4); ctx.fill();
        ctx.strokeStyle = white(0.35 + 0.5 * c.b); ctx.lineWidth = 1; hexPath(ctx, size * 1.7); ctx.stroke();
        ctx.fillStyle = white(0.25 + 0.75 * c.b); hexPath(ctx, size); ctx.fill();
        ctx.restore();
      });

      /* equator ring, front half, with struts and trusses */
      ctx.strokeStyle = white(0.8); ctx.lineWidth = 1.2;
      [1, 2].forEach(function (lane) {
        ctx.beginPath();
        for (k = 0; k <= SEG; k++) {
          var q = ring[k], qy = lane === 1 ? q.y1 : q.y2;
          if (q.z > 0) { if (k > 0 && ring[k - 1].z > 0) ctx.lineTo(q.x, qy); else ctx.moveTo(q.x, qy); }
        }
        ctx.stroke();
      });
      ctx.strokeStyle = white(0.55); ctx.lineWidth = 1; ctx.beginPath();
      for (k = 0; k < SEG; k += 3) { if (ring[k].z > 0) { ctx.moveTo(ring[k].x, ring[k].y1); ctx.lineTo(ring[k].x, ring[k].y2); } }
      ctx.stroke();
      ctx.fillStyle = white(0.75);
      for (k = 0; k < SEG; k += 12) { if (ring[k].z > 0) ctx.fillRect(ring[k].x - 1.5, ring[k].y1 - 3, 3, ring[k].y2 - ring[k].y1 + 6); }

      /* callouts with live readouts */
      ctx.font = font; ctx.textBaseline = 'alphabetic';
      function tag(px, py, title, sub, right, tgx, tgy, up) {
        ctx.textAlign = right ? 'right' : 'left';
        var wd = Math.max(ctx.measureText(title).width, ctx.measureText(sub).width);
        ctx.fillStyle = white(0.9); ctx.fillText(title, px, py);
        ctx.fillStyle = white(0.5); ctx.fillText(sub, px, py + fs * 1.35);
        var uy = up ? py - fs * 1.2 : py + fs * 2.1, x0 = right ? px - wd : px, x1 = right ? px : px + wd, ex = right ? x0 : x1;
        ctx.strokeStyle = white(0.4); ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(x0, uy); ctx.lineTo(x1, uy); ctx.moveTo(ex, uy); ctx.lineTo(tgx, tgy); ctx.stroke();
        ctx.fillStyle = white(0.95); ctx.fillRect(tgx - 1.5, tgy - 1.5, 3, 3);
        ctx.strokeStyle = white(0.5); ctx.strokeRect(tgx - 4.5, tgy - 4.5, 9, 9);
      }
      var rotY = ((ay * 180 / Math.PI) % 360 + 360) % 360;
      var clock = 't+' + pad2(Math.floor(t / 60), 2, 0) + ':' + pad2(t % 60, 4, 1);
      tag(pad, pad + fs + 12, 'mesh', 'n=' + N + ' \u00B7 k=' + degree.toFixed(1), false, cx - rad * 0.72, cy - rad * 0.6, false);
      tag(w - pad, pad + fs + 12, 'rot.y', pad2(rotY, 5, 1) + '\u00B0', true, cx + rad * 0.62, cy - rad * 0.62, false);
      tag(pad, h - pad - fs * 1.4 - 2, 'lit nodes', pad2(litNow, 2, 0) + ' / ' + lit.length, false, cx - rad * 0.7, cy + rad * 0.62, true);
      tag(w - pad, h - pad - fs * 1.4 - 2, 'clock', clock, true, cx + rad * 0.66, cy + rad * 0.58, true);
    };
  };

  /* canvas runner */
  var mouse = { x: 0.5, y: 0.5 };
  window.addEventListener('pointermove', function (e) {
    mouse.x = e.clientX / Math.max(1, window.innerWidth);
    mouse.y = e.clientY / Math.max(1, window.innerHeight);
  }, { passive: true });

  function run(canvas, name) {
    if (!canvas || !ANIMS[name]) return;
    var ctx = canvas.getContext('2d'), w = 0, h = 0, draw = null, raf = 0, start = performance.now();
    function size() {
      var r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw = ANIMS[name](w, h, mouse);
      if (reduce) frame(start + 4000);
    }
    function frame(now) {
      var t = (now - start) / 1000;
      ctx.clearRect(0, 0, w, h);
      try { draw(ctx, t); } catch (e) {}
      if (!reduce) raf = requestAnimationFrame(frame);
    }
    var tmr = 0;
    window.addEventListener('resize', function () { clearTimeout(tmr); tmr = setTimeout(function () { cancelAnimationFrame(raf); size(); if (!reduce) raf = requestAnimationFrame(frame); }, 120); });
    document.addEventListener('visibilitychange', function () {
      if (reduce) return;
      if (document.hidden) cancelAnimationFrame(raf); else raf = requestAnimationFrame(frame);
    });
    size();
    if (!reduce) raf = requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------ */
  /* Session and wallets                                                  */
  /* ------------------------------------------------------------------ */
  var KEY = 'nexora.session', mem = null, listeners = [];
  function session() {
    try { var s = sessionStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) {}
    return mem;
  }
  function setSession(s) {
    mem = s;
    if (!s || s.mode !== 'wallet') live = null;
    try { if (s) sessionStorage.setItem(KEY, JSON.stringify(s)); else sessionStorage.removeItem(KEY); } catch (e) {}
    listeners.forEach(function (f) { try { f(s); } catch (e) {} });
  }
  function onSession(f) { listeners.push(f); f(session()); }
  function short(a) { return a ? a.slice(0, 4) + '\u2026' + a.slice(-4) : ''; }
  var B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

  /* Wallet Standard registry: lets MetaMask and any other compliant wallet appear without custom code */
  var stdWallets = [], regListeners = [];
  var stdApi = {
    register: function () {
      var list = Array.prototype.slice.call(arguments);
      list.forEach(function (x) { if (stdWallets.indexOf(x) < 0) stdWallets.push(x); });
      regListeners.forEach(function (f) { try { f(); } catch (e) {} });
      return function () {};
    }
  };
  try {
    window.addEventListener('wallet-standard:register-wallet', function (e) { try { e.detail(stdApi); } catch (x) {} });
    window.dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: stdApi }));
  } catch (e) {}

  function isSolStd(x) {
    try {
      return x && x.features && x.features['standard:connect'] &&
        (x.chains || []).some(function (c) { return String(c).indexOf('solana:') === 0; });
    } catch (e) { return false; }
  }
  function findStd(re) {
    for (var i = 0; i < stdWallets.length; i++) if (re.test(stdWallets[i].name || '') && isSolStd(stdWallets[i])) return stdWallets[i];
    return null;
  }

  var KNOWN = [
    { id: 'phantom', name: 'Phantom', re: /phantom/i, url: 'https://phantom.com/download', how: 'Browser extension and mobile app',
      legacy: function () { var p = window.phantom && window.phantom.solana; if (p && p.isPhantom) return p; if (window.solana && window.solana.isPhantom) return window.solana; return null; } },
    { id: 'metamask', name: 'MetaMask', re: /metamask/i, url: 'https://metamask.io/download', how: 'Browser extension, connects through Wallet Standard',
      legacy: function () { return null; },
      evm: function () { return !!(window.ethereum && window.ethereum.isMetaMask); } },
    { id: 'solflare', name: 'Solflare', re: /solflare/i, url: 'https://solflare.com/download', how: 'Browser extension and mobile app',
      legacy: function () { var p = window.solflare; return p && p.isSolflare ? p : null; } },
    { id: 'backpack', name: 'Backpack', re: /backpack/i, url: 'https://backpack.app/downloads', how: 'Browser extension and mobile app',
      legacy: function () { var p = window.backpack; return p && p.isBackpack ? p : null; } },
    { id: 'coinbase', name: 'Coinbase Wallet', re: /coinbase/i, url: 'https://www.coinbase.com/wallet/downloads', how: 'Browser extension and mobile app',
      legacy: function () { return window.coinbaseSolana || null; } },
    { id: 'trust', name: 'Trust Wallet', re: /trust/i, url: 'https://trustwallet.com/download', how: 'Browser extension and mobile app',
      legacy: function () { return (window.trustwallet && window.trustwallet.solana) || null; } },
    { id: 'exodus', name: 'Exodus', re: /exodus/i, url: 'https://www.exodus.com/download/', how: 'Desktop, mobile and extension',
      legacy: function () { return (window.exodus && window.exodus.solana) || null; } }
  ];

  function entries() {
    var out = [], used = [];
    KNOWN.forEach(function (k) {
      var lg = k.legacy(), sd = findStd(k.re);
      if (sd) used.push(sd);
      out.push({ id: k.id, name: k.name, url: k.url, how: k.how, legacy: lg, std: sd, detected: !!(lg || sd), evmOnly: !!(k.evm && k.evm() && !(lg || sd)) });
    });
    stdWallets.forEach(function (sd) {
      if (used.indexOf(sd) >= 0 || !isSolStd(sd)) return;
      out.push({ id: 'std-' + sd.name, name: sd.name, url: null, how: 'Detected through Wallet Standard', legacy: null, std: sd, detected: true });
    });
    return out;
  }

  var live = null;
  function connectEntry(e) {
    if (e.legacy) {
      return Promise.resolve(e.legacy.connect()).then(function (res) {
        var pk = (res && res.publicKey) || e.legacy.publicKey;
        if (!pk) throw new Error('The wallet did not return an account.');
        live = { entry: e, provider: e.legacy, address: pk.toString() };
        return pk.toString();
      });
    }
    if (e.std) {
      return Promise.resolve(e.std['features']['standard:connect'].connect()).then(function (res) {
        var acc = (res && res.accounts && res.accounts[0]) || (e.std.accounts && e.std.accounts[0]);
        if (!acc) throw new Error('The wallet did not return an account.');
        live = { entry: e, wallet: e.std, account: acc, address: acc.address };
        return acc.address;
      });
    }
    return Promise.reject(new Error('This MetaMask did not expose a Solana account. Update MetaMask and enable Solana in its settings.'));
  }

  function renderWallets(box, statusEl) {
    function say(t) { if (statusEl) statusEl.textContent = t || ''; }
    function draw() {
      var cur = session(), list = entries();
      box.innerHTML = '';
      list.forEach(function (e) {
        var row = document.createElement('div'); row.className = 'wallet';
        var connected = cur && cur.mode === 'wallet' && cur.wallet === e.name;
        row.innerHTML = '<div class="mono-box" aria-hidden="true"></div><div class="meta"><strong></strong><span></span><a class="wlink" target="_blank" rel="noopener"></a></div><span class="chip"></span>';
        row.querySelector('.mono-box').textContent = e.name.charAt(0);
        row.querySelector('strong').textContent = e.name;
        row.querySelector('.meta span').textContent = e.evmOnly ? 'MetaMask found, but no Solana account is exposed' : e.how;
        var wl = row.querySelector('.wlink');
        if (e.url) { wl.href = e.url; wl.textContent = e.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') + ' \u2197'; } else { wl.remove(); }
        var chip = row.querySelector('.chip');
        chip.textContent = connected ? 'Connected' : (e.detected ? 'Detected' : 'Not found');
        if (connected || e.detected) chip.className = 'chip on';
        var act;
        if (e.detected || e.evmOnly) {
          act = document.createElement('button'); act.type = 'button'; act.className = 'btn sm solid'; act.textContent = connected ? 'Reconnect' : 'Connect';
          act.addEventListener('click', function () {
            act.disabled = true; say('Waiting for ' + e.name + '. Approve the request in the wallet window.');
            connectEntry(e).then(function (addr) {
              setSession({ mode: 'wallet', wallet: e.name, address: addr });
              say(e.name + ' connected.');
            }).catch(function (err) {
              say((err && err.message) ? err.message : 'Connection was cancelled.');
            }).then(function () { act.disabled = false; draw(); });
          });
        }
        if (act) row.appendChild(act);
        box.appendChild(row);
      });
    }
    regListeners.push(draw);
    onSession(function () { draw(); });
    setTimeout(draw, 400); setTimeout(draw, 1400);
  }

  function watchOnly(input, statusEl, btn) {
    btn.addEventListener('click', function () {
      var v = (input.value || '').trim();
      if (!B58.test(v)) { statusEl.textContent = 'That is not a valid Solana address. It should be 32 to 44 letters and numbers.'; return; }
      setSession({ mode: 'watch', wallet: 'Watch only', address: v });
      statusEl.textContent = 'Watch-only address saved for this tab.';
    });
  }


  /* ------------------------------------------------------------------ */
  /* Real transfers (Solana mainnet or devnet, user selectable). Needs @solana/web3.js (global solanaWeb3) */
  /* ------------------------------------------------------------------ */
  var NETS = {
    mainnet: { label: 'Mainnet', chain: 'solana:mainnet', rpc: 'https://api.mainnet-beta.solana.com', cluster: '',
      tokens: { USDC: { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', dec: 6 }, USDT: { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNyUiXfXjKi4ygzzJT', dec: 6 } } },
    devnet: { label: 'Devnet', chain: 'solana:devnet', rpc: 'https://api.devnet.solana.com', cluster: '?cluster=devnet',
      tokens: { USDC: { mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', dec: 6 } } }
  };
  var TOKEN_PROG = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  var ATA_PROG = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
  var NET_KEY = 'nexora.net', RPC_KEY = 'nexora.rpc';
  function getNet() { try { var n = localStorage.getItem(NET_KEY); if (NETS[n]) return n; } catch (e) {} return (window.NX_DEFAULT_NET && NETS[window.NX_DEFAULT_NET]) ? window.NX_DEFAULT_NET : 'mainnet'; }
  function setNet(n) { if (!NETS[n]) return; try { localStorage.setItem(NET_KEY, n); localStorage.removeItem(RPC_KEY + '.' + n); } catch (e) {} }
  function netInfo() { return NETS[getNet()]; }
  function defaultRpc() { return netInfo().rpc; }
  function getRpc() { try { return localStorage.getItem(RPC_KEY + '.' + getNet()) || defaultRpc(); } catch (e) { return defaultRpc(); } }
  function setRpc(u) { try { if (u) localStorage.setItem(RPC_KEY + '.' + getNet(), u); else localStorage.removeItem(RPC_KEY + '.' + getNet()); } catch (e) {} }
  function explorerTx(sig) { return 'https://solscan.io/tx/' + sig + netInfo().cluster; }

  /* decimal string -> BigInt base units, no float rounding */
  function toUnits(str, dec) {
    var m = /^(\d+)(?:\.(\d+))?$/.exec(String(str).trim());
    if (!m) throw new Error('Enter a plain number such as 0.25.');
    var frac = m[2] || '';
    if (frac.length > dec) throw new Error('At most ' + dec + ' decimal places for this token.');
    while (frac.length < dec) frac += '0';
    var n = BigInt(m[1] + frac);
    if (n <= 0n) throw new Error('Enter an amount greater than zero.');
    return n;
  }

  function buildTx(W, from, to, asset, amount, conn) {
    var fromPk = new W.PublicKey(from), toPk = new W.PublicKey(to), ixs = [], units;
    if (asset === 'SOL') {
      units = toUnits(amount, 9);
      if (units > 18446744073709551615n) throw new Error('Amount is too large.');
      ixs.push(W.SystemProgram.transfer({ fromPubkey: fromPk, toPubkey: toPk, lamports: units }));
      return Promise.resolve({ ixs: ixs, units: units, dec: 9 });
    }
    var t = netInfo().tokens[asset];
    if (!t) return Promise.reject(new Error(asset + ' is not available on ' + netInfo().label + '.'));
    units = toUnits(amount, t.dec);
    var mint = new W.PublicKey(t.mint), tp = new W.PublicKey(TOKEN_PROG), ap = new W.PublicKey(ATA_PROG);
    function ata(owner) { return W.PublicKey.findProgramAddressSync([owner.toBytes(), tp.toBytes(), mint.toBytes()], ap)[0]; }
    var src = ata(fromPk), dst = ata(toPk);
    return conn.getTokenAccountBalance(src).then(function (b) {
      if (BigInt(b.value.amount) < units) throw new Error('Not enough ' + asset + ' in your wallet.');
    }, function () { throw new Error('Your wallet has no ' + asset + ' account.'); }).then(function () {
      /* create the recipient token account if needed (sender pays the small rent) */
      ixs.push(new W.TransactionInstruction({
        programId: ap, data: new Uint8Array([1]),
        keys: [
          { pubkey: fromPk, isSigner: true, isWritable: true }, { pubkey: dst, isSigner: false, isWritable: true },
          { pubkey: toPk, isSigner: false, isWritable: false }, { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: W.SystemProgram.programId, isSigner: false, isWritable: false }, { pubkey: tp, isSigner: false, isWritable: false }
        ]
      }));
      var data = new Uint8Array(10); data[0] = 12;
      new DataView(data.buffer).setBigUint64(1, units, true); data[9] = t.dec;
      ixs.push(new W.TransactionInstruction({
        programId: tp, data: data,
        keys: [
          { pubkey: src, isSigner: false, isWritable: true }, { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: dst, isSigner: false, isWritable: true }, { pubkey: fromPk, isSigner: true, isWritable: false }
        ]
      }));
      return { ixs: ixs, units: units, dec: t.dec };
    });
  }

  function b58(bytes) {
    var A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz', d = [0], i, j, out = '';
    for (i = 0; i < bytes.length; i++) {
      var c = bytes[i];
      for (j = 0; j < d.length; j++) { c += d[j] << 8; d[j] = c % 58; c = (c / 58) | 0; }
      while (c) { d.push(c % 58); c = (c / 58) | 0; }
    }
    for (i = 0; bytes[i] === 0 && i < bytes.length - 1; i++) out += '1';
    for (i = d.length - 1; i >= 0; i--) out += A[d[i]];
    return out;
  }

  /* send({to, asset, amount}, progress) -> Promise<signature> */
  function send(o, progress) {
    var say = progress || function () {};
    var W = window.solanaWeb3;
    if (!W) return Promise.reject(new Error('Solana library failed to load. Check your connection and reload.'));
    var s = session();
    if (!s) return Promise.reject(new Error('Connect a wallet first.'));
    if (s.mode !== 'wallet') return Promise.reject(new Error('Watch-only addresses cannot sign. Connect a wallet.'));
    if (o.to === s.address) return Promise.reject(new Error('Recipient is your own address.'));
    var conn = new W.Connection(getRpc(), 'confirmed'), built, bh, tx;
    var ready = Promise.resolve();
    if (!live || live.address !== s.address) {
      /* page was reloaded or navigated: re-link to the wallet the user connected earlier */
      var ent = entries().filter(function (x) { return x.name === s.wallet && x.detected; })[0];
      if (!ent) return Promise.reject(new Error('Wallet not found. Open Connect wallet and reconnect.'));
      say('Reconnecting to ' + s.wallet);
      ready = connectEntry(ent).then(function (addr) {
        if (addr !== s.address) throw new Error('The wallet switched accounts. Reconnect on the Connect wallet page.');
      });
    }
    say('Preparing the transfer');
    return ready.then(function () { return buildTx(W, s.address, o.to, o.asset, o.amount, conn); }).then(function (b) {
      built = b; return conn.getLatestBlockhash('confirmed');
    }).then(function (r) {
      bh = r;
      tx = new W.Transaction({ feePayer: new W.PublicKey(s.address), recentBlockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight });
      built.ixs.forEach(function (ix) { tx.add(ix); });
      say('Approve the transaction in your wallet');
      if (live.provider) {
        var p = live.provider;
        if (p.signAndSendTransaction) return Promise.resolve(p.signAndSendTransaction(tx)).then(function (res) { return typeof res === 'string' ? res : res.signature; });
        return Promise.resolve(p.signTransaction(tx)).then(function (signed) { return conn.sendRawTransaction(signed.serialize()); });
      }
      var f = live.wallet.features['solana:signAndSendTransaction'];
      if (!f) throw new Error('This wallet cannot sign and send transactions here.');
      return Promise.resolve(f.signAndSendTransaction({
        account: live.account, chain: netInfo().chain, transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false })
      })).then(function (res) { return b58(res[0].signature); });
    }).then(function (sig) {
      say('Sent. Waiting for confirmation');
      return conn.confirmTransaction({ signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, 'confirmed').then(function (r) {
        if (r.value && r.value.err) throw new Error('The network rejected the transaction.');
        return sig;
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* UI helpers                                                           */
  /* ------------------------------------------------------------------ */
  function toast(text) {
    var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = text;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 1800);
  }
  function copy(text) {
    function fallback() {
      try {
        var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Copied');
      } catch (e) { toast('Select and copy manually'); }
    }
    try { navigator.clipboard.writeText(text).then(function () { toast('Copied'); }, fallback); } catch (e) { fallback(); }
  }

  function actionForm(f, o) {
    var log = f.querySelector('.log'), btn = f.querySelector('button[type=submit]'), msg = f.querySelector('.msg');
    f.addEventListener('submit', function (e) {
      e.preventDefault(); msg.textContent = ''; log.innerHTML = '';
      if (!session()) { msg.textContent = 'Connect a wallet first. Use the Connect wallet button at the top right.'; return; }
      var err = o.validate(); if (err) { msg.textContent = err; return; }
      btn.disabled = true; var i = 0;
      (function next() {
        var li = document.createElement('li');
        if (i < o.steps.length) { li.textContent = o.steps[i++]; log.appendChild(li); setTimeout(next, reduce ? 0 : 700); }
        else { li.className = 'done'; li.textContent = 'Preview finished. Nothing was signed or broadcast.'; log.appendChild(li); btn.disabled = false; }
      })();
    });
  }

  function buildNav(page) {
    var h = document.createElement('header'); h.className = 'site';
    var tabs = PAGES.map(function (p) {
      return '<a href="' + p[0] + '.html"' + (p[0] === page ? ' aria-current="page"' : '') + '>' + p[1] + '</a>';
    }).join('');
    h.innerHTML = '<div class="wrap"><div class="bar"><a class="brand" href="index.html" aria-label="Nexora home"><canvas id="logo-mark"></canvas><span>Nexora</span></a>' +
      '<a class="btn sm solid" id="conn" href="connect.html"></a></div><nav class="tabs" aria-label="Pages">' + tabs + '</nav></div>';
    document.body.insertBefore(h, document.body.firstChild);
    if (getNet() === 'devnet') {
      var bn = document.createElement('div'); bn.className = 'devnet-banner'; bn.setAttribute('role', 'status');
      bn.textContent = 'DEVNET: test coins only. Nothing here uses real funds.';
      document.body.insertBefore(bn, document.body.firstChild);
    }
    var conn = h.querySelector('#conn');
    onSession(function (s) {
      conn.innerHTML = '';
      if (s) { var d = document.createElement('span'); d.className = 'dot'; conn.appendChild(d); conn.appendChild(document.createTextNode(short(s.address))); conn.title = s.wallet + ' ' + s.address; }
      else conn.textContent = 'Connect wallet';
    });
    var logo = h.querySelector('#logo-mark'); logo.style.width = '36px'; logo.style.height = '36px';
    run(logo, 'logo');
  }

  function buildFoot() {
    var f = document.createElement('footer'); f.className = 'foot';
    f.innerHTML = '<div class="wrap"><div class="fgrid">' +
      '<div class="fcol fabout"><p class="ftitle">nexora_</p><p>Privacy wallet for Solana. Preview build: wallet connection and public Send are live. Shield and swap are previews that never sign or broadcast.</p><p>We will never ask for your seed phrase or private key.</p></div>' +
      '<nav class="fcol" aria-label="Help"><p class="ftitle">## help</p><a href="help.html">./help-center</a><a href="docs.html">./docs</a><a href="security.html">./security</a></nav>' +
      '<nav class="fcol" aria-label="About"><p class="ftitle">## about</p><a href="features.html">./features</a><a href="wallets.html">./wallets</a><a href="index.html">./home</a></nav>' +
      '<nav class="fcol" aria-label="Community"><p class="ftitle">## community</p>' +
      '<a href="https://solana.com/community" target="_blank" rel="noopener">solana.com/community \u2197</a>' +
      '<a href="https://solana.stackexchange.com" target="_blank" rel="noopener">solana.stackexchange.com \u2197</a>' +
      '<span class="soon">discord<em>soon</em></span><span class="soon">x<em>soon</em></span><span class="soon">github<em>soon</em></span></nav>' +
      '</div><p class="fbase">\u00A9 2026 nexora \u00B7 build: preview \u00B7 chain: solana</p></div>';
    document.body.appendChild(f);
  }

  function init(o) {
    buildNav(o.page);
    if (o.anim) {
      var c = document.createElement('canvas'); c.className = 'bg'; c.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(c, document.body.firstChild.nextSibling);
      run(c, o.anim);
    }
    buildFoot();
  }

  window.NX = {
    init: init, run: run, session: session, setSession: setSession, onSession: onSession, short: short,
    renderWallets: renderWallets, watchOnly: watchOnly, copy: copy, toast: toast, actionForm: actionForm, B58: B58, send: send, getRpc: getRpc, setRpc: setRpc, getNet: getNet, setNet: setNet, netInfo: netInfo, defaultRpc: defaultRpc, explorerTx: explorerTx, NETS: NETS
  };
})();
