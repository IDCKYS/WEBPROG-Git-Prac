// Intro (three.js): blue (left) and orange (right) light cycles cruise side by side, blue surges ahead and cuts right,
// orange hits the blue light wall and derezzes, the camera swings from behind to blue's side, and blue dissolves into
// particles that re-form as the page title. Uses the real cycle + rider model (tron_cycle.glb, embedded in model.js).
(function () {
    'use strict';
    var intro = document.getElementById('intro');
    var canvas = document.getElementById('intro-canvas');
    var typeEl = document.getElementById('intro-type');
    var skip = document.getElementById('skip-intro');
    var TITLE = 'Dev Portfolio';
    var finished = false, raf = 0;
    var TEST = /^#t/.test(location.hash);

    function finish() {
        if (finished) return;
        finished = true;
        cancelAnimationFrame(raf);
        intro.classList.add('done');
        document.body.classList.remove('intro-active');
        setTimeout(function () { intro.style.display = 'none'; }, 900);
    }
    skip.addEventListener('click', finish);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') finish(); });

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        typeEl.textContent = TITLE; setTimeout(finish, 1500); return;
    }
    if (!window.THREE || !THREE.GLTFLoader || !window.TRON_GLB_B64) { finish(); return; }

    // ------------------------------------------------------------ helpers
    function clamp01(t) { return Math.max(0, Math.min(1, t)); }
    function ease(a, b, t) { t = clamp01((t - a) / (b - a)); return t * t * (3 - 2 * t); }
    function ease5(a, b, t) { t = clamp01((t - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); }
    function bump(a, b, t) { var u = clamp01((t - a) / (b - a)); return Math.sin(Math.PI * u); }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    // lighter mode for phones / low-memory devices (also forced with ?lite)
    var LITE = /lite/.test(location.search) || Math.min(innerWidth, innerHeight) < 700 || (navigator.deviceMemory && navigator.deviceMemory <= 4) || /Mobi|Android/i.test(navigator.userAgent);
    try {   // any failure below (no WebGL, lost context, bad model) skips the intro and shows the page

    // ------------------------------------------------------------ renderer / scene
    var W = innerWidth, H = innerHeight;
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(LITE ? 1 : Math.min(window.devicePixelRatio || 1, 1.75));
    canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); finish(); });
    renderer.setSize(W, H, false);
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000203);
    scene.fog = new THREE.FogExp2(0x00060a, 0.009);
    var FOV = 55;
    var camera = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 900); camera.layers.enable(1);

    // procedural environment (gradient dome + light strips) for the glossy suit / metal reflections
    (function () {
        var pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
        es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false,
            vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: 'varying vec3 vP; void main(){ float h = vP.y; vec3 c = mix(vec3(0.03,0.10,0.14), vec3(0.0,0.004,0.012), smoothstep(-0.05,0.9,h)); c = mix(vec3(0.0,0.003,0.005), c, smoothstep(-0.5,0.0,h)); gl_FragColor = vec4(c,1.0); }'
        })));
        var strip = new THREE.MeshBasicMaterial(); strip.color.setRGB(3.0, 5.5, 7.0);
        [[0, 20, -30, 40, 0.8], [-30, 16, 0, 0.8, 30], [30, 16, 5, 0.8, 30], [0, 30, 10, 30, 0.8]].forEach(function (s) {
            var m = new THREE.Mesh(new THREE.BoxGeometry(s[3], s[4], s[3] === 0.8 ? s[4] : 0.8), strip); m.position.set(s[0], s[1], s[2]); es.add(m);
        });
        scene.environment = pm.fromScene(es, 0.03).texture; pm.dispose();
    })();

    // sky gradient + skyline (instanced boxes), light beams
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'varying vec3 vP; void main(){ float h = clamp(vP.y,0.0,1.0); vec3 c = vec3(0.0,0.0004,0.0012) + vec3(0.001,0.008,0.014) * exp(-h * 16.0); gl_FragColor = vec4(c,1.0); }'
    })));
    // floor: mirror + world-space grid
    var floorMirror = LITE ? new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshBasicMaterial({ color: 0x000102 }))
        : new THREE.Reflector(new THREE.PlaneGeometry(1400, 1400), { color: 0x24363d, textureWidth: Math.round(W * renderer.getPixelRatio()), textureHeight: Math.round(H * renderer.getPixelRatio()), clipBias: 0.003 });
    floorMirror.rotation.x = -Math.PI / 2; scene.add(floorMirror);
    var grid = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: 'varying vec3 vW; uniform vec3 cam; float gl(vec2 p, float s){ vec2 q = p / s; vec2 g = abs(fract(q - 0.5) - 0.5) / fwidth(q); return 1.0 - min(min(g.x, g.y), 1.0); }' +
            'void main(){ float a = gl(vW.xz, 4.0) * 0.30 + gl(vW.xz, 20.0) * 0.70; float d = length(vW.xz - cam.xz); a *= 1.0 - smoothstep(40.0, 260.0, d); gl_FragColor = vec4(vec3(0.10,0.30,0.42), a * 0.9); }',
        uniforms: { cam: { value: new THREE.Vector3() } }
    }));
    grid.rotation.x = -Math.PI / 2; grid.position.y = 0.004; scene.add(grid);

    scene.add(new THREE.HemisphereLight(0x2a6e8f, 0x010305, 0.35));
    var key = new THREE.DirectionalLight(0x8fd6ff, 1.5); key.position.set(-20, 30, -10); scene.add(key);
    var blueLight = new THREE.PointLight(0x4fc3ff, 6, 5.5, 2), orangeLight = new THREE.PointLight(0xff7a14, 6, 5.5, 2);
    scene.add(blueLight); scene.add(orangeLight);

    // post: bloom + grade + fade / dim / flash
    var composer = new THREE.EffectComposer(renderer);
    composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(W, H);
    composer.addPass(new THREE.RenderPass(scene, camera));
    var bloom = new THREE.UnrealBloomPass(new THREE.Vector2(LITE ? W / 2 : W, LITE ? H / 2 : H), 0.9, 0.18, 1.0); composer.addPass(bloom);
    var post = new THREE.ShaderPass({
        uniforms: { tDiffuse: { value: null }, fade: { value: 1 }, dim: { value: 0 }, flash: { value: new THREE.Vector3() } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform sampler2D tDiffuse; uniform float fade, dim; uniform vec3 flash; varying vec2 vUv;' +
            'void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = dot(c, vec3(0.3,0.6,0.1));' +
            'c *= 1.0 - dim * 0.7 * (1.0 - smoothstep(0.35, 1.6, l)); c += flash; c = max(c - 0.006, 0.0); c = 1.0 - exp(-c * 2.1);' +
            'vec2 q = vUv - 0.5; c *= 1.0 - dot(q, q) * 1.0; c = pow(c, vec3(1.0 / 2.0)); c += (fract(sin(dot(vUv * 1731.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 128.0; gl_FragColor = vec4(c * (1.0 - fade), 1.0); }'
    });
    composer.addPass(post);

    // ------------------------------------------------------------ model
    function b64ToBuf(b64) { var bin = atob(b64), n = bin.length, u = new Uint8Array(n); for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i); return u.buffer; }

    var bikes = {}, sampler = null;
    function setFade(bike, f) {
        bike.mats.forEach(function (m) {
            var op = m.userData.baseOpacity * f;
            m.transparent = m.userData.baseTransparent || f < 0.999; m.opacity = op; m.depthWrite = f > 0.6 && !m.userData.baseTransparent;
        });
        bike.rig.visible = f > 0.003;
    }
    function makeBike(gltfScene, glow) {
        var model = gltfScene.clone(true), mats = [];
        model.traverse(function (o) {
            if (!o.isMesh) return;
            o.material = o.material.clone(); var m = o.material;
            m.userData.baseOpacity = m.opacity; m.userData.baseTransparent = m.transparent;
            if (m.name === 'hero_glow') { m.emissive.setRGB(glow[0], glow[1], glow[2]); m.color.setRGB(glow[0], glow[1], glow[2]); m.emissiveIntensity = 1.7; m.fog = false; }
            else { m.envMapIntensity = 2.6; }
            mats.push(m); o.frustumCulled = false;
        });
        var fix = new THREE.Group(); fix.rotation.y = Math.PI; fix.add(model);        // model faces -Z; the sim drives +Z
        var lean = new THREE.Group(); lean.add(fix);
        var rig = new THREE.Group(); rig.add(lean); scene.add(rig);
        return { rig: rig, lean: lean, model: model, mats: mats };
    }
    function buildSampler(model) {
        model.updateMatrixWorld(true);
        var tris = [], areas = [], total = 0, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
        model.traverse(function (o) {
            if (!o.isMesh || o.material.name === 'hero_glass') return;
            var pos = o.geometry.attributes.position, idx = o.geometry.index, mw = o.matrixWorld, n = idx ? idx.count : pos.count;
            for (var i = 0; i < n; i += 3) {
                var i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
                a.fromBufferAttribute(pos, i0).applyMatrix4(mw); b.fromBufferAttribute(pos, i1).applyMatrix4(mw); c.fromBufferAttribute(pos, i2).applyMatrix4(mw);
                e1.subVectors(b, a); e2.subVectors(c, a); var ar = e1.cross(e2).length() * 0.5; if (ar < 1e-9) continue;
                total += ar; areas.push(total); tris.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
            }
        });
        return { tris: tris, cum: areas, total: total };
    }
    function sampleLocal(s, out) {
        var r = Math.random() * s.total, lo = 0, hi = s.cum.length - 1;
        while (lo < hi) { var mid = (lo + hi) >> 1; if (s.cum[mid] < r) lo = mid + 1; else hi = mid; }
        var t = s.tris, o = lo * 9, u = Math.random(), v = Math.random(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
        out.set(t[o] + (t[o + 3] - t[o]) * u + (t[o + 6] - t[o]) * v, t[o + 1] + (t[o + 4] - t[o + 1]) * u + (t[o + 7] - t[o + 1]) * v, t[o + 2] + (t[o + 5] - t[o + 2]) * u + (t[o + 8] - t[o + 2]) * v);
        return out;
    }

    // ------------------------------------------------------------ light walls
    var MAXSEG = 1100;
    function makeWall(rgb, opacity, y0, y1) {
        var g = new THREE.BufferGeometry(), pos = new Float32Array((MAXSEG + 2) * 2 * 3), idx = new Uint32Array(MAXSEG * 6);
        for (var i = 0; i < MAXSEG; i++) { var k = i * 2; idx.set([k, k + 1, k + 2, k + 1, k + 3, k + 2], i * 6); }
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.setDrawRange(0, 0);
        var m = new THREE.MeshBasicMaterial({ transparent: true, opacity: opacity, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
        m.color.setRGB(rgb[0], rgb[1], rgb[2]);
        var mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; scene.add(mesh);
        return { mesh: mesh, g: g, pos: pos, y0: y0, y1: y1, base: opacity };
    }
    function wallSet(rgb) { return [makeWall([rgb[0] * 0.5, rgb[1] * 0.5, rgb[2] * 0.5], 0.2, 0.0, 1.15), makeWall(rgb, 0.9, 1.12, 1.18), makeWall(rgb, 1.0, 0.0, 0.07)]; }
    function updateWalls(set, trail, tail, fade) {
        var n = Math.min(trail.length, MAXSEG), start = trail.length - n;
        set.forEach(function (w) {
            var p = w.pos, j = 0;
            for (var i = 0; i <= n; i++) {
                var q = i < n ? trail[start + i] : tail; if (!q) continue;
                p[j++] = -q[0]; p[j++] = w.y0; p[j++] = q[1]; p[j++] = -q[0]; p[j++] = w.y1; p[j++] = q[1];
            }
            w.g.attributes.position.needsUpdate = true; w.g.setDrawRange(0, Math.max(0, n * 6)); w.mesh.material.opacity = w.base * fade; w.mesh.visible = fade > 0.01 && n > 1;
        });
    }

    // ------------------------------------------------------------ choreography (ported from the 2D prototype; r = to the screen-right, z = forward)
    var T_TURN0 = 2.8, T_TURN1 = 3.6, T_ACC0 = 2.1, T_ACC1 = 3.1, FORCE_CRASH = 3.9, HALF = 1.33;
    var blue = { r: -2.2, z: 0, th: 0, roll: 0, v: 24, trail: [], alive: true }, orange = { r: 2.3, z: 0, th: 0, roll: 0, v: 24, trail: [], alive: true };
    var crashT = -1, morphT = T_TURN1 + 0.1, shake = 0, flash = 0, camYaw = 0, camPos = null, bluePrev = 0, orangePrev = 0;
    var shards = [], shardMesh = null, shardDummy = new THREE.Object3D();

    function thetaBlue(t) {
        var sway = 0.12 * Math.sin(1.8 * t) * (1 - ease(2.0, 2.4, t)), wind = -0.12 * bump(2.4, 2.9, t);
        return sway + wind + (Math.PI / 2) * ease5(T_TURN0, T_TURN1, t);
    }
    function speedBlue(t) { return 24 + 20 * ease5(T_ACC0, T_ACC1, t) - 18 * ease(T_TURN1, T_TURN1 + 0.7, t); }
    function thetaOrange(t) { return 0.13 * Math.sin(1.4 * t + 1.1); }
    function segHit(x1, y1, x2, y2, x3, y3, x4, y4) {
        var d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3); if (Math.abs(d) < 1e-9) return false;
        var u = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d, v = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
        return u >= 0 && u <= 1 && v >= 0 && v <= 1;
    }
    function pushTrail(b) {
        var rx = b.r - Math.sin(b.th) * HALF, rz = b.z - Math.cos(b.th) * HALF, l = b.trail[b.trail.length - 1];
        if (!l) { b.trail.push([rx, rz]); return; }
        var dd = Math.hypot(rx - l[0], rz - l[1]), nseg = Math.floor(dd / 0.25);
        for (var q = 1; q <= nseg; q++) b.trail.push([l[0] + (rx - l[0]) * q / nseg, l[1] + (rz - l[1]) * q / nseg]);
    }
    function step(t, dt) {
        var tb = thetaBlue(t), to = thetaOrange(t);
        var rb = Math.max(-0.55, Math.min(0.55, -(tb - bluePrev) / dt * 0.2)), ro = Math.max(-0.4, Math.min(0.4, -(to - orangePrev) / dt * 0.3)), rk = 1 - Math.exp(-9 * dt);
        blue.roll += (rb - blue.roll) * rk; orange.roll += (ro - orange.roll) * rk;
        bluePrev = tb; orangePrev = to; blue.th = tb; orange.th = to;
        blue.v = speedBlue(t); orange.v = 24 + 8 * bump(1.6, 2.8, t);
        var ox = orange.r, oz = orange.z;
        blue.r += Math.sin(tb) * blue.v * dt; blue.z += Math.cos(tb) * blue.v * dt;
        if (orange.alive) { orange.r += Math.sin(to) * orange.v * dt; orange.z += Math.cos(to) * orange.v * dt; }
        pushTrail(blue); if (orange.alive) pushTrail(orange);
        if (orange.alive && t > T_TURN0) {
            var nx = orange.r + Math.sin(to) * HALF, nz = orange.z + Math.cos(to) * HALF, px = ox + Math.sin(to) * HALF, pz = oz + Math.cos(to) * HALF, tr = blue.trail, hit = false;
            for (var i = 1; i < tr.length - 4 && !hit; i++) hit = segHit(px, pz, nx, nz, tr[i - 1][0], tr[i - 1][1], tr[i][0], tr[i][1]);
            if (hit || t > FORCE_CRASH) crash(t);
        }
    }
    function crash(t) {
        orange.alive = false; crashT = t; shake = 1; flash = 1; window.__crashT = t;
        bikes.orange.rig.updateMatrixWorld(true);
        var s = new THREE.Vector3(), mw = bikes.orange.model.matrixWorld;
        for (var i = 0; i < 220; i++) {
            sampleLocal(sampler, s); var p = s.clone().applyMatrix4(mw), a = Math.random() * 6.283, sp = rnd(2, 12);
            shards.push({ p: p, v: new THREE.Vector3(Math.cos(a) * sp, rnd(1.5, 9), Math.sin(a) * sp), life: 1, s: rnd(0.03, 0.09) });
        }
        setFade(bikes.orange, 0);
    }

    // ------------------------------------------------------------ camera (behind blue, then swings to its left side after the turn)
    function updateCamera(t, dt) {
        camYaw += (blue.th - camYaw) * (1 - Math.exp(-18 * dt));
        var side = ease(T_TURN1, T_TURN1 + 0.9, t);
        var fr = Math.sin(camYaw), fz = Math.cos(camYaw), rr = fz, rz = -fr;                // right vector in (r, z)
        var back = 4.3 * (1 - side) + 0.4 * side, left = 0.35 * (1 - side) + 4.4 * side;
        var cr = blue.r - fr * back - rr * left, cz = blue.z - fz * back - rz * left;
        var acc = bump(T_ACC0 - 0.1, T_TURN1 + 0.3, t), cy = (1.5 - 0.12 * acc) * (1 - side) + 1.15 * side;
        if (!camPos) camPos = [cr, cy, cz];
        var k = 1 - Math.exp(-60 * dt); camPos[0] += (cr - camPos[0]) * k; camPos[1] += (cy - camPos[1]) * k; camPos[2] += (cz - camPos[2]) * k;
        var fwdOff = 2.2 * (1 - side) + 0.3 * side, rOff = 1.4 * (1 - side);
        var tr_ = blue.r + Math.sin(blue.th) * fwdOff + rr * rOff, tz_ = blue.z + Math.cos(blue.th) * fwdOff + rz * rOff;
        var sx = shake > 0 ? (Math.random() - 0.5) * 0.30 * shake : 0, sy = shake > 0 ? (Math.random() - 0.5) * 0.18 * shake : 0;
        camera.position.set(-camPos[0] + sx, camPos[1] + sy, camPos[2]);
        camera.up.set(0, 1, 0); camera.lookAt(-tr_, 0.65, tz_);
        camera.fov = FOV * (1 - 0.06 * acc); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    }

    // ------------------------------------------------------------ title particles
    var parts = null, partGeo = null, partPoints = null, tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
    var TD = 6.0;
    function buildTargets() {
        var cw = Math.round(W), ch = Math.round(H), oc = document.createElement('canvas'); oc.width = cw; oc.height = ch;
        var c = oc.getContext('2d'), lines = [TITLE], font = '900 100px Orbitron, "Segoe UI", sans-serif'; c.font = font;
        var size = Math.min(cw * 0.78 / c.measureText(TITLE).width * 100, ch * 0.2);
        if (size < 36) { lines = ['Dev', 'Portfolio']; size = Math.min(cw * 0.8 / c.measureText('Portfolio').width * 100, ch * 0.14); }
        c.font = font.replace('100px', size + 'px'); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff';
        lines.forEach(function (ln, i) { c.fillText(ln, cw / 2, ch / 2 + (i - (lines.length - 1) / 2) * size * 1.25); });
        var data = c.getImageData(0, 0, cw, ch).data, pts = [], stp = Math.max(2, Math.round(size / 26)), x, y;
        var halfH = TD * Math.tan(FOV * Math.PI / 360);
        for (y = 0; y < ch; y += stp) for (x = 0; x < cw; x += stp) if (data[(y * cw + x) * 4 + 3] > 140) pts.push([(x - cw / 2) / ch * 2 * halfH, -(y - ch / 2) / ch * 2 * halfH]);
        while (pts.length > (LITE ? 2200 : 4200)) pts.splice((Math.random() * pts.length) | 0, 1);
        return pts;
    }
    function startParticles(t) {
        var targets = buildTargets(), N = targets.length, locs = [], i;
        for (i = 0; i < N; i++) locs.push(sampleLocal(sampler, new THREE.Vector3()));
        locs.sort(function (a, b) { return b.z - a.z; });                                   // tail first (model faces -Z)
        parts = locs.map(function (l, i) {
            return { loc: l, tx: targets[i][0], ty: targets[i][1], launch: t + (i / N) * 0.85 + Math.random() * 0.1, dur: rnd(0.9, 1.4), on: false, s: new THREE.Vector3(), c: new THREE.Vector3(), seed: Math.random() * 6.283 };
        });
        partGeo = new THREE.BufferGeometry();
        partGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage));
        partGeo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(N * 4), 4).setUsage(THREE.DynamicDrawUsage));
        partPoints = new THREE.Points(partGeo, new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: { px: { value: 2.2 * renderer.getPixelRatio() } },
            vertexShader: 'attribute vec4 aColor; varying vec4 vC; uniform float px; void main(){ vC = aColor; gl_PointSize = px; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: 'varying vec4 vC; void main(){ gl_FragColor = vec4(vC.rgb * vC.a, 1.0); }'
        }));
        partPoints.frustumCulled = false; partPoints.renderOrder = 10; partPoints.layers.set(1); scene.add(partPoints);
    }
    function drawParticles(t) {
        var pos = partGeo.attributes.position.array, col = partGeo.attributes.aColor.array, last = 0, glowIn = ease(morphT - 0.1, morphT + 0.25, t);
        var mw = bikes.blue.model.matrixWorld;
        for (var i = 0; i < parts.length; i++) {
            var p = parts[i], j = i * 3, k = i * 4;
            if (t < p.launch) {
                tmp.copy(p.loc).applyMatrix4(mw); pos[j] = tmp.x; pos[j + 1] = tmp.y; pos[j + 2] = tmp.z;
                col[k] = 0.75; col[k + 1] = 1.5; col[k + 2] = 1.8; col[k + 3] = 0.9 * glowIn; last = Math.max(last, p.launch + p.dur); continue;
            }
            if (!p.on) {
                tmp.copy(p.loc).applyMatrix4(mw); camera.worldToLocal(p.s.copy(tmp));
                var e = tmp2.set(p.tx, p.ty, -TD), d = p.s.distanceTo(e) || 1, off = rnd(-0.3, 0.3) * d;
                p.c.set((p.s.x + e.x) / 2 - (e.y - p.s.y) / d * off, (p.s.y + e.y) / 2 + (e.x - p.s.x) / d * off + rnd(0, 0.12) * d, (p.s.z + e.z) / 2 + rnd(0, 0.12) * d);
                p.on = true;
            }
            var u = clamp01((t - p.launch) / p.dur), ee = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2, ii = 1 - ee;
            tmp.set(ii * ii * p.s.x + 2 * ii * ee * p.c.x + ee * ee * p.tx, ii * ii * p.s.y + 2 * ii * ee * p.c.y + ee * ee * p.ty, ii * ii * p.s.z + 2 * ii * ee * p.c.z + ee * ee * -TD);
            if (u >= 1) { tmp.x += Math.sin(t * 5 + p.seed) * 0.004; tmp.y += Math.cos(t * 4 + p.seed) * 0.004; }
            camera.localToWorld(tmp); pos[j] = tmp.x; pos[j + 1] = tmp.y; pos[j + 2] = tmp.z;
            var scan = Math.max(0, Math.sin((p.tx / 6) * 7 - t * 5)), mix = u >= 1 ? 0.55 + 0.45 * scan * scan : u;
            col[k] = 0.55 + 1.1 * mix; col[k + 1] = 1.3 + 0.6 * mix; col[k + 2] = 1.7 + 0.4 * mix; col[k + 3] = 1.0;
            last = Math.max(last, p.launch + p.dur);
        }
        partGeo.attributes.position.needsUpdate = true; partGeo.attributes.aColor.needsUpdate = true;
        return last;
    }

    // ------------------------------------------------------------ main loop
    var wallsBlue, wallsOrange, tEnd = 0, simT = 0;
    function tick(t, dt, doRender) {
        step(t, dt);
        if (shake > 0) shake = Math.max(0, shake - dt * 2.5);
        flash = Math.max(0, flash - dt * 5.0);
        updateCamera(t, dt);

        [[bikes.blue, blue], [bikes.orange, orange]].forEach(function (pr) {
            var bk = pr[0], s = pr[1];
            bk.rig.position.set(-s.r, 0, s.z); bk.rig.rotation.y = -s.th; bk.lean.rotation.z = -s.roll;
        });
        blueLight.position.set(-blue.r, 0.7, blue.z); orangeLight.position.set(-orange.r, 0.7, orange.z); orangeLight.intensity = orange.alive ? 6 : flash * 70; orangeLight.distance = orange.alive ? 5.5 : 12;
        grid.material.uniforms.cam.value.copy(camera.position);

        var m0 = t >= morphT ? morphT : 999;
        var bikeFade = 1 - ease(m0, m0 + 0.9, t), wallFade = 1 - ease(m0, m0 + 1.2, t), oWall = crashT < 0 ? 1 : Math.max(0, 1 - (t - crashT) * 0.7);
        setFade(bikes.blue, bikeFade);
        blueLight.intensity = 6 * bikeFade;
        updateWalls(wallsBlue, blue.trail, [blue.r - Math.sin(blue.th) * HALF, blue.z - Math.cos(blue.th) * HALF], wallFade);
        updateWalls(wallsOrange, orange.trail, orange.alive ? [orange.r - Math.sin(orange.th) * HALF, orange.z - Math.cos(orange.th) * HALF] : null, oWall);

        // derez shards
        if (shards.length) {
            var i;
            for (i = shards.length - 1; i >= 0; i--) {
                var s = shards[i]; s.v.y -= 16 * dt; s.p.addScaledVector(s.v, dt); if (s.p.y < 0.02) { s.p.y = 0.02; s.v.y *= -0.3; s.v.x *= 0.7; s.v.z *= 0.7; }
                s.life -= dt * 0.75; if (s.life <= 0) shards.splice(i, 1);
            }
            for (i = 0; i < 260; i++) {
                var sh = shards[i];
                if (sh) { shardDummy.position.copy(sh.p); shardDummy.scale.setScalar(sh.s * (0.4 + sh.life)); shardDummy.rotation.set(i, i * 2, 0); } else shardDummy.scale.setScalar(0);
                shardDummy.updateMatrix(); shardMesh.setMatrixAt(i, shardDummy.matrix);
            }
            shardMesh.instanceMatrix.needsUpdate = true; shardMesh.visible = true;
        } else if (shardMesh) shardMesh.visible = false;

        if (t >= morphT) {
            if (!parts) startParticles(morphT);
            var end = drawParticles(t); if (end && t > end + 0.7 && !tEnd) tEnd = t;
        }
        post.uniforms.dim.value = 0.6 * ease(morphT, morphT + 1.3, t);
        post.uniforms.fade.value = 1 - ease(0, 0.6, t);
        post.uniforms.flash.value.set(0, 0, 0);          // no full-screen tint: the burst is the local orange light + shards
        if (doRender) composer.render();
        if (tEnd && t > tEnd && !TEST) finish();
    }

    // ------------------------------------------------------------ boot
    function boot(gltf) { try { bootInner(gltf); } catch (e) { console.error(e); finish(); } }
    function bootInner(gltf) {
        var scn = gltf.scene;
        bikes.blue = makeBike(scn, [0.1, 0.62, 1.0]); bikes.orange = makeBike(scn, [1.0, 0.2, 0.02]);
        sampler = buildSampler(bikes.blue.model);
        wallsBlue = wallSet([0.15, 0.75, 1.1]); wallsOrange = wallSet([1.2, 0.3, 0.04]);
        var sm = new THREE.MeshBasicMaterial(); sm.color.setRGB(2.4, 0.95, 0.12);
        shardMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), sm, 260); shardMesh.frustumCulled = false; shardMesh.visible = false; scene.add(shardMesh);
        addEventListener('resize', function () {
            W = innerWidth; H = innerHeight; renderer.setSize(W, H, false); composer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix();
        });
        window.__introReady = true; window.__introEnd = function () { return tEnd; };
        window.__simTo = function (T) {                                    // deterministic stepping for tests (#t in the URL)
            while (simT < T) { simT += 1 / 60; tick(simT, 1 / 60, simT >= T - 1 / 60); }
        };
        if (TEST) return;
        var last = 0, t0 = 0;
        (function loop(now) {
            if (finished) return;
            if (!t0) { t0 = now; last = now; }
            var t = (now - t0) / 1000, dt = Math.min(Math.max((now - last) / 1000, 0.0001), 0.05); last = now; simT = t;
            tick(t, dt, true);
            if (!finished) raf = requestAnimationFrame(loop);
        })(performance.now());
    }
    var go = function () {
        try {
            new THREE.GLTFLoader().parse(b64ToBuf(window.TRON_GLB_B64), '', boot, function (e) { console.error('intro model failed', e); finish(); });
        } catch (e) { console.error(e); finish(); }
    };
    Promise.race([document.fonts && document.fonts.load ? document.fonts.load('900 80px Orbitron') : Promise.resolve(), new Promise(function (r) { setTimeout(r, 1500); })]).then(go, go);
    } catch (e) { console.error("intro setup failed", e); finish(); }
})();
