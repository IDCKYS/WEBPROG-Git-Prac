// Running background: a slowly rotating wireframe sphere inside a loose
// polyhedron (data pulses travel along its edges), with columns of code
// scrolling up the sides like the terminal screen.
(function () {
    var canvas = document.getElementById('bg-canvas');
    var ctx = canvas.getContext('2d');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var W, H, dpr;

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = canvas.width = Math.round(innerWidth * dpr);
        H = canvas.height = Math.round(innerHeight * dpr);
    }
    resize();
    addEventListener('resize', function () { resize(); if (reduce) draw(0, 0); });

    // ---- geometry ----
    var pts = [], edges = [], outer = [], spokes = [], pulses = [];
    var N = 150, i, j;
    for (i = 0; i < N; i++) {
        var y = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(1 - y * y), th = i * 2.399963;
        var k = 0.94 + Math.random() * 0.06;
        pts.push([Math.cos(th) * r * k, y * k, Math.sin(th) * r * k]);
    }
    for (i = 0; i < N; i++) for (j = i + 1; j < N; j++) {
        var dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1], dz = pts[i][2] - pts[j][2];
        if (dx * dx + dy * dy + dz * dz < 0.2) edges.push([i, j]);
    }
    for (i = 0; i < 12; i++) {
        var a = Math.random() * 6.283, b = Math.acos(2 * Math.random() - 1), rr = 1.45 + Math.random() * 0.5;
        outer.push([Math.sin(b) * Math.cos(a) * rr, Math.cos(b) * rr, Math.sin(b) * Math.sin(a) * rr]);
    }
    outer.forEach(function (o, oi) {
        var near = pts.map(function (p, pi) {
            var d = Math.pow(p[0] - o[0], 2) + Math.pow(p[1] - o[1], 2) + Math.pow(p[2] - o[2], 2);
            return [d, pi];
        }).sort(function (u, v) { return u[0] - v[0]; });
        for (var s = 0; s < 3; s++) spokes.push([oi, near[s * 4][1]]);
        spokes.push([oi, (oi + 3) % outer.length + 1000]); // outer-to-outer link, offset marks type
    });
    for (i = 0; i < 18; i++) pulses.push({ e: (Math.random() * edges.length) | 0, t: Math.random(), v: 0.3 + Math.random() * 0.6 });

    // ---- code columns ----
    var pool = [
        "TDHD = os.path.join( TDH, 'dynamics', 'scripts' )",
        "FILES = [ [ TDSD, '__init__.py' ],",
        "q = g3[ b10 + bz1 ] ; v = at3[rx1,ry0,rz1];",
        "double total = 0;",
        "for(int i = 0; i < getOctaves(); i++) {",
        "  amplitude = pow(getPersist(), i);",
        "return lerp(sx, sy, d);",
        "git commit -m \"add header\"",
        "/dev/.udev/names/ptye7",
        "/home/user # ps",
        "context = 'user'",
        "if '-c' in sys.argv:",
        "render_model.py  head_test.py",
        "frequency *= getGain();",
        "[ tty0 ] connected",
        "<section id=\"projects\">"
    ];
    var lines = [], lh = 15;
    function fillLines() {
        lines = [];
        for (var n = 0; n < Math.ceil(innerHeight / lh) + 2; n++) lines.push(pool[(Math.random() * pool.length) | 0]);
    }
    fillLines();

    // ---- draw ----
    function proj(p, ax, ay, cx, cy, R) {
        var cyA = Math.cos(ay), syA = Math.sin(ay), cxA = Math.cos(ax), sxA = Math.sin(ax);
        var x = p[0] * cyA + p[2] * syA, z = -p[0] * syA + p[2] * cyA, y = p[1];
        var y2 = y * cxA - z * sxA, z2 = y * sxA + z * cxA;
        var s = 3.6 / (3.6 - z2);
        return [cx + x * R * s, cy + y2 * R * s, z2];
    }

    var scroll = 0;
    function draw(t, dt) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, W, H);

        var wide = innerWidth > 900;
        var cx = wide ? W * 0.76 : W * 0.5, cy = wide ? H * 0.5 : H * 0.38;
        var R = Math.min(W, H) * (wide ? 0.27 : 0.32);

        // code columns (left, plus right on wide screens)
        ctx.font = (11 * dpr) + 'px "Share Tech Mono", monospace';
        ctx.fillStyle = 'rgba(190,220,255,' + (wide ? 0.2 : 0.1) + ')';
        var off = scroll % (lh * dpr);
        for (i = 0; i < lines.length; i++) ctx.fillText(lines[i], 14 * dpr, i * lh * dpr - off);
        if (wide) for (i = 0; i < lines.length; i++) ctx.fillText(lines[(i + 7) % lines.length], W - 330 * dpr, i * lh * dpr - off);
        scroll += dt * 14 * dpr;
        if (scroll > lh * dpr) { scroll -= lh * dpr; lines.shift(); lines.push(pool[(Math.random() * pool.length) | 0]); }

        // core glow
        var g = ctx.createRadialGradient(cx - R * 0.2, cy + R * 0.45, 0, cx, cy, R * 1.3);
        g.addColorStop(0, 'rgba(140,200,255,0.22)');
        g.addColorStop(1, 'rgba(140,200,255,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

        var ay = t * 0.12, ax = 0.35 + Math.sin(t * 0.15) * 0.12;
        var P = pts.map(function (p) { return proj(p, ax, ay, cx, cy, R); });
        var O = outer.map(function (p) { return proj(p, ax, ay * 0.6, cx, cy, R); });

        ctx.lineWidth = dpr;
        var back = new Path2D(), front = new Path2D();
        edges.forEach(function (e) {
            var a = P[e[0]], b = P[e[1]], path = (a[2] + b[2]) / 2 > 0 ? front : back;
            path.moveTo(a[0], a[1]); path.lineTo(b[0], b[1]);
        });
        ctx.strokeStyle = 'rgba(160,205,240,0.14)'; ctx.stroke(back);
        ctx.strokeStyle = 'rgba(200,230,255,0.38)'; ctx.stroke(front);

        // outer polyhedron spokes
        var sp = new Path2D();
        spokes.forEach(function (s) {
            var a = O[s[0]], b = s[1] >= 1000 ? O[s[1] - 1000] : P[s[1]];
            if (!b) return;
            sp.moveTo(a[0], a[1]); sp.lineTo(b[0], b[1]);
        });
        ctx.strokeStyle = 'rgba(200,230,255,0.22)'; ctx.stroke(sp);

        // nodes
        ctx.fillStyle = 'rgba(230,245,255,0.8)';
        O.forEach(function (o) { ctx.fillRect(o[0] - 2 * dpr, o[1] - 2 * dpr, 4 * dpr, 4 * dpr); });
        ctx.fillStyle = 'rgba(220,240,255,0.55)';
        for (i = 0; i < N; i += 3) if (P[i][2] > 0) ctx.fillRect(P[i][0] - dpr, P[i][1] - dpr, 2 * dpr, 2 * dpr);

        // dashed orbit ring
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(-0.4 + Math.sin(t * 0.1) * 0.05);
        ctx.setLineDash([6 * dpr, 10 * dpr]); ctx.lineDashOffset = -t * 12 * dpr;
        ctx.strokeStyle = 'rgba(190,225,255,0.3)';
        ctx.beginPath(); ctx.ellipse(0, 0, R * 1.35, R * 0.45, 0, 0, 6.283); ctx.stroke();
        ctx.restore();

        // data pulses running along edges
        ctx.fillStyle = '#fff';
        pulses.forEach(function (p) {
            p.t += dt * p.v;
            if (p.t > 1) { p.t = 0; p.e = (Math.random() * edges.length) | 0; }
            var e = edges[p.e], a = P[e[0]], b = P[e[1]];
            ctx.fillRect(a[0] + (b[0] - a[0]) * p.t - 1.5 * dpr, a[1] + (b[1] - a[1]) * p.t - 1.5 * dpr, 3 * dpr, 3 * dpr);
        });
    }

    if (reduce) { draw(0, 0); return; }
    var last = performance.now(), t = 0;
    (function loop(now) {
        var dt = Math.min((now - last) / 1000, 0.05); last = now; t += dt;
        draw(t, dt);
        requestAnimationFrame(loop);
    })(last);
})();
