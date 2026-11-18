/**
 * Pinch to zoom on the product page's main images (touch screens).
 *
 * Two fingers zoom the photo in place, centred between them (up to 4x), and move it around while
 * held; lift one and the other carries on moving the zoomed photo (a second finger back down picks
 * the pinch up again). The photo can be pulled only a little past its own edges (a small margin, so a boot's toe
 * or heel at the very edge can be seen whole) and never further, so it can't be dragged off into
 * empty space. Lifting the last finger eases it back. One finger still swipes between photos and a tap still
 * opens the full-screen view; the page itself no longer zooms when pinching a photo.
 */
const MAX_SCALE = 4;
const EDGE_MARGIN = 24; // px of give past the photo's edges once zoomed
const EASE = 'cubic-bezier(0.3, 0.7, 0.3, 1)';

const distance = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
const midpoint = (a, b) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function setUp(gallery) {
  if (gallery.dataset.pinchZoom) return;
  gallery.dataset.pinchZoom = '1';

  let active = null; // { slide, target, box, startDistance, startMid, startScale, startX, startY, scale, x, y }
  let suppressClick = false;

  const targetOf = (slide) => slide.querySelector('.product-media') || slide.querySelector('img');

  const apply = (state, animate) => {
    const { target, scale, x, y } = state;
    target.style.transition = animate ? `transform 0.45s ${EASE}` : 'none';
    target.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  };

  /** Keep the photo within its box, allowing a small margin past each edge */
  const bound = (state) => {
    const { box, scale } = state;
    const give = EDGE_MARGIN * clamp((scale - 1) / 0.5, 0, 1);
    const minX = box.width - box.width * scale - give;
    const minY = box.height - box.height * scale - give;
    state.x = clamp(state.x, minX, give);
    state.y = clamp(state.y, minY, give);
  };

  /** (Re)start a pinch from the photo's current zoom and position */
  const pinchFrom = (state, a, b) => {
    const mid = midpoint(a, b);
    state.mode = 'pinch';
    state.startDistance = distance(a, b) || 1;
    state.startMid = { x: mid.x - state.box.left, y: mid.y - state.box.top };
    state.startScale = state.scale;
    state.startX = state.x;
    state.startY = state.y;
  };

  /** Carry on with one finger: the zoomed photo follows it */
  const panFrom = (state, touch) => {
    state.mode = 'pan';
    state.panStart = { x: touch.clientX, y: touch.clientY };
    state.startX = state.x;
    state.startY = state.y;
  };

  const begin = (event) => {
    const slide = event.target.closest('slideshow-slide, .product-media-container');
    const target = slide && targetOf(slide);
    if (!target) return;
    const [a, b] = event.touches;
    target.style.transformOrigin = '0 0';
    target.style.willChange = 'transform';
    slide.classList.add('is-pinching');
    active = { slide, target, box: slide.getBoundingClientRect(), scale: 1, x: 0, y: 0 };
    pinchFrom(active, a, b);
  };

  const move = (event) => {
    if (!active) return;
    event.preventDefault();
    if (event.touches.length >= 2 && active.mode === 'pinch') {
      const [a, b] = event.touches;
      const { box, startDistance, startMid, startScale, startX, startY } = active;
      const mid = midpoint(a, b);
      const now = { x: mid.x - box.left, y: mid.y - box.top };
      const scale = clamp((startScale * distance(a, b)) / startDistance, 1, MAX_SCALE);
      // The point of the photo first held between the fingers stays between them
      const px = (startMid.x - startX) / startScale;
      const py = (startMid.y - startY) / startScale;
      active.scale = scale;
      active.x = now.x - px * scale;
      active.y = now.y - py * scale;
    } else if (event.touches.length === 1 && active.mode === 'pan') {
      const touch = event.touches[0];
      active.x = active.startX + (touch.clientX - active.panStart.x);
      active.y = active.startY + (touch.clientY - active.panStart.y);
    } else {
      return;
    }
    bound(active);
    apply(active, false);
    suppressClick = true;
  };

  const end = (event) => {
    if (!active) return;
    if (event.touches.length >= 2) {
      const [a, b] = event.touches;
      pinchFrom(active, a, b);
      return;
    }
    if (event.touches.length === 1) {
      // One finger lifted: the zoom holds and the other finger moves the photo
      panFrom(active, event.touches[0]);
      return;
    }
    const state = active;
    active = null;
    state.scale = 1;
    state.x = 0;
    state.y = 0;
    apply(state, !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const done = () => {
      if (active && active.target === state.target) return;
      state.target.style.removeProperty('transform');
      state.target.style.removeProperty('transition');
      state.target.style.removeProperty('will-change');
      state.target.style.removeProperty('transform-origin');
      state.slide.classList.remove('is-pinching');
    };
    setTimeout(done, 480);
    // The lift of the last finger isn't a tap: don't open the full-screen view
    setTimeout(() => (suppressClick = false), 400);
  };

  gallery.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length < 2) return;
      event.preventDefault();
      // A second finger back down during a one-finger move picks the pinch up again
      if (active) pinchFrom(active, event.touches[0], event.touches[1]);
      else begin(event);
    },
    { passive: false }
  );
  gallery.addEventListener('touchmove', move, { passive: false });
  gallery.addEventListener('touchend', end);
  gallery.addEventListener('touchcancel', end);
  gallery.addEventListener(
    'click',
    (event) => {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true
  );
}

function init() {
  document.querySelectorAll('.product-information__media media-gallery').forEach(setUp);
}

init();
// The gallery is redrawn when another size or colour is chosen
let queued = 0;
new MutationObserver(() => {
  if (queued) return;
  queued = requestAnimationFrame(() => {
    queued = 0;
    init();
  });
}).observe(document.querySelector('.product-information') || document.body, { childList: true, subtree: true });
