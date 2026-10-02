/* =====================================================================
   Vision Estimators — 3D scenes
   Requires the global THREE build in assets/vendor/three.min.js.
   Loaded lazily by main.js only on capable devices.

   Scenes (by data-scene attribute):
     hero  — construction site with live estimating annotations
     story — drawing → 3D building → measure → quantities (scroll driven)
     civil — road / earthworks cut-away with feature pins
     cta   — blueprint → building loop behind the final call to action
   ===================================================================== */
(function () {
  'use strict';
  var T = window.THREE;
  if (!T || !T.WebGLRenderer) return;

  var mobile = window.matchMedia('(max-width: 767px)').matches || window.matchMedia('(pointer: coarse)').matches;
  var CAPTURE = /[?&]capture\b/.test(window.location.search);
  var DPR = CAPTURE ? (window.devicePixelRatio || 1) : Math.min(window.devicePixelRatio || 1, mobile ? 1.3 : 1.75);
  var BG = 0xf2f6fc;

  /* ---------- helpers ---------- */
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function mat(color, o) {
    o = o || {};
    var p = { color: color, transparent: !!o.transparent, opacity: o.opacity == null ? 1 : o.opacity, side: o.side || T.FrontSide, flatShading: !!o.flat };
    if (o.emissive != null) { p.emissive = o.emissive; p.emissiveIntensity = o.ei == null ? 1 : o.ei; }
    if (o.depthWrite === false) p.depthWrite = false;
    if (o.depthTest === false) p.depthTest = false;
    if (mobile) return new T.MeshLambertMaterial(p);
    p.roughness = o.rough == null ? 0.85 : o.rough;
    p.metalness = o.metal == null ? 0.05 : o.metal;
    return new T.MeshStandardMaterial(p);
  }
  function lineMat(color, opacity, extra) {
    var p = { color: color, transparent: true, opacity: opacity, depthWrite: false };
    if (extra) for (var k in extra) p[k] = extra[k];
    return new T.LineBasicMaterial(p);
  }
  function basic(color, opacity, extra) {
    var p = { color: color, transparent: opacity < 1, opacity: opacity };
    if (extra) for (var k in extra) p[k] = extra[k];
    return new T.MeshBasicMaterial(p);
  }

  var _e = new T.Euler(), _q = new T.Quaternion();
  function M(x, y, z, rx, ry, rz, s) {
    _e.set(rx || 0, ry || 0, rz || 0);
    _q.setFromEuler(_e);
    var sc = s || 1;
    return new T.Matrix4().compose(V(x, y, z), _q.clone(), V(sc, sc, sc));
  }

  /* Geometry batcher: collects parts per material and merges them into one mesh
     per material plus one edge-line object, keeping draw calls very low. */
  function Kit() { this.parts = {}; this.edges = []; this.segs = []; }
  Kit.prototype.add = function (geo, key, m, edge, angle) {
    var g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (!g.attributes.normal) g.computeVertexNormals();
    g.clearGroups();
    if (m) g.applyMatrix4(m);
    (this.parts[key] || (this.parts[key] = [])).push(g);
    if (edge !== false) this.edges.push(new T.EdgesGeometry(g, angle || 25));
    return g;
  };
  /* box with its base at y */
  Kit.prototype.box = function (key, w, h, d, x, y, z, ry, edge) {
    return this.add(new T.BoxGeometry(w, h, d), key, M(x, y + h / 2, z, 0, ry || 0, 0), edge);
  };
  Kit.prototype.member = function (key, a, b, t, edge) {
    var dir = new T.Vector3().subVectors(b, a), len = dir.length();
    var q = new T.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.normalize());
    var m = new T.Matrix4().compose(new T.Vector3().addVectors(a, b).multiplyScalar(0.5), q, V(1, 1, 1));
    return this.add(new T.BoxGeometry(t, len, t), key, m, edge === true);
  };
  Kit.prototype.seg = function (ax, ay, az, bx, by, bz) { this.segs.push(ax, ay, az, bx, by, bz); };
  Kit.prototype.build = function (mats, edgeMat, segMat) {
    var g = new T.Group(), k, list, merged;
    for (k in this.parts) {
      list = this.parts[k];
      merged = list.length > 1 ? T.mergeGeometries(list, false) : list[0];
      if (list.length > 1) list.forEach(function (x) { x.dispose(); });
      var mesh = new T.Mesh(merged, mats[k]);
      mesh.userData.key = k;
      g.add(mesh);
    }
    if (this.edges.length && edgeMat) {
      merged = this.edges.length > 1 ? T.mergeGeometries(this.edges, false) : this.edges[0];
      g.add(new T.LineSegments(merged, edgeMat));
    }
    if (this.segs.length) {
      var sg = new T.BufferGeometry();
      sg.setAttribute('position', new T.Float32BufferAttribute(this.segs, 3));
      g.add(new T.LineSegments(sg, segMat || edgeMat));
    }
    return g;
  };

  function segGeo(arr) {
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(arr, 3));
    return g;
  }

  /* dimension line with architectural ticks; axis 'x' | 'z' | 'y' */
  function dimSegs(arr, a, b, axis, ext) {
    arr.push(a.x, a.y, a.z, b.x, b.y, b.z);
    var t = 0.55;
    [a, b].forEach(function (p) {
      if (axis === 'y') arr.push(p.x - t, p.y - t, p.z, p.x + t, p.y + t, p.z);
      else arr.push(p.x - t, p.y, p.z + t, p.x + t, p.y, p.z - t);
    });
    if (ext) ext.forEach(function (e) { arr.push(e[0], e[1], e[2], e[3], e[4], e[5]); });
  }

  /* ---------- render loop ---------- */
  var stages = [];
  var rafId = 0, lastT = 0;
  var pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  if (!mobile) {
    window.addEventListener('pointermove', function (e) {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }
  function loop(now) {
    rafId = requestAnimationFrame(loop);
    var dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (document.hidden) return;
    pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 2.5);
    pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 2.5);
    var any = false;
    for (var i = 0; i < stages.length; i++) if (stages[i].active) { stages[i].frame(dt); any = true; }
    if (!any) { cancelAnimationFrame(rafId); rafId = 0; }
  }
  function ensureLoop() { if (!rafId) { lastT = performance.now(); rafId = requestAnimationFrame(loop); } }

  /* ---------- stage ---------- */
  function Stage(el, o) {
    o = o || {};
    this.el = el;
    var r = this.renderer = new T.WebGLRenderer({ antialias: !mobile, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: CAPTURE });
    r.setPixelRatio(DPR);
    r.outputColorSpace = T.SRGBColorSpace;
    r.toneMapping = T.NoToneMapping;
    r.setClearColor(0x000000, 0);
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(o.fov || 40, 1, o.near || 1, o.far || 1200);
    r.domElement.setAttribute('aria-hidden', 'true');
    el.appendChild(r.domElement);
    this.labels = [];
    this.w = this.h = 0;
    this.viewX = 0; this.viewY = 0;
    this.time = o.t0 || 0;
    this.active = false;
    this.live = false;
    this.frames = 0; this.slow = 0;
    var self = this;
    r.domElement.addEventListener('webglcontextlost', function (e) { e.preventDefault(); self.active = false; el.classList.remove('is-live'); });
    this.ro = new ResizeObserver(function () { self.resize(); });
    this.ro.observe(el);
    this.resize();
  }
  Stage.prototype.resize = function (force) {
    var w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h || (!force && w === this.w && h === this.h)) return;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    if (this.onResize) this.onResize(w, h);
    this.applyView();
  };
  Stage.prototype.applyView = function () {
    if (this.viewX || this.viewY) this.camera.setViewOffset(this.w, this.h, -this.viewX * this.w, this.viewY * this.h, this.w, this.h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  };
  Stage.prototype.setActive = function (on) { this.active = on; if (on) ensureLoop(); };
  Stage.prototype.addLabel = function (el, v) { this.labels.push({ el: el, v: v, vis: true }); };
  var _v = new T.Vector3();
  Stage.prototype.project = function () {
    var cam = this.camera, w = this.w, h = this.h;
    for (var i = 0; i < this.labels.length; i++) {
      var L = this.labels[i];
      _v.copy(L.v).project(cam);
      var vis = _v.z < 1 && _v.x > -1.1 && _v.x < 1.1 && _v.y > -1.1 && _v.y < 1.1;
      if (vis !== L.vis) { L.el.style.visibility = vis ? '' : 'hidden'; L.vis = vis; }
      if (!vis) continue;
      var sx = (_v.x * 0.5 + 0.5) * w, sy = (-_v.y * 0.5 + 0.5) * h;
      L.el.style.transform = 'translate3d(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px,0)';
      if (this.zone) {
        var z = this.zone, off = sx < z.x0 * w || sx > w - 90 || sy < 90 || sy > z.y1 * h;
        if (off !== L.off) { L.el.classList.toggle('is-off', off); L.off = off; }
      }
    }
  };
  Stage.prototype.frame = function (dt) {
    if (!this.w) { this.resize(); if (!this.w) return; }
    this.time += dt;
    if (this.update) this.update(dt, this.time);
    this.renderer.render(this.scene, this.camera);
    this.project();
    if (!this.live) { this.live = true; this.el.classList.add('is-live'); }
    /* adaptive resolution: drop to 1x if the device struggles */
    this.frames++;
    if (dt > 1 / 32) this.slow++;
    if (this.frames >= 90) {
      if (this.slow > 45 && this.renderer.getPixelRatio() > 1) { this.renderer.setPixelRatio(1); this.resize(true); }
      this.frames = 0; this.slow = 0;
    }
  };

  /* ---------- shared builders ---------- */
  function excavator(mats, edgeMat, s) {
    var root = new T.Group();
    var base = new Kit();
    base.box('dark', 4.6, 0.95, 0.9, 0, 0, 1.35);
    base.box('dark', 4.6, 0.95, 0.9, 0, 0, -1.35);
    base.box('dark', 2.2, 0.5, 1.9, 0, 0.45, 0);
    root.add(base.build(mats, edgeMat));
    var upper = new T.Group(); upper.position.y = 0.95; root.add(upper);
    var u = new Kit();
    u.box('machine', 3.4, 1.25, 2.6, 0.5, 0, 0);
    u.box('machine', 1.3, 1.6, 1.05, -0.55, 1.25, -0.72);
    u.box('lit', 0.06, 0.8, 0.85, -1.22, 1.6, -0.72, 0, false);
    u.box('dark', 0.9, 1.0, 2.5, 2.35, 0.1, 0);
    upper.add(u.build(mats, edgeMat));
    var boom = new T.Group(); boom.position.set(-1.1, 1.0, 0.35); upper.add(boom);
    var b = new Kit(); b.box('machine', 5.6, 0.55, 0.45, -2.8, -0.275, 0);
    boom.add(b.build(mats, edgeMat));
    var stick = new T.Group(); stick.position.set(-5.5, 0, 0); boom.add(stick);
    var k = new Kit();
    k.box('machine', 3.6, 0.42, 0.36, -1.8, -0.21, 0);
    k.box('dark', 0.95, 0.8, 1.1, -3.75, -0.45, 0);
    stick.add(k.build(mats, edgeMat));
    root.scale.setScalar(s || 1);
    return { root: root, upper: upper, boom: boom, stick: stick };
  }

  /* =================================================================
     HERO — construction site
     ================================================================= */
  function sceneHero(st) {
    var S = st.scene, cam = st.camera;
    var root = st.el.closest('section') || document;
    cam.fov = mobile ? 42 : 32; cam.near = 1; cam.far = 1400;
    S.fog = new T.FogExp2(BG, mobile ? 0.0036 : 0.003);
    S.add(new T.HemisphereLight(0xffffff, 0xc9d4e3, 1.4));
    var key = new T.DirectionalLight(0xfff8ee, 1.8); key.position.set(-90, 160, 120); S.add(key);
    var rim = new T.DirectionalLight(0xbcd4ff, 0.7); rim.position.set(160, 70, -180); S.add(rim);

    var m = {
      concrete: mat(0xd3dbe6), concreteL: mat(0xe6ebf2), steel: mat(0x9aa9bd, { metal: 0.3, rough: 0.5 }),
      dark: mat(0x5b6675), crane: mat(0xf0b429, { metal: 0.2, rough: 0.55 }), white: mat(0xffffff),
      glass: mat(0x6fa3ea, { transparent: true, opacity: 0.66, emissive: 0x2a6fd6, ei: 0.14, rough: 0.15, metal: 0.2 }),
      lit: basic(0x5d9cf0, 0.55), asphalt: mat(0x6b7480, { rough: 0.95 }), walk: mat(0xd5dce6),
      earth: mat(0xd2bf9f, { flat: true, side: T.DoubleSide, rough: 1 }), ground: mat(0xf4f7fb, { rough: 1 }),
      machine: mat(0xe8a91f, { rough: 0.55, metal: 0.2 }), paint: basic(0xffffff, 0.85), ctx: mat(0xe6ecf4, { rough: 0.9 }), cabin: mat(0xffffff)
    };
    var E = {};
    ['building', 'pit', 'yard', 'excav', 'road', 'bridge', 'crane', 'site'].forEach(function (k) {
      E[k] = lineMat(0x1d5fe0, k === 'road' ? 0.3 : k === 'site' ? 0.42 : 0.6);
      E[k].userData.base = E[k].opacity;
    });
    var PIT = { x0: -82, x1: -52, z0: 8, z1: 26, d: 5, b: 3 };

    /* ground with a hole for the excavation */
    var gs = new T.Shape();
    gs.moveTo(-700, -700); gs.lineTo(700, -700); gs.lineTo(700, 700); gs.lineTo(-700, 700); gs.lineTo(-700, -700);
    var hole = new T.Path();
    hole.moveTo(PIT.x0, -PIT.z0); hole.lineTo(PIT.x0, -PIT.z1); hole.lineTo(PIT.x1, -PIT.z1); hole.lineTo(PIT.x1, -PIT.z0); hole.lineTo(PIT.x0, -PIT.z0);
    gs.holes.push(hole);
    var gg = new T.ShapeGeometry(gs); gg.rotateX(-Math.PI / 2);
    S.add(new T.Mesh(gg, m.ground));

    /* blueprint grid */
    function grid(size, step, y) {
      var a = [];
      for (var v = -size; v <= size + 1e-6; v += step) {
        if (v > PIT.x0 && v < PIT.x1) a.push(v, y, -size, v, y, PIT.z0, v, y, PIT.z1, v, y, size); else a.push(v, y, -size, v, y, size);
        if (v > PIT.z0 && v < PIT.z1) a.push(-size, y, v, PIT.x0, y, v, PIT.x1, y, v, size, y, v); else a.push(-size, y, v, size, y, v);
      }
      return segGeo(a);
    }
    S.add(new T.LineSegments(grid(380, mobile ? 10 : 5, 0.04), lineMat(0x1d5fe0, 0.15)));
    S.add(new T.LineSegments(grid(375, 25, 0.06), lineMat(0x1d5fe0, 0.34)));

    /* excavation pit */
    var pit = new Kit();
    var tp = [[PIT.x0, PIT.z0], [PIT.x1, PIT.z0], [PIT.x1, PIT.z1], [PIT.x0, PIT.z1]];
    var bp = [[PIT.x0 + PIT.b, PIT.z0 + PIT.b], [PIT.x1 - PIT.b, PIT.z0 + PIT.b], [PIT.x1 - PIT.b, PIT.z1 - PIT.b], [PIT.x0 + PIT.b, PIT.z1 - PIT.b]];
    var pos = [];
    for (var i = 0; i < 4; i++) {
      var j = (i + 1) % 4, a1 = tp[i], a2 = tp[j], b1 = bp[i], b2 = bp[j];
      pos.push(a1[0], 0, a1[1], a2[0], 0, a2[1], b2[0], -PIT.d, b2[1], a1[0], 0, a1[1], b2[0], -PIT.d, b2[1], b1[0], -PIT.d, b1[1]);
    }
    pos.push(bp[0][0], -PIT.d, bp[0][1], bp[1][0], -PIT.d, bp[1][1], bp[2][0], -PIT.d, bp[2][1], bp[0][0], -PIT.d, bp[0][1], bp[2][0], -PIT.d, bp[2][1], bp[3][0], -PIT.d, bp[3][1]);
    var pg = new T.BufferGeometry(); pg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); pg.computeVertexNormals();
    pit.add(pg, 'earth', null, false);
    for (i = 0; i < 4; i++) {
      j = (i + 1) % 4;
      pit.seg(tp[i][0], 0.08, tp[i][1], tp[j][0], 0.08, tp[j][1]);
      pit.seg(bp[i][0], -PIT.d, bp[i][1], bp[j][0], -PIT.d, bp[j][1]);
      pit.seg(tp[i][0], 0.08, tp[i][1], bp[i][0], -PIT.d, bp[i][1]);
    }
    for (var d = 1; d < PIT.d; d++) {
      var ins = PIT.b * d / PIT.d;
      var c = [[PIT.x0 + ins, PIT.z0 + ins], [PIT.x1 - ins, PIT.z0 + ins], [PIT.x1 - ins, PIT.z1 - ins], [PIT.x0 + ins, PIT.z1 - ins]];
      for (i = 0; i < 4; i++) { j = (i + 1) % 4; pit.seg(c[i][0], -d, c[i][1], c[j][0], -d, c[j][1]); }
    }
    pit.add(new T.ConeGeometry(7.5, 4.8, 7, 1), 'earth', M(-98, 2.4, 12, 0, 0.4, 0), true, 20);
    pit.add(new T.ConeGeometry(5.2, 3.4, 6, 1), 'earth', M(-95, 1.7, 29, 0, 1.1, 0), true, 20);
    S.add(pit.build(m, E.pit));

    /* building under construction */
    var B = new Kit(), bz = -10, FH = 3.6;
    var xs = [-18, -9, 0, 9, 18], zs = [-12, -4, 4, 12];
    B.box('concreteL', 38, 0.4, 26, 0, 0, bz);
    for (var L = 1; L <= 6; L++) B.box('concrete', 36.6, 0.3, 24.6, 0, L * FH - 0.3, bz);
    B.box('concrete', 18.6, 0.3, 24.6, -9, 7 * FH - 0.3, bz);
    xs.forEach(function (x) { zs.forEach(function (z) { B.box('concrete', 0.6, 6 * FH, 0.6, x, 0, z + bz, 0, true); }); });
    [-18, -9, 0].forEach(function (x) { zs.forEach(function (z) { B.box('steel', 0.4, FH, 0.4, x, 6 * FH, z + bz); }); });
    [9, 18].forEach(function (x) {
      zs.forEach(function (z) {
        for (var r = 0; r < 4; r++) { var ox = (r % 2 ? 0.18 : -0.18), oz = (r < 2 ? 0.18 : -0.18); B.seg(x + ox, 6 * FH, z + bz + oz, x + ox, 6 * FH + 1.3, z + bz + oz); }
      });
    });
    B.box('concreteL', 6, 8 * FH, 8, 4.5, 0, bz);
    for (L = 0; L < 4; L++) {
      for (i = 0; i < 4; i++) {
        var gx = (xs[i] + xs[i + 1]) / 2, lit = (L * 7 + i * 3) % 5 === 0;
        B.box(lit ? 'lit' : 'glass', 8.3, FH - 0.55, 0.12, gx, L * FH + 0.1, bz + 12.35, 0, true);
      }
      for (i = 0; i < 3; i++) {
        var gz = (zs[i] + zs[i + 1]) / 2 + bz, lit2 = (L * 5 + i * 2) % 4 === 1;
        B.box(lit2 ? 'lit' : 'glass', 0.12, FH - 0.55, 7.3, -18.35, L * FH + 0.1, gz, 0, true);
      }
    }
    for (var sy = 3 * FH; sy <= 7 * FH + 0.01; sy += 1.8) {
      B.seg(19, sy, bz - 13, 19, sy, bz + 13); B.seg(20.3, sy, bz - 13, 20.3, sy, bz + 13);
    }
    for (var sz = -13; sz <= 13.01; sz += 2.6) {
      B.seg(19, 3 * FH, bz + sz, 19, 7 * FH + 1, bz + sz); B.seg(20.3, 3 * FH, bz + sz, 20.3, 7 * FH + 1, bz + sz);
      if (sz < 12) B.seg(20.3, 3 * FH, bz + sz, 20.3, 3 * FH + 3.6, bz + sz + 2.6);
    }
    S.add(B.build(m, E.building));

    /* tower crane */
    var CR = new Kit(), cx = 30, cz = -30, H = 44, cc = 1.0;
    CR.box('concreteL', 7, 1.2, 7, cx, 0, cz);
    [[cc, cc], [cc, -cc], [-cc, cc], [-cc, -cc]].forEach(function (p) { CR.box('crane', 0.28, H, 0.28, cx + p[0], 1.2, cz + p[1], 0, false); });
    for (var y = 1.2; y < H + 1.2; y += 2.4) {
      var y2 = y + 2.4;
      CR.seg(cx + cc, y, cz - cc, cx + cc, y2, cz + cc); CR.seg(cx - cc, y, cz + cc, cx - cc, y2, cz - cc);
      CR.seg(cx - cc, y, cz + cc, cx + cc, y2, cz + cc); CR.seg(cx + cc, y, cz - cc, cx - cc, y2, cz - cc);
      CR.seg(cx - cc, y, cz - cc, cx + cc, y, cz - cc); CR.seg(cx - cc, y, cz + cc, cx + cc, y, cz + cc);
    }
    S.add(CR.build(m, E.crane, E.crane));
    var slew = new T.Group(); slew.position.set(cx, H + 1.2, cz); S.add(slew);
    var J = new Kit();
    J.box('crane', 2.8, 1.0, 2.8, 0, 0, 0);
    J.box('white', 2.1, 2.2, 2.0, 1.6, -1.6, 2.3);
    J.box('lit', 0.05, 1.0, 1.6, 2.68, -0.9, 2.3, 0, false);
    J.box('crane', 55, 0.2, 0.2, 29, 1.0, 0.8, 0, false); J.box('crane', 55, 0.2, 0.2, 29, 1.0, -0.8, 0, false);
    J.box('crane', 55, 0.2, 0.2, 29, 2.8, 0, 0, false);
    for (var jx = 1.5; jx < 56; jx += 2.2) {
      J.seg(jx, 1.1, 0.8, jx + 1.1, 2.9, 0); J.seg(jx + 1.1, 2.9, 0, jx + 2.2, 1.1, 0.8);
      J.seg(jx, 1.1, -0.8, jx + 1.1, 2.9, 0); J.seg(jx + 1.1, 2.9, 0, jx + 2.2, 1.1, -0.8);
      J.seg(jx, 1.1, 0.8, jx, 1.1, -0.8);
    }
    J.box('crane', 16, 0.22, 0.22, -9.4, 1.0, 0.95, 0, false); J.box('crane', 16, 0.22, 0.22, -9.4, 1.0, -0.95, 0, false);
    J.box('dark', 16, 0.08, 1.9, -9.4, 1.05, 0, 0, false);
    for (i = 0; i < 3; i++) J.box('concreteL', 1.1, 2.6, 2.4, -16.4 + i * 1.2, -1.3, 0);
    J.member('crane', V(-1.1, 1.2, 0.9), V(0, 10, 0), 0.25); J.member('crane', V(-1.1, 1.2, -0.9), V(0, 10, 0), 0.25);
    J.member('crane', V(1.1, 1.2, 0.9), V(0, 10, 0), 0.25); J.member('crane', V(1.1, 1.2, -0.9), V(0, 10, 0), 0.25);
    J.seg(0, 10, 0, 36, 2.9, 0); J.seg(0, 10, 0, 54, 2.9, 0); J.seg(0, 10, 0, -16.8, 1.2, 0);
    slew.add(J.build(m, E.crane, E.crane));
    var trolley = new T.Group(); slew.add(trolley);
    var TK = new Kit(); TK.box('dark', 1.4, 0.5, 1.6, 0, 0.5, 0); trolley.add(TK.build(m, E.crane));
    var cableGeo = segGeo([0, 0.5, 0, 0, -10, 0]); trolley.add(new T.LineSegments(cableGeo, lineMat(0x44536b, 0.8)));
    var load = new T.Group(); trolley.add(load);
    var LK = new Kit(); LK.box('steel', 9, 0.5, 0.9, 0, -0.5, 0); LK.seg(-3, 0, 0, 0, 2.2, 0); LK.seg(3, 0, 0, 0, 2.2, 0); load.add(LK.build(m, E.crane, E.crane));
    var red = basic(0xff4d4d, 0.99);
    var l1 = new T.Mesh(new T.SphereGeometry(0.35, 8, 6), red); l1.position.set(0, 10.4, 0); slew.add(l1);
    var l2 = l1.clone(); l2.position.set(56.4, 3.1, 0); slew.add(l2);

    /* excavator on the pit edge */
    var ex = excavator(m, E.excav, 1);
    ex.root.position.set(-47.5, 0, 17); S.add(ex.root);

    /* road */
    var R = new Kit();
    R.box('asphalt', 760, 0.12, 14, 0, 0, 48, 0, false);
    R.box('walk', 760, 0.25, 3, 0, 0, 39.5, 0, false);
    R.box('walk', 760, 0.25, 3, 0, 0, 56.5, 0, false);
    R.seg(-380, 0.3, 41, 380, 0.3, 41); R.seg(-380, 0.3, 55, 380, 0.3, 55);
    R.seg(-380, 0.2, 41.4, 380, 0.2, 41.4); R.seg(-380, 0.2, 54.6, 380, 0.2, 54.6);
    for (var zz = 42; zz <= 54; zz += 1.4) R.box('paint', 4, 0.02, 0.7, -6, 0.12, zz, 0, false);
    S.add(R.build(m, E.road, E.road));
    var cl = [];
    for (var dx = -380; dx < 380; dx += 7) cl.push(dx, 0.16, 48, dx + 3.5, 0.16, 48);
    S.add(new T.LineSegments(segGeo(cl), lineMat(0xffffff, 0.95)));

    /* viaduct (bridge) behind the site — one span still under construction */
    var BR = new Kit(), vz = -96, vy = 13, g0 = 60, g1 = 90;
    [[-340, g0], [g1, 340]].forEach(function (sg) {
      var len = sg[1] - sg[0], cxs = (sg[0] + sg[1]) / 2;
      BR.box('concrete', len, 1.6, 13, cxs, vy - 1.6, vz, 0, true);
      BR.box('concreteL', len, 1.0, 0.4, cxs, vy, vz - 6.3, 0, true);
      BR.box('concreteL', len, 1.0, 0.4, cxs, vy, vz + 6.3, 0, true);
      for (var dx2 = sg[0]; dx2 < sg[1] - 4; dx2 += 8) BR.seg(dx2, vy + 0.02, vz, dx2 + 4, vy + 0.02, vz);
    });
    for (var px = -330; px <= 330; px += 30) {
      BR.add(new T.CylinderGeometry(1.0, 1.0, vy - 2.6, 12), 'concreteL', M(px, (vy - 2.6) / 2, vz - 3.6), true, 40);
      BR.add(new T.CylinderGeometry(1.0, 1.0, vy - 2.6, 12), 'concreteL', M(px, (vy - 2.6) / 2, vz + 3.6), true, 40);
      BR.box('concrete', 2.6, 1.0, 12, px, vy - 2.6, vz);
    }
    BR.box('concrete', 28, 1.6, 1.4, 75, 0, vz + 14);
    BR.box('concrete', 28, 1.6, 1.4, 75, 1.6, vz + 14.3);
    BR.box('concrete', 28, 1.6, 1.4, 75, 0, vz + 17);
    S.add(BR.build(m, E.bridge, E.bridge));
    var bx = 75;

    /* surrounding context blocks */
    var CX = new Kit();
    [[-230, -170, 34, 30, 44], [-170, -165, 26, 24, 28], [-110, -175, 30, 36, 62], [-40, -170, 40, 26, 36], [30, -168, 28, 30, 52], [95, -172, 36, 28, 30], [160, -166, 30, 34, 58], [225, -170, 40, 30, 40], [150, -40, 34, 30, 22], [210, 10, 30, 36, 34]].forEach(function (b) {
      CX.box('ctx', b[2], b[4], b[3], b[0], 0, b[1]);
      for (var fy = 4; fy < b[4] - 1; fy += 4) CX.seg(b[0] - b[2] / 2, fy, b[1] + b[3] / 2 + 0.05, b[0] + b[2] / 2, fy, b[1] + b[3] / 2 + 0.05);
    });
    S.add(CX.build(m, lineMat(0x1d5fe0, 0.14)));

    /* materials yard */
    var Y = new Kit();
    var ish = new T.Shape(), w2 = 0.2, hh = 0.45, tf = 0.05, tw = 0.035;
    ish.moveTo(-w2, 0); ish.lineTo(w2, 0); ish.lineTo(w2, tf); ish.lineTo(tw, tf); ish.lineTo(tw, hh - tf); ish.lineTo(w2, hh - tf); ish.lineTo(w2, hh);
    ish.lineTo(-w2, hh); ish.lineTo(-w2, hh - tf); ish.lineTo(-tw, hh - tf); ish.lineTo(-tw, tf); ish.lineTo(-w2, tf); ish.lineTo(-w2, 0);
    for (var ly = 0; ly < 3; ly++) for (var bi = 0; bi < 4; bi++) {
      var ig = new T.ExtrudeGeometry(ish, { depth: 10, bevelEnabled: false });
      Y.add(ig, 'steel', M(-41, 0.2 + ly * 0.55, 10.2 + bi * 0.55 + (ly % 2) * 0.2, 0, Math.PI / 2, 0), true, 30);
    }
    Y.box('dark', 0.3, 0.2, 3, -38, 0, 11.2, 0, false); Y.box('dark', 0.3, 0.2, 3, -34, 0, 11.2, 0, false);
    var pipeRows = [[-1.9, 0], [0, 0], [1.9, 0], [-0.95, 1], [0.95, 1], [0, 2]];
    pipeRows.forEach(function (p) {
      Y.add(new T.CylinderGeometry(0.9, 0.9, 2.4, 18, 1, true), 'concreteL', M(-27 + p[0], 0.9 + p[1] * 1.56, 28, Math.PI / 2, 0, 0), true, 40);
    });
    for (i = 0; i < 4; i++) Y.box('steel', 12, 0.3, 0.35, -30, 0.25, 19.5 + i * 0.7, 0, true);
    Y.box('dark', 0.3, 0.25, 3.2, -35, 0, 20.5, 0, false); Y.box('dark', 0.3, 0.25, 3.2, -25, 0, 20.5, 0, false);
    Y.box('dark', 2.4, 1.2, 1.2, -21, 0, 14); Y.box('dark', 2.4, 1.2, 1.2, -21, 1.2, 14.1);
    var jb = new T.Shape(); jb.moveTo(-0.3, 0); jb.lineTo(0.3, 0); jb.lineTo(0.12, 0.25); jb.lineTo(0.1, 0.8); jb.lineTo(-0.1, 0.8); jb.lineTo(-0.12, 0.25); jb.lineTo(-0.3, 0);
    for (i = 0; i < 10; i++) Y.add(new T.ExtrudeGeometry(jb, { depth: 3.8, bevelEnabled: false }), 'concreteL', M(-100 + i * 4, 0, 35, 0, Math.PI / 2, 0), true, 30);
    S.add(Y.build(m, E.yard));

    /* site cabins, boundary, survey */
    var SI = new Kit();
    [[36, 0, 22], [42.4, 0, 22], [39.2, 2.7, 22]].forEach(function (p) {
      SI.box('cabin', 6.1, 2.6, 2.4, p[0], p[1], p[2]);
      SI.box('lit', 3.2, 0.7, 0.05, p[0], p[1] + 1.2, p[2] + 1.23, 0, false);
    });
    var bnd = [[-112, -62], [64, -62], [64, 36.5], [-112, 36.5]];
    for (i = 0; i < 4; i++) {
      j = (i + 1) % 4;
      var p0 = bnd[i], p1 = bnd[j], len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      for (var t = 0; t < len; t += 4) {
        var t2 = Math.min(len, t + 2), f1 = t / len, f2 = t2 / len;
        SI.seg(lerp(p0[0], p1[0], f1), 0.1, lerp(p0[1], p1[1], f1), lerp(p0[0], p1[0], f2), 0.1, lerp(p0[1], p1[1], f2));
      }
      SI.seg(p0[0] - 2.5, 0.1, p0[1], p0[0] + 2.5, 0.1, p0[1]); SI.seg(p0[0], 0.1, p0[1] - 2.5, p0[0], 0.1, p0[1] + 2.5);
    }
    var tri = V(-16, 0, 30);
    [0, 2.094, 4.189].forEach(function (a) { SI.member('dark', V(tri.x + Math.cos(a) * 0.7, 0, tri.z + Math.sin(a) * 0.7), V(tri.x, 1.45, tri.z), 0.06); });
    SI.box('white', 0.3, 0.35, 0.3, tri.x, 1.45, tri.z);
    SI.box('white', 0.06, 1.9, 0.06, -19.8, 0, 3.8, 0, false);
    S.add(SI.build(m, E.site, E.site));
    var beamA = V(-16, 1.65, 30), beamB = V(-19.8, 1.85, 3.8);
    var beamGeo = segGeo([beamA.x, beamA.y, beamA.z, beamB.x, beamB.y, beamB.z]);
    var beam = new T.LineSegments(beamGeo, lineMat(0x0ea5e9, 0.95)); S.add(beam);
    var pulse = new T.Mesh(new T.SphereGeometry(0.26, 8, 6), basic(0x1d5fe0, 1)); S.add(pulse);

    /* vehicles */
    function truck(kind) {
      var g = new T.Group(), k = new Kit();
      k.box('dark', 8.4, 0.7, 2.4, 0, 0.6, 0);
      k.box('white', 2.2, 2.4, 2.4, 3.2, 1.2, 0);
      k.box('lit', 0.05, 0.3, 2.0, 4.31, 1.0, 0, 0, false);
      if (kind === 'mixer') k.add(new T.CylinderGeometry(1.25, 0.9, 4.6, 14), 'steel', M(-1.1, 2.7, 0, 0, 0, Math.PI / 2 - 0.2), true, 35);
      else k.box('steel', 5.4, 1.7, 2.45, -1.4, 1.3, 0);
      [-2.8, -1.6, 3.1].forEach(function (x) {
        k.add(new T.CylinderGeometry(0.55, 0.55, 2.5, 12), 'dark', M(x, 0.55, 0, Math.PI / 2, 0, 0), false);
      });
      g.add(k.build(m, E.road));
      S.add(g);
      return g;
    }
    var trucks = [{ g: truck('dump'), x: -120, z: 44.6, v: 9 }, { g: truck('mixer'), x: 180, z: 51.4, v: -7.5 }];
    trucks[1].g.rotation.y = Math.PI;

    /* scan ring */
    var ringMat = basic(0x1d5fe0, 0.5, { depthWrite: false, side: T.DoubleSide });
    var ring = new T.Mesh(new T.RingGeometry(0.985, 1, 128), ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.3, -10); S.add(ring);

    /* particles */
    var parts = null, pArr = null, PN = 0;
    if (PN) {
      pArr = new Float32Array(PN * 3);
      for (i = 0; i < PN; i++) { pArr[i * 3] = (Math.random() - 0.5) * 340; pArr[i * 3 + 1] = Math.random() * 70; pArr[i * 3 + 2] = (Math.random() - 0.5) * 240; }
      var pgeo = new T.BufferGeometry(); pgeo.setAttribute('position', new T.BufferAttribute(pArr, 3));
      parts = new T.Points(pgeo, new T.PointsMaterial({ color: 0x8fe6ff, size: 2.2 * DPR, sizeAttenuation: false, transparent: true, opacity: 0.5, depthWrite: false, blending: T.AdditiveBlending }));
      S.add(parts);
    }

    /* dimension lines */
    var D = [];
    dimSegs(D, V(-18, 0.3, 6.5), V(18, 0.3, 6.5), 'x', [[-18, 0.3, 2.4, -18, 0.3, 7.5], [18, 0.3, 2.4, 18, 0.3, 7.5]]);
    dimSegs(D, V(-22, 0, 2.4), V(-22, 6 * FH, 2.4), 'y', [[-18.5, 6 * FH, 2.4, -23, 6 * FH, 2.4]]);
    dimSegs(D, V(PIT.x0, 0.3, 4.5), V(PIT.x1, 0.3, 4.5), 'x', [[PIT.x0, 0.3, 8, PIT.x0, 0.3, 3.5], [PIT.x1, 0.3, 8, PIT.x1, 0.3, 3.5]]);
    dimSegs(D, V(PIT.x0 - 3.5, 0, PIT.z1), V(PIT.x0 - 3.5, -PIT.d, PIT.z1), 'y');
    dimSegs(D, V(90, vy + 1.2, vz + 8), V(120, vy + 1.2, vz + 8), 'x', [[90, vy + 1.2, vz + 6.5, 90, vy + 1.2, vz + 9], [120, vy + 1.2, vz + 6.5, 120, vy + 1.2, vz + 9]]);
    S.add(new T.LineSegments(segGeo(D), lineMat(0x1548b5, 0.9)));
    var labelsLayer = st.el.querySelector('.scene-labels');
    [['36.00 m', V(0, 0.3, 6.5)], ['21.60 m', V(-22, 10.8, 2.4)], ['30.00 m', V(-67, 0.3, 4.5)], ['5.00 m', V(PIT.x0 - 3.5, -2.5, PIT.z1)], ['30.00 m', V(105, vy + 1.2, vz + 8)]].forEach(function (d) {
      if (!labelsLayer) return;
      var el = document.createElement('span'); el.className = 'dim'; el.textContent = d[0];
      labelsLayer.appendChild(el); st.addLabel(el, d[1]);
    });

    /* annotation tags */
    var anchors = {
      takeoff: V(-18, 7 * FH + 1, 2.4), qto: V(-67, -1.2, 17), materials: V(-36, 2.2, 11.5),
      labour: V(-49, 6.5, 17), boq: V(34, 0.4, 48), cost: V(bx, vy + 0.5, vz + 6)
    };
    var groupOf = { qto: 'pit', boq: 'road', materials: 'yard', labour: 'excav', cost: 'bridge', takeoff: 'building' };
    var order = ['qto', 'boq', 'materials', 'labour', 'cost', 'takeoff'];
    var tags = [];
    Array.prototype.forEach.call(root.querySelectorAll('.tag[data-anchor]'), function (el) {
      var k = el.getAttribute('data-anchor');
      if (anchors[k]) { st.addLabel(el, anchors[k]); tags.push({ el: el, key: k }); }
    });
    var tickers = Array.prototype.slice.call(root.querySelectorAll('.ticker__item[data-key]'));
    var hudAz = root.querySelector('[data-hud-az]');
    var hudX = root.querySelector('[data-hud-x]'), hudY = root.querySelector('[data-hud-y]'), hudZ = root.querySelector('[data-hud-z]');
    var fi = -1, ft = 0, hudT = 0;
    function focus(n) {
      fi = n;
      var k = order[n];
      tags.forEach(function (t) { t.el.classList.toggle('is-focus', t.key === k); });
      tickers.forEach(function (x) { x.classList.toggle('is-active', x.getAttribute('data-key') === k); });
    }

    /* framing */
    st.onResize = function (w, h) {
      if (w < 600) { st.viewX = 0; st.viewY = 0.27; st.zone = { x0: 0, y1: 0.29 }; } else if (w < 900) { st.viewX = 0; st.viewY = 0.2; st.zone = { x0: 0, y1: 0.4 }; } else { st.viewX = w > 1400 ? 0.15 : 0.13; st.viewY = 0.02; st.zone = { x0: 0.5, y1: 0.84 }; }
    };
    st.onResize(st.el.clientWidth, st.el.clientHeight);
    st.applyView();

    var target = V(-2, 4, -22), camPos = V();
    st.update = function (dt, t) {
      /* camera: slow sweep across the front of the site */
      var th = 0.14 + 0.3 * Math.sin(t * 0.042);
      var r = (st.w < 900 ? 190 : 150) + 12 * Math.sin(t * 0.057 + 1);
      var h = (st.w < 900 ? 84 : 66) + 8 * Math.sin(t * 0.049);
      camPos.set(target.x + Math.sin(th) * r + pointer.sx * 8, h - pointer.sy * 5, target.z + Math.cos(th) * r);
      cam.position.copy(camPos);
      cam.lookAt(target.x + Math.sin(t * 0.03) * 6, target.y, target.z);

      /* crane */
      slew.rotation.y = -0.9 + 0.7 * Math.sin(t * 0.06);
      var tr = 30 + 14 * Math.sin(t * 0.09);
      trolley.position.set(tr, 0, 0);
      var hook = 22 + 10 * Math.sin(t * 0.08 + 1.2);
      cableGeo.attributes.position.setY(1, -hook); cableGeo.attributes.position.needsUpdate = true;
      load.position.y = -hook - 2.2;
      load.rotation.y = Math.sin(t * 0.3) * 0.3;
      red.opacity = (Math.sin(t * 3) > 0.2) ? 1 : 0.15;

      /* excavator dig cycle */
      var ph = t * 0.55;
      ex.upper.rotation.y = 0.35 * Math.sin(ph * 0.5);
      ex.boom.rotation.z = -0.35 - 0.28 * Math.sin(ph);
      ex.stick.rotation.z = 1.25 + 0.45 * Math.sin(ph + 1.1);

      /* traffic */
      trucks.forEach(function (tk) {
        tk.x += tk.v * dt;
        if (tk.x > 360) tk.x = -360; if (tk.x < -360) tk.x = 360;
        tk.g.position.set(tk.x, 0.12, tk.z);
      });

      /* survey beam pulse */
      var k = (t * 0.45) % 1;
      pulse.position.lerpVectors(beamA, beamB, k);

      /* scan ring */
      var rk = (t % 7) / 7;
      ring.scale.setScalar(4 + rk * 170);
      ringMat.opacity = Math.pow(1 - rk, 2) * 0.55;

      if (parts) {
        for (var i = 0; i < PN; i++) { var yi = i * 3 + 1; pArr[yi] += dt * (0.8 + (i % 5) * 0.25); if (pArr[yi] > 70) pArr[yi] = 0; }
        parts.geometry.attributes.position.needsUpdate = true;
      }

      /* focus cycling */
      ft += dt;
      if (fi < 0 || ft > 3.4) { ft = 0; focus((fi + 1) % order.length); }
      var hot = groupOf[order[fi]];
      for (var g in E) {
        var goal = g === hot ? 1 : E[g].userData.base;
        E[g].opacity += (goal - E[g].opacity) * Math.min(1, dt * 3);
      }

      /* HUD */
      hudT += dt;
      if (hudT > 0.2) {
        hudT = 0;
        var az = Math.atan2(cam.position.x - target.x, cam.position.z - target.z) * 180 / Math.PI;
        if (hudAz) hudAz.style.setProperty('--az', (-az).toFixed(1) + 'deg');
        if (hudX) hudX.textContent = cam.position.x.toFixed(2);
        if (hudY) hudY.textContent = cam.position.y.toFixed(2);
        if (hudZ) hudZ.textContent = cam.position.z.toFixed(2);
      }
    };
  }

  /* =================================================================
     Blueprint → building model (shared by story + cta)
     ================================================================= */
  function buildingModel(S, lite) {
    var FH = 3.5, NF = 5;
    var model = { plan: 0, dims: 0, rise: 0, solid: 0, glow: 0, fade: 0 };

    var sheetMat = basic(0xe9f1fc, 0.96, { depthWrite: false });
    var sheet = new T.Mesh(new T.PlaneGeometry(74, 48), sheetMat);
    sheet.rotation.x = -Math.PI / 2; sheet.position.y = -0.02; S.add(sheet);
    var gA = [];
    for (var x = -36; x <= 36; x += 2) gA.push(x, 0, -23, x, 0, 23);
    for (var z = -22; z <= 22; z += 2) gA.push(-36, 0, z, 36, 0, z);
    var sheetGridMat = lineMat(0x1d5fe0, 0.16);
    S.add(new T.LineSegments(segGeo(gA), sheetGridMat));

    /* plan drawing (ordered for a draw-on effect) */
    var P = [];
    function s(ax, az, bx, bz) { P.push(ax, 0.04, az, bx, 0.04, bz); }
    function rect(x0, z0, x1, z1) { s(x0, z0, x1, z0); s(x1, z0, x1, z1); s(x1, z1, x0, z1); s(x0, z1, x0, z0); }
    function arc(cx, cz, r, a0, a1, n) { for (var i = 0; i < n; i++) { var u = a0 + (a1 - a0) * i / n, v = a0 + (a1 - a0) * (i + 1) / n; s(cx + Math.cos(u) * r, cz + Math.sin(u) * r, cx + Math.cos(v) * r, cz + Math.sin(v) * r); } }
    rect(-36, -23, 36, 23); rect(-35, -22, 35, 22);
    rect(20, 14, 35, 22); s(20, 17, 35, 17); s(20, 19.5, 35, 19.5); s(27, 14, 27, 17); s(31, 17, 31, 22);
    [-16, -8, 0, 8, 16].forEach(function (gx) { s(gx, -13, gx, 13); arc(gx, -14.3, 1.3, 0, Math.PI * 2, 14); });
    [-9, 0, 9].forEach(function (gz) { s(-20.5, gz, 20.5, gz); arc(-21.8, gz, 1.3, 0, Math.PI * 2, 14); });
    rect(-16.15, -9.15, 16.15, 9.15); rect(-15.85, -8.85, 15.85, 8.85);
    [-16, -8, 0, 8, 16].forEach(function (gx) { [-9, 0, 9].forEach(function (gz) { rect(gx - 0.3, gz - 0.3, gx + 0.3, gz + 0.3); }); });
    s(-15.85, -1.6, -2, -1.6); s(0, -1.6, 15.85, -1.6); s(-15.85, 1.6, -9, 1.6); s(-7, 1.6, 6, 1.6); s(8, 1.6, 15.85, 1.6);
    [-8, 0, 8].forEach(function (px) { s(px, 1.6, px, 8.85); });
    [-4, 6].forEach(function (px) { s(px, -8.85, px, -1.6); });
    rect(10, -8.85, 15.85, -3);
    for (var tz = -8.4; tz < -3.3; tz += 0.6) s(10, tz, 12.9, tz);
    s(12.9, -8.85, 12.9, -3);
    arc(-9, 1.6, 2, 0, Math.PI / 2, 8); s(-9, 1.6, -9, 3.6);
    arc(6, 1.6, 2, Math.PI / 2, Math.PI, 8); s(6, 1.6, 6, 3.6);
    arc(-2, -1.6, 2, -Math.PI / 2, 0, 8); s(-2, -1.6, -2, -3.6);
    s(-16, -11.5, 16, -11.5); s(-16, -12.2, -16, -10.8); s(16, -12.2, 16, -10.8);
    [-8, 0, 8].forEach(function (gx) { s(gx - 0.35, -11.15, gx + 0.35, -11.85); });
    s(-16.35, -11.85, -15.65, -11.15); s(15.65, -11.85, 16.35, -11.15);
    s(-19, -9, -19, 9); s(-19.7, -9, -18.3, -9); s(-19.7, 9, -18.3, 9);
    var planGeo = segGeo(P), planCount = P.length / 3;
    var planMat = lineMat(0x1d5fe0, 0.9);
    S.add(new T.LineSegments(planGeo, planMat));

    /* floors */
    var fm = {
      concrete: mat(0xdfe6ef, { transparent: true }),
      panel: mat(0xc3cfdf, { transparent: true }),
      glass: mat(0x6fa3ea, { transparent: true, opacity: 0.5, emissive: 0x2a6fd6, ei: 0.1, rough: 0.12, metal: 0.2 })
    };
    var floorEdge = lineMat(0x1d5fe0, 0.85);
    var floors = [];
    for (var i = 0; i < NF; i++) {
      var k = new Kit(), top = i === NF - 1;
      var xs = top ? [-16, -8, 0, 8] : [-16, -8, 0, 8, 16], x1 = top ? 8 : 16;
      var w = x1 + 16 + 0.6, cx = (x1 - 16) / 2;
      if (i === 0) k.box('concrete', 34, 0.3, 20, 0, 0, 0);
      xs.forEach(function (gx) { [-9, 0, 9].forEach(function (gz) { k.box('concrete', 0.5, FH - 0.3, 0.5, gx, 0, gz); }); });
      k.box('concrete', w, 0.3, 18.6, cx, FH - 0.3, 0);
      k.box('panel', w, 0.55, 0.2, cx, FH - 0.7, 9.35, 0, false); k.box('panel', w, 0.55, 0.2, cx, FH - 0.7, -9.35, 0, false);
      k.box('panel', 0.2, 0.55, 18.6, -16.35, FH - 0.7, 0, 0, false); k.box('panel', 0.2, 0.55, 18.6, x1 + 0.35, FH - 0.7, 0, 0, false);
      for (var j = 0; j < xs.length - 1; j++) {
        var mx = (xs[j] + xs[j + 1]) / 2;
        k.box('glass', 7.4, FH - 0.95, 0.12, mx, 0.2, 9.2); k.box('glass', 7.4, FH - 0.95, 0.12, mx, 0.2, -9.2);
      }
      [-4.5, 4.5].forEach(function (gz) {
        k.box('glass', 0.12, FH - 0.95, 8.4, -16.2, 0.2, gz);
        k.box('glass', 0.12, FH - 0.95, 8.4, x1 + 0.2, 0.2, gz);
      });
      if (top) {
        k.box('panel', w, 0.9, 0.25, cx, FH, 9.2); k.box('panel', w, 0.9, 0.25, cx, FH, -9.2);
        k.box('panel', 0.25, 0.9, 18.6, -16.2, FH, 0); k.box('panel', 0.25, 0.9, 18.6, x1 + 0.2, FH, 0);
        k.box('panel', 6, 2.2, 4, -8, FH, -3);
      }
      var g = k.build(fm, floorEdge);
      g.position.y = i * FH;
      g.visible = false;
      S.add(g); floors.push(g);
    }

    /* dimension lines */
    var D = [];
    dimSegs(D, V(-16, 0.06, 12.5), V(16, 0.06, 12.5), 'x', [[-16, 0.06, 9.6, -16, 0.06, 13.4], [16, 0.06, 9.6, 16, 0.06, 13.4]]);
    dimSegs(D, V(19.5, 0.06, -9), V(19.5, 0.06, 9), 'z', [[16.6, 0.06, -9, 20.4, 0.06, -9], [16.6, 0.06, 9, 20.4, 0.06, 9]]);
    dimSegs(D, V(18, 0, 11.5), V(18, NF * FH, 11.5), 'y', [[16.5, NF * FH, 9.4, 18.8, NF * FH, 11.5]]);
    dimSegs(D, V(-18.5, FH, 9.5), V(-18.5, 2 * FH, 9.5), 'y', [[-16.5, FH, 9.5, -19.3, FH, 9.5], [-16.5, 2 * FH, 9.5, -19.3, 2 * FH, 9.5]]);
    var dimGeo = segGeo(D), dimCount = D.length / 3;
    var dimMat = lineMat(0x1548b5, 1);
    S.add(new T.LineSegments(dimGeo, dimMat));

    var ringMat = basic(0x1d5fe0, 0, { depthWrite: false, side: T.DoubleSide });
    var ring = new T.Mesh(new T.RingGeometry(0.97, 1, 96), ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1; S.add(ring);

    model.apply = function (t) {
      var vis = 1 - model.fade;
      planGeo.setDrawRange(0, Math.floor(planCount * model.plan / 2) * 2);
      planMat.opacity = (0.95 - model.solid * 0.35) * vis;
      sheetMat.opacity = 0.92 * vis * (lite ? 0.55 : 1);
      sheetGridMat.opacity = 0.18 * vis;
      dimGeo.setDrawRange(0, Math.floor(dimCount * model.dims / 2) * 2);
      dimMat.opacity = vis;
      floors.forEach(function (g, i) {
        var f = smooth(i * 0.16, i * 0.16 + 0.36, model.rise);
        g.visible = f > 0.002 && vis > 0.01;
        g.scale.y = Math.max(0.002, easeOut(f));
      });
      fm.concrete.opacity = lerp(0.05, 1, model.solid) * vis;
      fm.panel.opacity = lerp(0.05, 1, model.solid) * vis;
      fm.glass.opacity = lerp(0.03, 0.55, model.solid) * vis;
      fm.concrete.depthWrite = fm.panel.depthWrite = model.solid > 0.6;
      fm.glass.emissiveIntensity = lerp(0.1, 0.55, model.glow) + (model.glow > 0.99 ? Math.sin(t * 2) * 0.05 : 0);
      floorEdge.opacity = lerp(1, 0.62, model.solid) * vis;
      var rk = model.glow > 0 ? ((t * 0.25) % 1) : 0;
      ring.scale.setScalar(2 + rk * 60);
      ringMat.opacity = model.glow * Math.pow(1 - rk, 2) * 0.45 * vis;
    };
    model.anchors = {
      excavation: V(-16, 0.3, 9.4), concrete: V(-10, 2 * FH, 9.4), rebar: V(16, 2.4 * FH, 9.2),
      formwork: V(4, FH, 9.4), blockwork: V(-16.3, 3.4 * FH, -3), glazing: V(4, 4.6 * FH, 9.3)
    };
    model.dimLabels = [['32.00 m', V(0, 0.06, 12.5)], ['18.00 m', V(19.5, 0.06, 0)], ['17.50 m', V(18, NF * FH / 2, 11.5)], ['3.50 m', V(-18.5, 1.5 * FH, 9.5)]];
    model.planLabels = [['A-101 · GROUND FLOOR PLAN', V(27.5, 0.05, 18.3)]];
    return model;
  }

  function lights(S, a, b) {
    S.add(new T.HemisphereLight(0xffffff, 0xc9d4e3, a || 1.45));
    var k = new T.DirectionalLight(0xfff8ee, b || 1.75); k.position.set(-60, 110, 80); S.add(k);
    var r = new T.DirectionalLight(0xbcd4ff, 0.7); r.position.set(90, 40, -110); S.add(r);
  }

  /* =================================================================
     STORY — scroll-driven estimating journey
     ================================================================= */
  function sceneStory(st) {
    var S = st.scene, cam = st.camera;
    cam.fov = 34; cam.near = 1; cam.far = 600;
    S.fog = new T.FogExp2(0xf5f8fc, 0.0042);
    lights(S);
    var model = buildingModel(S, false);
    var root = st.el.closest('[data-story]') || document;

    Array.prototype.forEach.call(root.querySelectorAll('.story__tags .tag[data-anchor]'), function (el) {
      var a = model.anchors[el.getAttribute('data-anchor')];
      if (a) st.addLabel(el, a);
    });
    function makeLabels(sel, list) {
      var host = root.querySelector(sel);
      if (!host) return;
      list.forEach(function (d) {
        var el = document.createElement('span'); el.className = 'dim'; el.textContent = d[0];
        host.appendChild(el); st.addLabel(el, d[1]);
      });
    }
    makeLabels('.story__dims', model.dimLabels);
    makeLabels('.story__plan', model.planLabels);

    var KF = [
      { p: V(0, 96, 0.6), t: V(0, 0, 0), vx: 0.13 },
      { p: V(0, 80, 44), t: V(0, 0, 0), vx: 0.13 },
      { p: V(58, 48, 76), t: V(0, 6, 0), vx: 0.13 },
      { p: V(72, 36, 58), t: V(0, 7, 0), vx: 0.12 },
      { p: V(44, 32, 82), t: V(0, 7, 0), vx: 0.12 },
      { p: V(10, 38, 92), t: V(0, 7, 0), vx: -0.03 },
      { p: V(-34, 38, 84), t: V(0, 7, 0), vx: -0.03 },
      { p: V(-58, 46, 68), t: V(0, 8, 0), vx: -0.03 }
    ];
    var narrow = false;
    st.onResize = function (w) { narrow = w < 900; };
    st.onResize(st.el.clientWidth);
    var goal = 0, cur = 0, tp = V(), tt = V();
    st.setProgress = function (p) { goal = p; };
    st.update = function (dt, t) {
      cur += (goal - cur) * Math.min(1, dt * 4.5);
      if (Math.abs(goal - cur) < 1e-4) cur = goal;
      var pos = cur * 7;
      model.plan = clamp(pos / 0.8, 0, 1);
      model.rise = clamp((pos - 1) / 0.85, 0, 1);
      model.solid = smooth(1.35, 2.0, pos);
      model.dims = clamp((pos - 2) / 0.7, 0, 1) * (1 - smooth(4.2, 4.6, pos));
      model.glow = smooth(5.9, 6.7, pos);
      model.apply(t);
      var i = Math.min(KF.length - 2, Math.floor(pos));
      var f = smooth(0.08, 0.92, pos - i);
      var A = KF[i], B = KF[i + 1];
      tp.lerpVectors(A.p, B.p, f); tt.lerpVectors(A.t, B.t, f);
      var wob = pos > 0.9 ? 1 : 0;
      tp.x += Math.sin(t * 0.25) * 1.5 * wob + pointer.sx * 2.5 * wob;
      tp.y -= pointer.sy * 1.5 * wob;
      if (narrow) tp.multiplyScalar(1.28);
      cam.position.copy(tp);
      cam.lookAt(tt);
      var vx = narrow ? 0 : lerp(A.vx, B.vx, f), vy = narrow ? 0.04 : 0;
      if (Math.abs(vx - st.viewX) > 1e-4 || vy !== st.viewY) { st.viewX = vx; st.viewY = vy; st.applyView(); }
    };
  }

  /* =================================================================
     CTA — looping blueprint → building
     ================================================================= */
  function sceneCTA(st) {
    var S = st.scene, cam = st.camera;
    cam.fov = 34; cam.near = 1; cam.far = 600;
    S.fog = new T.FogExp2(0xf1f6fd, 0.0045);
    lights(S, 1.4, 1.7);
    var model = buildingModel(S, true);
    var root = st.el.closest('section') || document;
    var phases = Array.prototype.slice.call(root.querySelectorAll('.phase [data-phase]'));
    var last = -1, LOOP = 15;
    st.update = function (dt, t) {
      var x = t % LOOP;
      model.plan = smooth(0, 2.4, x);
      model.dims = smooth(2.4, 4.4, x);
      model.rise = clamp((x - 4.4) / 2.2, 0, 1);
      model.solid = smooth(6.4, 8.4, x);
      model.glow = smooth(8.6, 10.6, x);
      model.fade = smooth(13.8, 15, x);
      model.apply(t);
      var ph = x < 2.4 ? 0 : x < 4.4 ? 1 : x < 6.4 ? 2 : x < 8.4 ? 3 : x < 10.6 ? 4 : 5;
      if (ph !== last) { last = ph; phases.forEach(function (el, i) { el.classList.toggle('is-on', i === ph); }); }
      var a = t * 0.06 + 0.7;
      cam.position.set(Math.sin(a) * 94 + pointer.sx * 4, 40 - pointer.sy * 2, Math.cos(a) * 94);
      cam.lookAt(0, 6, 0);
    };
  }

  /* =================================================================
     CIVIL — road / earthworks cut-away
     ================================================================= */
  function sceneCivil(st) {
    var S = st.scene, cam = st.camera;
    cam.fov = 32; cam.near = 1; cam.far = 500;
    S.fog = new T.Fog(0xeef3fa, 150, 300);
    lights(S, 1.5, 1.9);
    var root = st.el.closest('[data-civil]') || document;

    function OG(x) { return 1.8 - 0.22 * x + 0.35 * Math.sin(x * 0.35); }
    function F(x) { return x < -10 ? Math.min(OG(x), 1 + (-10 - x) / 1.5) : x > 10 ? Math.max(OG(x), 1 - (x - 10) / 2) : 1; }
    var X = [];
    for (var xx = -30; xx <= 30.001; xx += 0.5) X.push(Math.round(xx * 100) / 100);
    function bands(lower, upper) {
      var shapes = [], run = [];
      function flush() {
        if (run.length > 1) {
          var sh = new T.Shape();
          sh.moveTo(run[0], lower(run[0]));
          run.forEach(function (x) { sh.lineTo(x, upper(x)); });
          for (var i = run.length - 1; i >= 0; i--) sh.lineTo(run[i], lower(run[i]));
          shapes.push(sh);
        }
        run = [];
      }
      X.forEach(function (x) { if (upper(x) - lower(x) > 0.02) run.push(x); else flush(); });
      flush();
      return shapes;
    }
    var m = {
      rock: mat(0x9aa2ad), clay: mat(0xc2a27f), top: mat(0x93b170), fill: mat(0xd8c9a6),
      ghost: mat(0x1d5fe0, { transparent: true, opacity: 0.14, depthWrite: false, side: T.DoubleSide, emissive: 0x1d5fe0, ei: 0.15 }),
      sub: mat(0xb9a07f), sb: mat(0xc4c3bd), base: mat(0xa9afb8), asph: mat(0x505865, { rough: 0.9 }),
      concrete: mat(0xe3e8ee), concreteD: mat(0xe3e8ee), dark: mat(0x5b6675), machine: mat(0xe8a91f, { rough: 0.55, metal: 0.2 }), machine2: mat(0xe8a91f, { rough: 0.55, metal: 0.2 }),
      agg: mat(0xb3afa6, { flat: true }), steel: mat(0x9aa9bd, { metal: 0.3, rough: 0.5 }), lit: basic(0x5d9cf0, 0.6), white: mat(0xffffff), plinth: mat(0xf4f7fb)
    };
    var feats = {};
    ['earthwork', 'excavation', 'concrete', 'drainage', 'roads', 'utilities', 'materials', 'labour', 'terrain'].forEach(function (k) {
      feats[k] = { edge: lineMat(0x1d5fe0, k === 'terrain' ? 0.28 : 0.42), mats: [] };
      feats[k].edge.userData.base = feats[k].edge.opacity;
    });
    function ext(shape, depth, z0) { var g = new T.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: false, curveSegments: 1 }); g.translate(0, 0, z0); return g; }

    var TR = new Kit();
    bands(function () { return -10; }, function () { return -7; }).forEach(function (s) { TR.add(ext(s, 36, -18), 'rock', null, true, 30); });
    bands(function () { return -7; }, function (x) { return Math.min(F(x), OG(x) - 0.7); }).forEach(function (s) { TR.add(ext(s, 36, -18), 'clay', null, true, 30); });
    bands(function (x) { return OG(x) - 0.7; }, function (x) { return Math.min(F(x), OG(x)); }).forEach(function (s) { TR.add(ext(s, 36, -18), 'top', null, true, 30); });
    S.add(TR.build(m, feats.terrain.edge));
    var EW = new Kit();
    bands(function (x) { return OG(x); }, function (x) { return F(x); }).forEach(function (s) { EW.add(ext(s, 36, -18), 'fill', null, true, 30); });
    bands(function (x) { return F(x); }, function (x) { return OG(x); }).forEach(function (s) { EW.add(ext(s, 36, -18), 'ghost', null, true, 30); });
    S.add(EW.build(m, feats.earthwork.edge));
    feats.earthwork.mats.push(m.ghost, m.fill);
    var og = [];
    for (var i = 0; i < X.length - 1; i += 1) if (i % 2 === 0) og.push(X[i], OG(X[i]), 18.05, X[i + 1], OG(X[i + 1]), 18.05);
    S.add(new T.LineSegments(segGeo(og), lineMat(0x1548b5, 0.95)));

    /* pavement layers, stepped at the section face */
    var RD = new Kit();
    var y0 = 1.0;
    [['sub', 0.3, 18], ['sb', 0.25, 16], ['base', 0.2, 14], ['asph', 0.12, 11.5]].forEach(function (L) {
      var len = L[2] + 18;
      RD.box(L[0], 20, L[1], len, 0, y0, -18 + len / 2);
      y0 += L[1];
    });
    for (var dz = -18; dz < 11; dz += 3) RD.seg(0, y0 + 0.02, dz, 0, y0 + 0.02, dz + 1.6);
    RD.seg(-9.3, y0 + 0.02, -18, -9.3, y0 + 0.02, 11.5); RD.seg(9.3, y0 + 0.02, -18, 9.3, y0 + 0.02, 11.5);
    S.add(RD.build(m, feats.roads.edge));
    feats.roads.mats.push(m.asph, m.base, m.sb, m.sub);
    var roadTop = y0;

    /* concrete: retaining wall + kerbs */
    var CO = new Kit();
    CO.box('concrete', 2.6, 0.5, 36, -10.9, 0.3, 0);
    CO.box('concrete', 0.45, 3.3, 36, -10.45, 0.8, 0);
    CO.box('concrete', 0.3, 0.45, 29.5, 9.9, roadTop - 0.1, -3.25);
    S.add(CO.build(m, feats.concrete.edge));
    feats.concrete.mats.push(m.concrete);

    /* drainage: culvert, pipe, pit (with x-ray duplicates) */
    var DR = new Kit(), cz = -9;
    DR.box('concreteD', 17.5, 0.3, 3.4, 6.75, -0.9, cz);
    DR.box('concreteD', 17.5, 0.3, 3.4, 6.75, -3.2, cz);
    DR.box('concreteD', 17.5, 2.3, 0.3, 6.75, -2.9, cz - 1.55);
    DR.box('concreteD', 17.5, 2.3, 0.3, 6.75, -2.9, cz + 1.55);
    DR.box('concreteD', 0.4, 3.6, 5.6, 15.7, -3.2, cz);
    DR.box('concreteD', 3, 2.4, 0.35, 17, -3.2, cz - 3.1, -0.5);
    DR.box('concreteD', 3, 2.4, 0.35, 17, -3.2, cz + 3.1, 0.5);
    DR.add(new T.CylinderGeometry(0.75, 0.75, 1.8, 16), 'concreteD', M(11, F(11) - 0.9, 3), true, 40);
    DR.box('dark', 1.1, 0.06, 1.1, 11, F(11) + 0.02, 3, 0, true);
    S.add(DR.build(m, feats.drainage.edge));
    var xray = basic(0x1d5fe0, 0.45, { depthTest: false, depthWrite: false });
    var xr = new T.Mesh(new T.CylinderGeometry(0.45, 0.45, 36.6, 16, 1, true), xray);
    xr.rotation.x = Math.PI / 2; xr.position.set(11, -0.35, 0.3); xr.renderOrder = 5; S.add(xr);
    var xc = new T.Mesh(new T.BoxGeometry(17.5, 2.6, 3.4), basic(0x1d5fe0, 0.12, { depthTest: false, depthWrite: false }));
    xc.position.set(6.75, -1.9, cz); xc.renderOrder = 5; S.add(xc);
    feats.drainage.mats.push(m.concreteD);
    feats.drainage.xray = [xray, xc.material];

    /* utilities (x-ray conduits) */
    var utilMats = [];
    [[-8.9, 0x1d5fe0], [-8.3, 0x7c4dff], [-7.7, 0x0ea5e9]].forEach(function (u) {
      var um = basic(u[1], 0.7, { depthTest: false, depthWrite: false });
      var c = new T.Mesh(new T.CylinderGeometry(0.17, 0.17, 36.5, 10, 1, true), um);
      c.rotation.x = Math.PI / 2; c.position.set(u[0], 0.45, 0.25); c.renderOrder = 6; S.add(c);
      utilMats.push(um);
    });
    feats.utilities.xray = utilMats;

    /* excavation — excavator on the cut */
    var ex = excavator(m, feats.excavation.edge, 0.8);
    ex.root.position.set(-22, F(-22), -7); ex.root.rotation.y = Math.PI; S.add(ex.root);
    feats.excavation.mats.push(m.machine);

    /* materials — aggregate stockpile + pipe stack */
    var MA = new Kit();
    MA.add(new T.ConeGeometry(3.4, 2.5, 8, 1), 'agg', M(-25, F(-25) + 1.2, 6), true, 20);
    MA.add(new T.ConeGeometry(2.4, 1.8, 7, 1), 'agg', M(-26.5, F(-26.5) + 0.85, 10.5), true, 20);
    [[0, 0], [0.95, 0], [0.47, 0.82]].forEach(function (p) {
      MA.add(new T.CylinderGeometry(0.45, 0.45, 3.2, 14, 1, true), 'steel', M(21 + p[0], F(21.5) + 0.45 + p[1], 9, Math.PI / 2, 0, 0), true, 40);
    });
    S.add(MA.build(m, feats.materials.edge));
    feats.materials.mats.push(m.agg);

    /* labour — roller on the base course */
    var LB = new Kit(), ry = roadTop - 0.12;
    LB.add(new T.CylinderGeometry(0.75, 0.75, 2.1, 18), 'dark', M(-3, ry + 0.75, 12.6, 0, 0, Math.PI / 2), true, 40);
    LB.box('machine2', 1.9, 1.1, 2.6, -3, ry + 0.5, 14.6);
    LB.box('machine2', 1.5, 0.9, 1.2, -3, ry + 1.6, 14.9);
    LB.box('lit', 1.3, 0.5, 0.05, -3, ry + 1.8, 14.28, 0, false);
    S.add(LB.build(m, feats.labour.edge));
    feats.labour.mats.push(m.machine2);

    /* base plinth + table grid */
    var PL = new Kit();
    PL.box('plinth', 63, 0.8, 39, 0, -10.8, 0);
    S.add(PL.build(m, lineMat(0x1d5fe0, 0.45)));
    var tg = [];
    for (var v = -60; v <= 60; v += 5) { tg.push(v, -10.82, -45, v, -10.82, 45); if (Math.abs(v) <= 45) tg.push(-60, -10.82, v, 60, -10.82, v); }
    S.add(new T.LineSegments(segGeo(tg), lineMat(0x1d5fe0, 0.12)));

    /* pins */
    var anchors = {
      earthwork: V(-13, 3.2, 18), excavation: V(-24, F(-22) + 5.5, -7), concrete: V(-10.45, 4.3, 12),
      drainage: V(11, -0.35, 18.6), roads: V(3, roadTop + 0.1, 4), utilities: V(-8.3, 0.45, 18.4),
      materials: V(-25, F(-25) + 2.6, 6), labour: V(-3, ry + 2.6, 14.6)
    };
    Array.prototype.forEach.call(root.querySelectorAll('.pin[data-anchor]'), function (el) {
      var a = anchors[el.getAttribute('data-anchor')];
      if (a) st.addLabel(el, a);
    });

    var hot = null;
    st.highlight = function (k) { hot = k; };
    Object.keys(feats).forEach(function (k) { feats[k].mats.forEach(function (mm) { if (mm.emissive && mm !== m.ghost) mm.userData.e0 = mm.emissiveIntensity || 0; }); });

    var target = V(-3, -1.5, 1);
    st.update = function (dt, t) {
      var th = 0.5 + 0.42 * Math.sin(t * 0.07);
      var r = 110, h = 44 + 4 * Math.sin(t * 0.05);
      cam.position.set(target.x + Math.sin(th) * r + pointer.sx * 3, h - pointer.sy * 2, target.z + Math.cos(th) * r);
      cam.lookAt(target);
      ex.boom.rotation.z = -0.3 - 0.25 * Math.sin(t * 0.6);
      ex.stick.rotation.z = 1.2 + 0.4 * Math.sin(t * 0.6 + 1.1);
      ex.upper.rotation.y = 0.3 * Math.sin(t * 0.3);
      var k2 = Math.min(1, dt * 5);
      Object.keys(feats).forEach(function (k) {
        var f = feats[k], on = hot === k, dim = hot && !on;
        var goal = on ? 1 : dim ? f.edge.userData.base * 0.45 : f.edge.userData.base;
        f.edge.opacity += (goal - f.edge.opacity) * k2;
        f.mats.forEach(function (mm) {
          if (!mm.emissive) return;
          if (!mm.userData.hl) { mm.userData.hl = true; mm.emissive = mm.emissive || new T.Color(); }
          var ge = on ? 0.35 : (mm.userData.e0 || 0);
          if (mm !== m.ghost) { mm.emissive.setHex(on ? 0x1d5fe0 : 0x000000); mm.emissiveIntensity += (ge - mm.emissiveIntensity) * k2; }
          else mm.opacity += ((on ? 0.3 : 0.14) - mm.opacity) * k2;
        });
        if (f.xray) f.xray.forEach(function (xm, i) { var base = k === 'drainage' ? (i ? 0.12 : 0.45) : 0.7; xm.opacity += ((on ? Math.min(1, base * 1.8) : dim ? base * 0.5 : base) - xm.opacity) * k2; });
      });
    };
  }

  /* =================================================================
     mount
     ================================================================= */
  var builders = { hero: [sceneHero, { exposure: 1.32, t0: 6 }], story: [sceneStory, { exposure: 1.1 }], civil: [sceneCivil, { exposure: 1.1, t0: 3 }], cta: [sceneCTA, { exposure: 1.0, t0: 9.5 }] };

  window.VEScenes = {
    mount: function (el) {
      var b = builders[el.getAttribute('data-scene')];
      if (!b) return null;
      var st;
      try {
        st = new Stage(el, b[1]);
        b[0](st);
      } catch (err) {
        if (st && st.renderer) { st.renderer.dispose(); if (st.renderer.domElement.parentNode) st.renderer.domElement.parentNode.removeChild(st.renderer.domElement); }
        if (window.console) console.warn('3D scene failed, using fallback.', err);
        return null;
      }
      stages.push(st);
      return {
        setActive: function (on) { st.setActive(on); },
        setProgress: function (p) { if (st.setProgress) st.setProgress(p); },
        highlight: function (k) { if (st.highlight) st.highlight(k); },
        renderAt: function (t, p) {
          st.resize(true);
          if (p != null && st.setProgress) { st.setProgress(p); for (var i = 0; i < 60; i++) st.update(0.05, t); }
          st.time = t; st.frame(0);
        }
      };
    }
  };
})();
