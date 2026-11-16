/**
 * Brand list with drill-down models (snippets/brand-drill-menu.liquid).
 *
 * Desktop (hover devices): pointing at a brand makes it active; it stays active while the pointer
 * crosses to its models, and the menu resets when the pointer leaves it.
 * Touch: the first tap on a brand opens its models; a second tap follows the brand's link.
 * Keyboard: focusing a brand opens its models; Escape closes them.
 */
const canHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

class BrandDrillMenu extends HTMLElement {
  #controller = new AbortController();

  connectedCallback() {
    const { signal } = this.#controller;

    this.addEventListener('pointerover', this.#onPointerOver, { signal });
    this.addEventListener('pointerleave', this.#onPointerLeave, { signal });
    this.addEventListener('click', this.#onClick, { signal });
    this.addEventListener('focusin', this.#onFocusIn, { signal });
    this.addEventListener('keydown', this.#onKeyDown, { signal });
  }

  disconnectedCallback() {
    this.#controller.abort();
  }

  /** @param {Element | null} brandItem */
  #activate(brandItem) {
    for (const item of this.querySelectorAll('.brand-drill__brand')) {
      const active = item === brandItem;
      item.classList.toggle('is-active', active);
      item.querySelector('[data-brand-drill-brand]')?.setAttribute('aria-expanded', String(active && !!item.querySelector('.brand-drill__models')));
    }
    if (brandItem) this.setAttribute('data-active', '');
    else this.removeAttribute('data-active');
  }

  /** @param {PointerEvent} event */
  #onPointerOver = (event) => {
    if (event.pointerType !== 'mouse' || !canHover()) return;
    const brand = /** @type {Element} */ (event.target).closest?.('[data-brand-drill-brand]');
    if (brand) this.#activate(brand.closest('.brand-drill__brand'));
  };

  /** @param {PointerEvent} event */
  #onPointerLeave = (event) => {
    if (event.pointerType !== 'mouse' || !canHover()) return;
    this.#activate(null);
  };

  /** @param {MouseEvent} event */
  #onClick = (event) => {
    const brand = /** @type {Element} */ (event.target).closest?.('[data-brand-drill-brand]');
    if (!brand) return;
    const item = brand.closest('.brand-drill__brand');
    if (!item?.querySelector('.brand-drill__models')) return;
    // Without hover, the first tap opens the brand's models; a tap on the open brand follows its link.
    if (!item.classList.contains('is-active')) {
      event.preventDefault();
      this.#activate(item);
    }
  };

  /** @param {FocusEvent} event */
  #onFocusIn = (event) => {
    const brand = /** @type {Element} */ (event.target).closest?.('[data-brand-drill-brand]');
    if (brand && event.target instanceof HTMLElement && event.target.matches(':focus-visible')) {
      this.#activate(brand.closest('.brand-drill__brand'));
    }
  };

  /** @param {KeyboardEvent} event */
  #onKeyDown = (event) => {
    if (event.key === 'Escape' && this.hasAttribute('data-active')) {
      const active = this.querySelector('.brand-drill__brand.is-active [data-brand-drill-brand]');
      this.#activate(null);
      if (active instanceof HTMLElement) active.focus();
    }
  };
}

if (!customElements.get('brand-drill-menu')) {
  customElements.define('brand-drill-menu', BrandDrillMenu);
}
