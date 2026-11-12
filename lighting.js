// Lightweight lighting: a soft glow follows the cursor (or finger) over
// anything clickable. CSS does the drawing; this only sets the position.
(function () {
    var targets = document.querySelectorAll('a, button, input, textarea');
    var releaseTimers = new WeakMap();

    function place(el, e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }

    targets.forEach(function (el) {
        el.classList.add('lit-target');

        el.addEventListener('pointerenter', function (e) {
            clearTimeout(releaseTimers.get(el));
            place(el, e);
            el.classList.add('lit');
        });
        el.addEventListener('pointermove', function (e) { place(el, e); });
        el.addEventListener('pointerleave', function () { el.classList.remove('lit'); });

        // Touch: keep the light on briefly after the finger lifts.
        el.addEventListener('pointerup', function (e) {
            if (e.pointerType === 'mouse') return;
            releaseTimers.set(el, setTimeout(function () { el.classList.remove('lit'); }, 350));
        });
        el.addEventListener('pointercancel', function () { el.classList.remove('lit'); });
    });
})();
