/*
  OCE Boots Glass: edge refraction.
  Bends the page behind the clear bezel of floating glass pieces, where the browser can apply an SVG
  filter to a backdrop (Chromium). Everywhere else it does nothing and oce-glass.css still draws the
  clear bezel, lines and plate. Only runs when <body> has the oce-glass class.
*/
(function () {
  if (!document.body || !document.body.classList.contains('oce-glass')) return;

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-transparency: reduce)').matches;
  var weak =
    (navigator.deviceMemory && navigator.deviceMemory < 4) ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4);
  var supported = /Chrom(e|ium)\//.test(navigator.userAgent) && !reduce && !weak;
  if (!supported) return;

  /* Floating and clear pieces only: these have page content passing behind them. */
  var SELECTOR = '.header__row--top, .announcement-bar, [class^="tlb-bar-"], .cc-nav';
  var MAX_AREA = 1600 * 200;
  var cache = {};
  var defs = null;
  var count = 0;

  function num(cs, name, fallback) {
    var v = parseFloat(cs.getPropertyValue(name));
    return isNaN(v) ? fallback : v;
  }

  function filterFor(w, h, r, bezel, scale, blur, spread) {
    var key = [w, h, r, bezel, scale, blur, spread].join('x');
    if (cache[key]) return cache[key];
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      defs.setAttribute('width', '0');
      defs.setAttribute('height', '0');
      defs.setAttribute('aria-hidden', 'true');
      defs.style.position = 'absolute';
      document.body.appendChild(defs);
    }
    /* Displacement map: inside the bezel, pull sampling inward along the rounded rectangle's edge normal. */
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    var ctx = c.getContext('2d');
    var im = ctx.createImageData(w, h);
    var d = im.data;
    for (var j = 0; j < h; j++) {
      for (var i = 0; i < w; i++) {
        var px = i + 0.5 - w / 2;
        var py = j + 0.5 - h / 2;
        var qx = Math.abs(px) - (w / 2 - r);
        var qy = Math.abs(py) - (h / 2 - r);
        var dist = -(Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r);
        var nx = 0;
        var ny = 0;
        var m = 0;
        if (qx > 0 && qy > 0) {
          var l = Math.hypot(qx, qy);
          nx = (qx / l) * Math.sign(px);
          ny = (qy / l) * Math.sign(py);
        } else if (qx > qy) {
          nx = Math.sign(px);
        } else {
          ny = Math.sign(py);
        }
        if (dist >= 0 && dist < bezel) {
          var t = 1 - dist / bezel;
          m = t * t;
        }
        var k = (j * w + i) * 4;
        d[k] = 128 - nx * m * 127;
        d[k + 1] = 128 - ny * m * 127;
        d[k + 2] = 128;
        d[k + 3] = 255;
      }
    }
    ctx.putImageData(im, 0, 0);

    var id = 'oce-glass-' + count++;
    function pass(s, matrix, name) {
      return (
        '<feDisplacementMap in="b" in2="map" scale="' + s + '" xChannelSelector="R" yChannelSelector="G" result="d' + name + '"/>' +
        '<feColorMatrix in="d' + name + '" type="matrix" values="' + matrix + '" result="' + name + '"/>'
      );
    }
    defs.insertAdjacentHTML(
      'beforeend',
      '<filter id="' + id + '" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
        '<feImage href="' + c.toDataURL() + '" x="0" y="0" width="' + w + '" height="' + h + '" result="map"/>' +
        '<feGaussianBlur in="SourceGraphic" stdDeviation="' + blur + '" result="b"/>' +
        pass(scale * (1 - spread), '1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0', 'r') +
        pass(scale, '0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0', 'g') +
        pass(scale * (1 + spread), '0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0', 'bl') +
        '<feBlend in="r" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="bl" mode="screen"/></filter>'
    );
    cache[key] = id;
    return id;
  }

  function apply(el) {
    var w = el.offsetWidth;
    var h = el.offsetHeight;
    if (!w || !h || w * h > MAX_AREA) return;
    var cs = getComputedStyle(el);
    var bezel = num(cs, '--bezel', 0);
    if (!bezel) return;
    bezel = Math.min(bezel, w / 2 - 1, h / 2 - 1);
    var r = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, w / 2, h / 2);
    var id = filterFor(
      w,
      h,
      Math.round(r),
      Math.round(bezel),
      Math.round(bezel * num(cs, '--refract-strength', 3.5)),
      num(cs, '--refract-blur', 2),
      num(cs, '--refract-dispersion', 0.1)
    );
    var value = 'url(#' + id + ')';
    if (el.dataset.oceGlass === value) return;
    el.dataset.oceGlass = value;
    el.style.webkitBackdropFilter = value;
    el.style.backdropFilter = value;
    el.classList.add('is-refracting');
  }

  function refresh(root) {
    (root || document).querySelectorAll(SELECTOR).forEach(apply);
  }

  window.OCE = window.OCE || {};
  window.OCE.glass = { supported: true, refresh: refresh };

  var timer;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(refresh, 150);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
  window.addEventListener('load', schedule);
  window.addEventListener('resize', schedule);
  document.addEventListener('shopify:section:load', schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
})();
