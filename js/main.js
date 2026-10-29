/* ============================================================
   SEPELA — scroll engine + interactions
   3D can: three.js scene ported from the SEPELA Next.js site
   (RoomEnvironment reflections, MeshPhysicalMaterial clearcoat
   label, lathe silver top + dark base, faceU brand framing)
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- utils ---------------- */
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var easeInOut = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var root = document.documentElement;
  var body = document.body;

  /* ---------------- flavour data (from data/products.js) ---------------- */
  var FLAVORS = [
    {
      label: 'assets/tex/label-pinkgin.jpg',
      can: 'assets/can-pinkgin.webp',
      faceU: 0.499,
      short: 'Pink Gin',
      name: 'Pink Gin & Tonic',
      abv: '7% Vol.',
      price: 'Rs 450',
      rgb: [233, 101, 133],          /* rose */
      blurb: 'Crisp gin, a blush of pink and a clean tonic finish. Cold, light and easy to finish.'
    },
    {
      label: 'assets/tex/label-rum.jpg',
      can: 'assets/can-rum.webp',
      faceU: 0.506,
      short: 'Rum & Ginger',
      name: 'Rum & Ginger and Lime',
      abv: '7% Vol.',
      price: 'Rs 450',
      rgb: [183, 205, 105],          /* lime */
      blurb: 'Smooth rum with a spicy ginger bite and fresh lime. Bright, warm and sharp.'
    },
    {
      label: 'assets/tex/label-whisky.jpg',
      can: 'assets/can-whisky.webp',
      faceU: 0.509,
      short: 'Whisky & Cola',
      name: 'Whisky & Cola',
      abv: '7% Vol.',
      price: 'Rs 450',
      rgb: [216, 168, 106],          /* gold */
      blurb: 'A classic pour: mellow whisky over cola, ready to drink straight from the can.'
    }
  ];
  var HERO_FLAVOR = 2;

  /* ---------------- DOM ---------------- */
  var stage = $('#stage');
  var loadBar = $('#loadBar');
  var loadPct = $('#loadPct');
  var header = $('#header');
  var heroEl = $('#hero');
  var heroInner = $('.hero__inner');
  var heroText = $('.hero__text');
  var heroSecond = $('.hero__second');
  var diveEl = $('#dive');
  var diveWord = $('#diveWord');
  var diveChips = $$('#diveChips span');
  var rail = $('#rail');
  var parEls = $$('[data-par]');
  parEls.forEach(function (pe) { pe._tx = 0; pe._ty = 0; pe._cx = 0; pe._cy = 0; });

  /* ---------------- split text ---------------- */
  $$('.split').forEach(function (el) {
    var words = (el.textContent || '').trim().split(/\s+/);
    el.textContent = '';
    words.forEach(function (w, i) {
      var span = document.createElement('span');
      span.className = 'w';
      span.style.setProperty('--wi', i);
      var inner = document.createElement('i');
      inner.textContent = w;
      span.appendChild(inner);
      el.appendChild(span);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  });

  /* ---------------- reveals (started after preloader) ---------------- */
  function startReveals() {
    if (!('IntersectionObserver' in window)) {
      $$('.reveal, .split').forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    $$('.reveal, .split').forEach(function (el) { io.observe(el); });
  }

  /* ============================================================
     3D CAN — three.js (ported from components/CanScene.js)
     ============================================================ */
  var FOV = 35, CAMZ = 9, BODY = 2.3, CAN_H = 2.59;  /* body + top .17 + bottom .12 */
  var RAD = Math.PI / 180;
  var built = false;
  var gl = {
    ok: false, renderer: null, scene: null, camera: null,
    root: null, spin: null, labels: [], sides: [],
    worldH: 5.685, worldW: 9, perS: 1.32
  };
  var glowEl = null, shadowEl = null, fallbackImg = null;

  function el(tag, cls) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    return d;
  }

  function lathe(pts, mat) {
    return new THREE.Mesh(
      new THREE.LatheGeometry(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 64),
      mat);
  }

  function loadTex(url, faceU) {
    /* data: URL pehle (file:// WebGL-safe); warna preloaded plain Image.
       (TextureLoader crossOrigin lagata hai jo file:// pe fail hota hai) */
    return new Promise(function (res) {
      var make = function (im) {
        if (!im || !im.naturalWidth) { res(null); return; }
        var t = new THREE.Texture(im);
        if ('colorSpace' in t && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
        else t.encoding = THREE.sRGBEncoding;
        t.wrapS = THREE.RepeatWrapping;
        t.offset.x = faceU;                 /* brand ko front par laata hai */
        t.anisotropy = gl.renderer.capabilities.getMaxAnisotropy();
        t.needsUpdate = true;
        res(t);
      };
      var dataUrl = window.SEPELA_TEX && window.SEPELA_TEX[url];
      if (dataUrl) {
        var imD = new Image();
        imD.onload = function () { make(imD); };
        imD.onerror = function () { res(null); };
        imD.src = dataUrl;
        return;
      }
      var img = loadedImgs[url];
      if (img && img.complete) { make(img); return; }
      var im2 = new Image();
      im2.onload = function () { make(im2); };
      im2.onerror = function () { res(null); };
      im2.src = url;
    });
  }

  function buildScene() {
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch (e) { buildFallback(); return; }
    gl.renderer = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    else renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.id = 'glcanvas';
    stage.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    if ('environmentIntensity' in scene) scene.environmentIntensity = 0.9;

    var key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 4, 5); scene.add(key);
    var rim = new THREE.DirectionalLight(0xffffff, 1.2); rim.position.set(-4, 2, -3); scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));

    var camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 0.1, 50);
    camera.position.set(0, 0, CAMZ);
    gl.scene = scene; gl.camera = camera;

    gl.root = new THREE.Group();
    gl.spin = new THREE.Group();
    gl.root.add(gl.spin);
    scene.add(gl.root);

    /* silver top + dark base — exact lathe profiles from CanScene.js */
    var silver = new THREE.MeshStandardMaterial({ color: 0xd4d7dc, metalness: 1, roughness: 0.22, side: THREE.DoubleSide });
    var dark = new THREE.MeshStandardMaterial({ color: 0x9a9da5, metalness: 1, roughness: 0.38, side: THREE.DoubleSide });
    var t = BODY / 2;
    var top = lathe(
      [[0, 0.17], [0.38, 0.17], [0.4, 0.2], [0.43, 0.2], [0.44, 0.17], [0.43, 0.12], [0.46, 0.07], [0.49, 0.025], [0.5, 0]],
      silver);
    top.position.y = t;
    var bottom = lathe(
      [[0.5, 0], [0.49, -0.03], [0.45, -0.08], [0.41, -0.11], [0.36, -0.09], [0.3, -0.12], [0, -0.12]],
      dark);
    bottom.position.y = -t;
    gl.spin.add(top, bottom);

    /* dark core so a fading label never shows a hollow can */
    var core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.486, 0.486, BODY - 0.01, 48, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x14121a, metalness: 0.2, roughness: 0.9, side: THREE.DoubleSide }));
    gl.spin.add(core);

    /* labels — slightly concentric radii so crossfades never z-fight */
    FLAVORS.forEach(function (f, i) {
      var mat = new THREE.MeshPhysicalMaterial({
        map: null,
        color: 0x222226,
        metalness: 0.35,
        roughness: 0.5,
        clearcoat: 0.45,
        clearcoatRoughness: 0.3,
        transparent: true,
        opacity: i === HERO_FLAVOR ? 1 : 0
      });
      var r = 0.5 + i * 0.0016;
      var m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, BODY, 96, 1, true), mat);
      m.visible = i === HERO_FLAVOR;
      gl.spin.add(m);
      gl.labels.push(m);
      loadTex(f.label, f.faceU).then(function (tex) {
        if (tex) { mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true; }
      });
    });

    /* hero trio — the two other flavours stand beside the main can. They are
       separate, static cans (not part of gl.spin) so all three labels can be
       on screen at once; they fade and drift away as the dive begins. */
    function makeSideCan(f, dir) {
      var silverM = new THREE.MeshStandardMaterial({ color: 0xd4d7dc, metalness: 1, roughness: 0.22, side: THREE.DoubleSide, transparent: true });
      var darkM = new THREE.MeshStandardMaterial({ color: 0x9a9da5, metalness: 1, roughness: 0.38, side: THREE.DoubleSide, transparent: true });
      var coreM = new THREE.MeshStandardMaterial({ color: 0x14121a, metalness: 0.2, roughness: 0.9, side: THREE.DoubleSide, transparent: true });
      var labelM = new THREE.MeshPhysicalMaterial({
        map: null, color: 0x222226, metalness: 0.35, roughness: 0.5,
        clearcoat: 0.45, clearcoatRoughness: 0.3, transparent: true, opacity: 1
      });

      var g = new THREE.Group();
      var sTop = lathe(
        [[0, 0.17], [0.38, 0.17], [0.4, 0.2], [0.43, 0.2], [0.44, 0.17], [0.43, 0.12], [0.46, 0.07], [0.49, 0.025], [0.5, 0]],
        silverM);
      sTop.position.y = t;
      var sBottom = lathe(
        [[0.5, 0], [0.49, -0.03], [0.45, -0.08], [0.41, -0.11], [0.36, -0.09], [0.3, -0.12], [0, -0.12]],
        darkM);
      sBottom.position.y = -t;
      g.add(sTop, sBottom);
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.486, 0.486, BODY - 0.01, 48, 1, true), coreM));

      var label = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, BODY, 96, 1, true), labelM);
      g.add(label);
      loadTex(f.label, f.faceU).then(function (tex) {
        if (tex) { labelM.map = tex; labelM.color.set(0xffffff); labelM.needsUpdate = true; }
      });

      g.position.set(dir * 0.80, -0.04, -0.35);
      g.rotation.y = -dir * 12 * RAD;
      g.rotation.z = dir * 2.2 * RAD;
      g.scale.setScalar(0.92);
      gl.root.add(g);
      gl.sides.push({ g: g, mats: [silverM, darkM, coreM, labelM], dir: dir });
    }
    makeSideCan(FLAVORS[0], -1);
    makeSideCan(FLAVORS[1], 1);

    glResize();
    gl.ok = true;
  }

  function glResize() {
    if (!gl.renderer) return;
    var w = window.innerWidth, h = window.innerHeight;
    gl.renderer.setSize(w, h, false);
    gl.renderer.domElement.style.width = '100%';
    gl.renderer.domElement.style.height = '100%';
    gl.camera.aspect = w / h;
    gl.camera.updateProjectionMatrix();
    gl.worldH = 2 * Math.tan((FOV * RAD) / 2) * CAMZ;
    gl.worldW = gl.worldH * (w / h);
    /* engine ka scale s = 1  =>  can ~60% of viewport height */
    gl.perS = (0.6 * gl.worldH) / CAN_H;
  }

  function buildFallback() {
    /* no WebGL: use the pre-rendered transparent can render */
    fallbackImg = el('img', 'stage-fallback');
    fallbackImg.src = FLAVORS[HERO_FLAVOR].can;
    fallbackImg.alt = '';
    stage.appendChild(fallbackImg);
  }

  function buildAll() {
    if (built) return;
    built = true;
    glowEl = el('div', 'can-glow');
    shadowEl = el('div', 'can-shadow');
    stage.appendChild(glowEl);
    stage.appendChild(shadowEl);
    buildScene();
  }

  /* ---------------- active flavour / word / chips / accent ---------------- */
  var curActive = -1;
  var acc = FLAVORS[HERO_FLAVOR].rgb.slice();

  function setActive(i, animate) {
    if (i === curActive) return;
    curActive = i;
    /* label crossfade happens in the render loop (material.opacity) */

    if (diveWord) {
      diveWord.style.setProperty('--chars', String(FLAVORS[i].short.length));
      if (animate !== false) {
        diveWord.textContent = FLAVORS[i].short;
        diveWord.classList.remove('pop');
        void diveWord.offsetWidth;             /* restart animation */
        diveWord.classList.add('pop');
      }
    }
    diveChips.forEach(function (c, k) { c.classList.toggle('is-on', k === i); });
  }

  /* ---------------- layout measurement ---------------- */
  var vh = window.innerHeight, vw = window.innerWidth;
  var heroH = 0, diveTop = 0, diveH = 0;
  var mobileCanY = 0;                  /* hero can offset from viewport centre */
  var heroS = 1;                       /* hero can scale (shared with the frame loop) */

  function measure() {
    vh = window.innerHeight;
    vw = window.innerWidth;
    heroH = heroEl ? heroEl.offsetHeight : vh;
    diveTop = diveEl ? diveEl.offsetTop : heroH;
    diveH = diveEl ? diveEl.offsetHeight : vh * 3;

    if (vw > 900) {
      heroS = clamp(vh / 830, 0.95, 1.18);
      return;
    }

    /* Mobile: the can floats in the space reserved under the hero copy
       (.hero__text padding-bottom). Size it to that space, centre it there,
       but never let it overlap the buttons or run far past the fold. */
    if (heroEl && heroText) {
      var padB = parseFloat(getComputedStyle(heroText).paddingBottom) || 0;
      var contentBottom = heroEl.offsetTop + heroText.offsetTop + heroText.offsetHeight - padB;
      var heroBottom = heroEl.offsetTop + heroH;
      var avail = heroBottom - contentBottom - 32;

      heroS = clamp(Math.max(vh / 1380, vw / 1100), 0.52, 0.85);
      if (avail > 0) {
        heroS = Math.min(heroS, avail * gl.worldH / (CAN_H * gl.perS * vh));
      }

      var canPx = (CAN_H * heroS * gl.perS) / gl.worldH * vh;
      var ideal = (contentBottom + heroBottom) / 2;
      var minC = contentBottom + canPx / 2 + 16;
      var maxC = vh - canPx / 2 - 28;
      mobileCanY = Math.max(minC, Math.min(ideal, maxC)) - vh / 2;
    }
  }

  /* ---------------- pointer parallax ---------------- */
  var mx = 0, my = 0, tmx = 0, tmy = 0;
  if (window.matchMedia('(pointer:fine)').matches && !reduce) {
    window.addEventListener('pointermove', function (e) {
      tmx = (e.clientX / vw - 0.5) * 2;
      tmy = (e.clientY / vh - 0.5) * 2;
    }, { passive: true });
  }

  /* ---------------- main loop ---------------- */
  var sy = window.scrollY || 0;
  var autoT = 0;
  var lastT = performance.now();
  var ready = false;
  var frameCount = 0;
  var stageHidden = false;

  function frame(now) {
    var dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (!reduce) autoT += dt;
    frameCount++;

    /* smoothed scroll */
    var target = window.scrollY || 0;
    sy += (target - sy) * 0.14;
    if (Math.abs(target - sy) < 0.15) sy = target;

    /* smoothed mouse */
    mx = lerp(mx, tmx, 0.06);
    my = lerp(my, tmy, 0.06);

    if (ready && built) {
      var startA = diveTop - vh;
      var approach = clamp((sy - startA) / Math.max(1, vh * 0.9), 0, 1);
      var eA = easeInOut(approach);

      var diveP = clamp((sy - diveTop) / Math.max(1, diveH - vh), 0, 1);
      /* fade the can out before the next section slides in, so it never
         floats on top of the cards. Ends exactly where the sticky dive
         unpins. Uses the real scroll position (not the smoothed one) so a
         jump/click can't leave the can hanging around. */
      var out = clamp((target - (diveTop + diveH - vh * 1.5)) / (vh * 0.5), 0, 1);

      /* flavour beats (thirds line up with the can's full turns) */
      var beat = diveP < 1 / 3 ? 0 : diveP < 2 / 3 ? 1 : 2;
      /* hold the hero flavour (with its side cans) until the dive is about to
         pin, so the label never duplicates one of the side cans */
      var active = sy < diveTop - vh * 0.06 ? HERO_FLAVOR : beat;
      setActive(active, approach >= 0.45);

      /* accent colour lerp (dt-based taaki slow devices par bhi1s me converge) */
      var tr = FLAVORS[active].rgb;
      var ak = Math.min(1, dt * 4);
      acc[0] = lerp(acc[0], tr[0], ak);
      acc[1] = lerp(acc[1], tr[1], ak);
      acc[2] = lerp(acc[2], tr[2], ak);
      root.style.setProperty('--accent',
        'rgb(' + Math.round(acc[0]) + ',' + Math.round(acc[1]) + ',' + Math.round(acc[2]) + ')');

      /* stage visibility — opacity fade + display (visibility would be
         overridden by visible children) */
      var hidden = out >= 0.999;
      stage.style.opacity = String(1 - out);
      if (hidden !== stageHidden) {
        stage.style.display = hidden ? 'none' : '';
        stageHidden = hidden;
      }

      if (!hidden) {
        var m = vw <= 900;             /* must match the CSS breakpoint */
        var xH = m ? 0 : vw * 0.225;
        var yH = m ? mobileCanY : -vh * 0.03;
        var sH = heroS;
        var sC = m ? clamp(vh / 1450, 0.48, 0.62) : clamp(vh / 1230, 0.66, 0.88);

        var x = lerp(xH, 0, eA);
        var y = lerp(yH, 0, eA);
        var s = lerp(sH, sC, eA) * (1 - out * 0.28);
        y -= out * vh * 0.1;

        /* spin: the hero shows all three cans brand-forward (no idle spin), then
           each dive beat starts face-on with a gentle sway. A continuous spin
           would leave the nutrition panel facing the viewer most of the time. */
        var ambient = reduce ? 0 : Math.sin(autoT * 0.6) * 8;
        var beatF = clamp(diveP, 0, 1) * 3;
        var beatIdx = Math.min(2, Math.floor(beatF));
        var beatT = beatF - beatIdx;
        var diveSpin = beatIdx * 360 + Math.sin(beatT * Math.PI) * 30 * (beatIdx % 2 ? -1 : 1);
        var ryDeg = ambient + diveSpin + mx * 12;
        var rxRad = 0.12 + -my * 0.07 + (reduce ? 0 : Math.sin(autoT * 0.7) * 0.015);

        var bobW = reduce ? 0 : Math.sin(autoT * 1.3) * 0.05;

        /* hero trio: side cans stay with the hero, then fade and drift apart
           as the hero scrolls away (gone just before the dive pins) */
        if (gl.sides.length) {
          var sideFade = clamp((sy - heroH * 0.5) / Math.max(1, heroH * 0.4), 0, 1);
          var sideOp = 1 - sideFade;
          var sideOn = sideOp > 0.01;
          for (var si = 0; si < gl.sides.length; si++) {
            var sd = gl.sides[si];
            sd.g.visible = sideOn;
            if (!sideOn) continue;
            sd.g.position.x = sd.dir * (0.80 + sideFade * 0.55);
            sd.g.rotation.y = -sd.dir * (12 + sideFade * 16) * RAD;
            for (var mi = 0; mi < sd.mats.length; mi++) sd.mats[mi].opacity = sideOp;
          }
        }

        if (gl.ok) {
          gl.root.position.set((x / vw) * gl.worldW, -(y / vh) * gl.worldH + bobW, 0);
          gl.root.scale.setScalar(s * gl.perS);
          gl.spin.rotation.y = ryDeg * RAD;
          gl.spin.rotation.x = rxRad;
          /* label crossfade */
          for (var li = 0; li < gl.labels.length; li++) {
            var lm = gl.labels[li], mt = lm.material;
            var tgt = li === active ? 1 : 0;
            mt.opacity += (tgt - mt.opacity) * Math.min(1, dt * 3.4);
            lm.visible = mt.opacity > 0.012;
          }
        }

        /* DOM glow + shadow follow the can */
        if (glowEl) {
          glowEl.style.transform =
            'translate(calc(-50% + ' + x + 'px), calc(-50% + ' + y + 'px)) scale(' + (0.75 + 0.4 * s) + ')';
        }
        if (shadowEl) {
          var canPx = (CAN_H * s * gl.perS) / gl.worldH * vh;
          shadowEl.style.transform =
            'translate(calc(-50% + ' + x + 'px), calc(-50% + ' + (y + canPx / 2 + 10) + 'px)) scale(' + s + ')';
          shadowEl.style.opacity = String(clamp(s, 0, 1) * 0.9);
        }
        if (fallbackImg) {
          fallbackImg.style.transform = 'translate(calc(-50% + ' + x + 'px), calc(-50% + ' + y + 'px)) scale(' + s + ')';
          fallbackImg.src = FLAVORS[active].can;
        }
      }

      /* render (skip when hidden) */
      if (gl.ok) {
        var show = !hidden;
        gl.renderer.domElement.style.visibility = show ? 'visible' : 'hidden';
        if (show) gl.renderer.render(gl.scene, gl.camera);
      }

      /* hero parallax */
      if (sy < heroH + vh * 0.2 && heroInner) {
        var p = clamp(sy / Math.max(1, vh * 0.85), 0, 1);
        heroInner.style.transform = 'translateY(' + (sy * 0.16) + 'px)';
        heroInner.style.opacity = String(1 - p * 0.95);
        if (heroSecond) {
          heroSecond.style.transform = 'translateY(' + (sy * 0.07) + 'px)';
          heroSecond.style.opacity = String(1 - p * 1.05);
        }
      }
    }

    /* craft cans — scroll-driven tilt, reveal and float. Read all rects
       first, then write, so we never force a re-layout per element. */
    var parReads = [];
    for (var k = 0; k < parEls.length; k++) {
      var pe = parEls[k];
      var r = pe.getBoundingClientRect();
      if (r.bottom > -120 && r.top < vh + 120) {
        parReads.push([pe, (r.top + r.height / 2 - vh / 2) / vh, r.top]);
      }
    }
    for (var q = 0; q < parReads.length; q++) {
      var pe2 = parReads[q][0];
      var c = clamp(parReads[q][1], -1, 1);
      var top = parReads[q][2];
      var rev = pe2.parentNode && pe2.parentNode.classList.contains('craft__row--rev');
      var dir = rev ? 1 : -1;
      var base = vw <= 900 ? 2 : 3.5;

      pe2._cx += (pe2._tx - pe2._cx) * 0.12;
      pe2._cy += (pe2._ty - pe2._cy) * 0.12;

      if (reduce) {
        pe2.style.setProperty('--py', '0px');
        pe2.style.setProperty('--fy', '0px');
        pe2.style.setProperty('--rx', '0deg');
        pe2.style.setProperty('--ry', '0deg');
        pe2.style.setProperty('--rz', (dir * base).toFixed(2) + 'deg');
        pe2.style.setProperty('--sc', '1');
        pe2.style.setProperty('--op', '1');
        continue;
      }

      var enter = clamp((vh * 0.92 - top) / (vh * 0.55), 0, 1);
      var e = 1 - Math.pow(1 - enter, 3);
      var bob = Math.sin(autoT * 0.85 + q * 1.7) * 5;

      pe2.style.setProperty('--py', (c * -30 + (1 - e) * 60).toFixed(1) + 'px');
      pe2.style.setProperty('--fy', bob.toFixed(1) + 'px');
      pe2.style.setProperty('--rx', ((1 - e) * -7 - pe2._cy * 7).toFixed(2) + 'deg');
      pe2.style.setProperty('--ry', (pe2._cx * 13 + c * 4).toFixed(2) + 'deg');
      pe2.style.setProperty('--rz', (dir * base + c * 2.5 + pe2._cx * 1.5).toFixed(2) + 'deg');
      pe2.style.setProperty('--sc', ((0.92 + 0.08 * e) * (1 - Math.abs(c) * 0.025)).toFixed(3));
      pe2.style.setProperty('--op', (0.2 + 0.8 * e).toFixed(3));
      pe2.style.setProperty('--gx', (pe2._cx * 34).toFixed(1) + 'px');
      pe2.style.setProperty('--gy', (pe2._cy * 26).toFixed(1) + 'px');

      var num = pe2.querySelector('.craft__num');
      if (num) {
        num.style.setProperty('--nr', (dir * -8 + c * 5).toFixed(2) + 'deg');
        num.style.setProperty('--ny', (c * 22).toFixed(1) + 'px');
      }
    }

    requestAnimationFrame(frame);
  }

  /* ============================================================
     Rail drag carousel (mouse only — touch uses native scrolling)
     ============================================================ */
  if (rail) {
    var down = false, startX = 0, startLeft = 0, lastX = 0, vel = 0, momentumRaf = 0;

    rail.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch' || e.button !== 0) return;   /* let touch swipe natively */
      down = true; vel = 0;
      startX = e.clientX; lastX = e.clientX;
      startLeft = rail.scrollLeft;
      rail.classList.add('is-grabbing');
      cancelAnimationFrame(momentumRaf);
      try { rail.setPointerCapture(e.pointerId); } catch (err) {}
    });
    rail.addEventListener('pointermove', function (e) {
      if (!down) return;
      rail.scrollLeft = startLeft - (e.clientX - startX);
      vel = e.clientX - lastX;
      lastX = e.clientX;
    });
    function release() {
      if (!down) return;
      down = false;
      rail.classList.remove('is-grabbing');
      (function momentum() {
        vel *= 0.94;
        rail.scrollLeft -= vel;
        if (Math.abs(vel) > 0.4) momentumRaf = requestAnimationFrame(momentum);
      })();
    }
    rail.addEventListener('pointerup', release);
    rail.addEventListener('pointercancel', release);
    rail.addEventListener('dragstart', function (e) { e.preventDefault(); });

    /* keyboard: left / right / home / end */
    rail.addEventListener('keydown', function (e) {
      var card = rail.querySelector('.card');
      var step = card ? card.getBoundingClientRect().width + 24 : 320;
      var max = rail.scrollWidth - rail.clientWidth;
      var to = null;
      if (e.key === 'ArrowRight') to = Math.min(max, rail.scrollLeft + step);
      else if (e.key === 'ArrowLeft') to = Math.max(0, rail.scrollLeft - step);
      else if (e.key === 'Home') to = 0;
      else if (e.key === 'End') to = max;
      if (to === null) return;
      e.preventDefault();
      rail.scrollTo({ left: to, behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  /* ============================================================
     Card hover tilt (fine pointers only)
     ============================================================ */
  if (window.matchMedia('(pointer:fine)').matches && !reduce) {
    $$('.card').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform =
          'perspective(900px) rotateX(' + (-py * 7).toFixed(2) + 'deg) rotateY(' +
          (px * 9).toFixed(2) + 'deg) translateY(-6px)';
      });
      card.addEventListener('pointerleave', function () {
        card.style.transform = '';
      });
    });
  }

  /* ============================================================
     Craft can hover tilt (fine pointers only)
     ============================================================ */
  if (window.matchMedia('(pointer:fine)').matches && !reduce) {
    parEls.forEach(function (pe) {
      pe.addEventListener('pointermove', function (e) {
        var r = pe.getBoundingClientRect();
        pe._tx = (e.clientX - r.left) / r.width - 0.5;
        pe._ty = (e.clientY - r.top) / r.height - 0.5;
      });
      pe.addEventListener('pointerleave', function () {
        pe._tx = 0; pe._ty = 0;
      });
    });
  }

  /* ============================================================
     Preloader
     ============================================================ */
  /* Labels are already embedded in js/textures.js as data: URLs, so they cost
     no extra download. Preloading them here just warms the decode + lets the
     progress bar reflect real work. Logos are the only network requests. */
  var ASSET_KEYS = [
    'assets/logo-sepela.png',
    'assets/logo-sepela-light.png',
    FLAVORS[0].label,
    FLAVORS[1].label,
    FLAVORS[2].label
  ];
  var t0 = performance.now();
  var done = 0, finished = false;
  var loadedImgs = {};

  function maybeFinish() {
    if (done < ASSET_KEYS.length) return;
    if (finished) return;
    finished = true;
    buildAll();
    measure();
    var wait = Math.max(0, 780 - (performance.now() - t0));
    setTimeout(function () {
      body.classList.remove('is-loading');
      body.classList.add('is-ready');
      ready = true;
      startReveals();
    }, wait);
  }

  ASSET_KEYS.forEach(function (key) {
    var im = new Image();
    var tick = function () {
      loadedImgs[key] = im;
      done++;
      var pct = Math.round(done / ASSET_KEYS.length * 100);
      if (loadBar) loadBar.style.width = pct + '%';
      if (loadPct) loadPct.textContent = pct + '%';
      maybeFinish();
    };
    im.onload = tick;
    im.onerror = tick;
    /* data: URL when embedded (file:// safe), otherwise the plain file */
    im.src = (window.SEPELA_TEX && window.SEPELA_TEX[key]) || key;
  });
  setTimeout(function () {               /* hard fallback */
    if (!finished) { done = ASSET_KEYS.length; maybeFinish(); }
  }, 8000);

  /* ============================================================
     Age gate (18+)
     ============================================================ */
  var gate = $('#ageGate');
  var gateYes = $('#gateYes');
  var gateOpen = false;

  function gateInert(on) {
    [header, $('main'), $('#mobileNav'), $('.skip-link')].forEach(function (el) {
      if (el) el.inert = on;
    });
  }
  function openGate() {
    gateOpen = true;
    gate.hidden = false;
    body.classList.add('is-gated');
    gateInert(true);
    setTimeout(function () { if (gateYes) gateYes.focus(); }, 80);
  }
  function closeGate() {
    gateOpen = false;
    gate.hidden = true;
    body.classList.remove('is-gated');
    gateInert(false);
    if (gateYes) gateYes.blur();
    var mainEl = $('main');
    if (mainEl) mainEl.focus({ preventScroll: true });
  }
  if (gate && gateYes) {
    var ageOk = false;
    try { ageOk = localStorage.getItem('sepela-age') === 'yes'; } catch (e) {}
    if (!ageOk) openGate();
    gateYes.addEventListener('click', function () {
      try { localStorage.setItem('sepela-age', 'yes'); } catch (e) {}
      closeGate();
    });
  }

  /* ============================================================
     Header: sticky on scroll, hide while scrolling down
     ============================================================ */
  var lastScrollY = window.scrollY || 0;
  function onScroll() {
    var y = window.scrollY || 0;
    if (header) {
      if (y > 24) header.classList.add('is-stuck');
      else header.classList.remove('is-stuck');
      if (y > 240 && y > lastScrollY && !menuOpen) header.classList.add('is-hidden');
      else header.classList.remove('is-hidden');
    }
    lastScrollY = y;
  }

  /* ============================================================
     Mobile menu
     ============================================================ */
  var menuBtn = $('#menuBtn');
  var mobileNav = $('#mobileNav');
  var menuOpen = false;

  function setMenu(open, focusBtn) {
    if (!menuBtn || !mobileNav) return;
    menuOpen = open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    mobileNav.classList.toggle('is-open', open);
    body.classList.toggle('is-menu', open);
    if (header) header.classList.remove('is-hidden');
    if (open) {
      var first = mobileNav.querySelector('a');
      if (first) first.focus({ preventScroll: true });
    } else if (focusBtn) {
      menuBtn.focus({ preventScroll: true });
    }
  }
  if (menuBtn && mobileNav) {
    menuBtn.addEventListener('click', function () { setMenu(!menuOpen); });
    mobileNav.addEventListener('click', function (e) {
      if (e.target === mobileNav || e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuOpen) setMenu(false, true);
    });
    window.addEventListener('resize', function () {
      if (menuOpen && window.innerWidth > 900) setMenu(false);
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------- boot ---------------- */
  window.addEventListener('resize', function () { measure(); glResize(); });
  window.addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  measure();
  requestAnimationFrame(frame);

  /* debug hook (harmless in prod) */
  window.__SEPELA = function () {
    return {
      sy: Math.round(sy), vh: vh, vw: vw,
      heroH: heroH, diveTop: diveTop, diveH: diveH,
      ready: ready, built: built, active: curActive,
      gl: gl.ok, fc: frameCount,
      disp: stage.style.display, op: stage.style.opacity
    };
  };
})();
