/**
 * Shop by Size: size systems (US / UK / EU) opening their sizes (snippets/size-drill-menu.liquid).
 *
 * Desktop (hover devices): pointing at a system opens its sizes; they stay open while the pointer
 * crosses to them, and the menu resets when the pointer leaves it.
 * Touch and keyboard: a tap / Enter opens a system; doing it again on the open system closes it.
 * Escape closes. In the drawer the sizes area eases between heights as systems open, switch and
 * close, so the menu grows and shrinks smoothly (same timing as the drawer's own animations).
 */
const canHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TIMING = { duration: 550, easing: 'cubic-bezier(0.3, 0.7, 0.3, 1)' };

class SizeDrillMenu extends HTMLElement {
  #controller = new AbortController();
  /** @type {Animation | null} */
  #heightAnimation = null;

  connectedCallback() {
    const { signal } = this.#controller;

    this.addEventListener('pointerover', this.#onPointerOver, { signal });
    this.addEventListener('pointerleave', this.#onPointerLeave, { signal });
    this.addEventListener('click', this.#onClick, { signal });
    this.addEventListener('keydown', this.#onKeyDown, { signal });
  }

  disconnectedCallback() {
    this.#controller.abort();
  }

  get #isDrawer() {
    return this.classList.contains('size-drill--drawer');
  }

  get #panels() {
    return this.querySelector('.size-drill__panels');
  }

  /** @returns {HTMLButtonElement | null} */
  get #activeButton() {
    return this.querySelector('[data-size-system][aria-expanded="true"]');
  }

  /**
   * Open a system's sizes, or close them all (null)
   * @param {Element | null} button
   */
  #activate(button) {
    if (button === this.#activeButton) return;

    const panels = this.#panels;
    const animate = this.#isDrawer && panels instanceof HTMLElement && !reducedMotion();
    const closing = !button;

    // Where the sizes area is right now, mid-animation included
    const from = animate ? panels.getBoundingClientRect().height : 0;
    this.#heightAnimation?.cancel();
    this.#heightAnimation = null;

    // Closing in the drawer: keep the open sizes in place while the area folds away and they fade
    const leaving = closing && animate ? this.#openPanel : null;

    for (const systemButton of this.querySelectorAll('[data-size-system]')) {
      const active = systemButton === button;
      systemButton.setAttribute('aria-expanded', String(active));
      const panel = this.querySelector(`#${CSS.escape(systemButton.getAttribute('aria-controls') ?? '')}`);
      if (panel instanceof HTMLElement && panel !== leaving) panel.hidden = !active;
    }
    if (button) this.setAttribute('data-active', '');
    else this.removeAttribute('data-active');

    if (!animate) return;

    const to = leaving ? 0 : panels.getBoundingClientRect().height;
    if (Math.abs(to - from) < 1) {
      if (leaving) leaving.hidden = true;
      return;
    }

    if (leaving) {
      leaving.getAnimations().forEach((animation) => animation.cancel());
      leaving.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, easing: 'ease-out', fill: 'forwards' });
    }

    const animation = panels.animate([{ height: `${from}px` }, { height: `${to}px` }], TIMING);
    this.#heightAnimation = animation;
    animation.finished.then(
      () => {
        if (leaving && !this.#activeButton) leaving.hidden = true;
        leaving?.getAnimations().forEach((fade) => fade.cancel());
        this.#heightAnimation = null;
      },
      () => {
        // Cancelled by a newer change: that change has already set which sizes show
        leaving?.getAnimations().forEach((fade) => fade.cancel());
        if (leaving && leaving.id !== this.#activeButton?.getAttribute('aria-controls')) leaving.hidden = true;
      }
    );
  }

  /** @returns {HTMLElement | null} */
  get #openPanel() {
    const id = this.#activeButton?.getAttribute('aria-controls');
    const panel = id ? this.querySelector(`#${CSS.escape(id)}`) : null;
    return panel instanceof HTMLElement ? panel : null;
  }

  /** @param {PointerEvent} event */
  #onPointerOver = (event) => {
    if (event.pointerType !== 'mouse' || !canHover() || this.#isDrawer) return;
    const button = /** @type {Element} */ (event.target).closest?.('[data-size-system]');
    if (button) this.#activate(button);
  };

  /** @param {PointerEvent} event */
  #onPointerLeave = (event) => {
    if (event.pointerType !== 'mouse' || !canHover() || this.#isDrawer) return;
    this.#activate(null);
  };

  /** @param {MouseEvent} event */
  #onClick = (event) => {
    const button = /** @type {Element} */ (event.target).closest?.('[data-size-system]');
    if (!button) return;
    const isOpen = button.getAttribute('aria-expanded') === 'true';
    // With a mouse on desktop, pointing already opened it; a click there keeps it open
    if (isOpen && !this.#isDrawer && event.detail > 0 && canHover()) return;
    this.#activate(isOpen ? null : button);
  };

  /** @param {KeyboardEvent} event */
  #onKeyDown = (event) => {
    if (event.key !== 'Escape' || !this.hasAttribute('data-active')) return;
    // Escape closes the sizes first, not the whole menu
    event.stopPropagation();
    const button = this.#activeButton;
    this.#activate(null);
    button?.focus();
  };
}

if (!customElements.get('size-drill-menu')) {
  customElements.define('size-drill-menu', SizeDrillMenu);
}
