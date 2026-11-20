/**
 * Wishlist, kept in this browser (localStorage), newest first, as product handles.
 *
 * - Heart buttons anywhere ([data-wishlist-toggle] with data-handle, snippets/wishlist-button.liquid)
 *   save or remove their product, and show whether it's saved (aria-pressed).
 * - Counts ([data-wishlist-count], the header heart) show how many are saved.
 * - The wishlist page (sections/wishlist.liquid) listens for 'oce-wishlist:change'.
 *
 * Buttons added later (filters, infinite scroll, the search overlay) are picked up as they appear,
 * and other tabs stay in step through the storage event.
 */
(function () {
  if (window.OceWishlist) return;

  const KEY = 'oce-wishlist';
  const POP = { duration: 420, easing: 'cubic-bezier(0.3, 0.7, 0.3, 1)' };
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** @returns {string[]} */
  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(value) ? value.filter((handle) => typeof handle === 'string' && handle) : [];
    } catch (e) {
      return [];
    }
  }

  let items = read();

  function write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch (e) {
      /* storage unavailable: the wishlist lasts for this page only */
    }
  }

  const has = (handle) => items.includes(handle);

  /** @param {string} handle @param {boolean} saved */
  function set(handle, saved) {
    if (!handle || has(handle) === saved) return;
    items = items.filter((item) => item !== handle);
    if (saved) items.unshift(handle);
    write();
    sync(document);
    document.dispatchEvent(new CustomEvent('oce-wishlist:change', { detail: { handle, saved, items: items.slice() } }));
  }

  /** @param {ParentNode} root */
  function sync(root) {
    root.querySelectorAll('[data-wishlist-toggle]').forEach(function (button) {
      const saved = has(button.dataset.handle || '');
      if (button.getAttribute('aria-pressed') === String(saved)) return;
      button.setAttribute('aria-pressed', String(saved));
      const title = button.dataset.title || 'this product';
      button.setAttribute('aria-label', saved ? 'Remove ' + title + ' from wishlist' : 'Save ' + title + ' to wishlist');
    });
    // Hearts still flying to the header aren't counted until they land
    const shown = Math.max(0, items.length - flights.size);
    document.querySelectorAll('[data-wishlist-count]').forEach(function (count) {
      const text = shown > 99 ? '99+' : String(shown);
      if (count.textContent !== text) count.textContent = text;
      count.hidden = shown === 0;
    });
  }

  /** The heart pops when saved and gives a little when removed */
  function pop(button, saved) {
    if (reducedMotion()) return;
    const icon = button.querySelector('.wishlist-toggle__icon') || button;
    icon.animate(
      saved
        ? [{ transform: 'scale(1)' }, { transform: 'scale(1.28)', offset: 0.35 }, { transform: 'scale(1)' }]
        : [{ transform: 'scale(1)' }, { transform: 'scale(0.82)', offset: 0.4 }, { transform: 'scale(1)' }],
      POP
    );
  }

  function bump(count) {
    if (reducedMotion() || count.hidden) return;
    count.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)', offset: 0.35 }, { transform: 'scale(1)' }], POP);
  }

  // ── Saved hearts fly up to the header heart (Motion, motion.dev) ──
  /** @type {any} */
  let motion = null;
  import('motion')
    .then(function (module) {
      motion = module;
    })
    .catch(function () {
      /* no flight: saving still works and the count still updates */
    });

  /** @type {Map<string, { ghost: HTMLElement, controls: any }>} */
  const flights = new Map();
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /** The header heart, if it's on screen */
  function headerHeart() {
    const link = Array.from(document.querySelectorAll('.wishlist-link')).find((el) => el.getClientRects().length);
    if (!link) return null;
    const icon = link.querySelector('.wishlist-link__icon') || link;
    const rect = icon.getBoundingClientRect();
    if (!rect.width || rect.bottom <= 0 || rect.top >= window.innerHeight) return null;
    return { icon: icon, rect: rect };
  }

  /**
   * A red heart lifts off the button and arcs up into the header heart, shrinking to its size.
   * @returns {boolean} Whether a heart is flying
   */
  function fly(button, handle) {
    if (!motion || reducedMotion() || flights.has(handle)) return false;
    const target = headerHeart();
    const source = button.querySelector('.wishlist-toggle__icon') || button;
    const filled = button.querySelector('.wishlist-toggle__heart--filled');
    if (!target || !filled) return false;

    const from = source.getBoundingClientRect();
    const ghost = document.createElement('span');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.cssText =
      'position:fixed;left:' + from.left + 'px;top:' + from.top + 'px;width:' + from.width + 'px;height:' +
      from.height + 'px;z-index:2147483000;pointer-events:none;color:#e8323c;will-change:transform,opacity;';
    const heart = filled.cloneNode(true);
    heart.removeAttribute('class');
    heart.setAttribute('style', 'display:block;width:100%;height:100%;');
    ghost.append(heart);
    document.body.append(ghost);

    // A curve from the button to the header heart: up and over, never dipping below the start
    const dx = target.rect.left + target.rect.width / 2 - (from.left + from.width / 2);
    const dy = target.rect.top + target.rect.height / 2 - (from.top + from.height / 2);
    const lift = Math.min(160, Math.max(56, Math.abs(dy) * 0.3));
    const cx = dx * 0.2;
    const cy = Math.min(0, dy) - lift;
    const endScale = target.rect.width / from.width;
    const steps = 30;
    const transform = [];
    const opacity = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const e = easeInOut(t);
      const x = 2 * (1 - e) * e * cx + e * e * dx;
      const y = 2 * (1 - e) * e * cy + e * e * dy;
      // A quick swell as it lifts off, then it shrinks into the header heart
      const scale = t < 0.16 ? 1 + 0.3 * (t / 0.16) : 1.3 + (endScale - 1.3) * ((t - 0.16) / 0.84);
      transform.push('translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + scale.toFixed(3) + ')');
      opacity.push(t < 0.88 ? 1 : Math.max(0, 1 - (t - 0.88) / 0.12));
    }

    const controls = motion.animate(ghost, { transform: transform, opacity: opacity }, { duration: 0.8, ease: 'linear' });
    flights.set(handle, { ghost: ghost, controls: controls });
    Promise.resolve(controls).then(
      function () {
        land(handle);
      },
      function () {
        land(handle);
      }
    );
    return true;
  }

  /** The heart arrives: the header heart pops on a spring and the count goes up */
  function land(handle) {
    const flight = flights.get(handle);
    if (!flight) return;
    flights.delete(handle);
    flight.ghost.remove();
    sync(document);
    const target = headerHeart();
    if (target && motion) {
      motion
        .animate(target.icon, { transform: ['scale(1)', 'scale(1.3)'] }, { duration: 0.12, ease: [0.3, 0.7, 0.3, 1] })
        .then(function () {
          motion.animate(target.icon, { transform: ['scale(1.3)', 'scale(1)'] }, { type: motion.spring, bounce: 0.5, visualDuration: 0.35 });
        });
    }
    document.querySelectorAll('[data-wishlist-count]').forEach(bump);
  }

  /** Unsaved mid-flight: the flying heart fades where it is */
  function cancelFlight(handle) {
    const flight = flights.get(handle);
    if (!flight) return;
    flights.delete(handle);
    if (flight.controls && flight.controls.pause) flight.controls.pause();
    const ghost = flight.ghost;
    const fade = ghost.animate([{ opacity: getComputedStyle(ghost).opacity }, { opacity: 0 }], { duration: 180, easing: 'ease-out', fill: 'forwards' });
    fade.finished.then(
      function () {
        ghost.remove();
      },
      function () {
        ghost.remove();
      }
    );
  }

  document.addEventListener('click', function (event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('[data-wishlist-toggle]');
    if (!(button instanceof HTMLElement)) return;
    // Cards are links: the heart saves, it doesn't open the product
    event.preventDefault();
    event.stopPropagation();
    const handle = button.dataset.handle || '';
    const saved = !has(handle);
    // The flight starts first, so the count waits for it to land
    const flying = saved ? fly(button, handle) : false;
    if (!saved) cancelFlight(handle);
    set(handle, saved);
    pop(button, saved);
    if (!flying) document.querySelectorAll('[data-wishlist-count]').forEach(bump);
  });

  window.addEventListener('storage', function (event) {
    if (event.key !== KEY) return;
    items = read();
    sync(document);
    document.dispatchEvent(new CustomEvent('oce-wishlist:change', { detail: { items: items.slice() } }));
  });

  // Hearts rendered later (filtered grids, more products, search results) show their state at once
  let queued = false;
  new MutationObserver(function () {
    if (queued) return;
    queued = true;
    queueMicrotask(function () {
      queued = false;
      sync(document);
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  sync(document);
  // Saved hearts are drawn filled straight away; only later changes animate
  requestAnimationFrame(function () {
    document.documentElement.dataset.wishlistReady = '';
  });

  window.OceWishlist = {
    items: () => items.slice(),
    has: has,
    set: set,
  };
})();
