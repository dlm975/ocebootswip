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
    document.querySelectorAll('[data-wishlist-count]').forEach(function (count) {
      const text = items.length > 99 ? '99+' : String(items.length);
      if (count.textContent !== text) count.textContent = text;
      count.hidden = items.length === 0;
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

  document.addEventListener('click', function (event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('[data-wishlist-toggle]');
    if (!(button instanceof HTMLElement)) return;
    // Cards are links: the heart saves, it doesn't open the product
    event.preventDefault();
    event.stopPropagation();
    const saved = !has(button.dataset.handle || '');
    set(button.dataset.handle || '', saved);
    pop(button, saved);
    document.querySelectorAll('[data-wishlist-count]').forEach(bump);
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
