import { Component } from '@theme/component';
import { trapFocus, removeTrapFocus } from '@theme/focus';
import { onAnimationEnd } from '@theme/utilities';

/**
 * A custom element that manages the main menu drawer.
 *
 * @typedef {object} Refs
 * @property {HTMLDetailsElement} details - The details element.
 *
 * @extends {Component<Refs>}
 */
/** Timing for the menu items sliding in and out */
const RETURN_TIMING = { duration: 550, easing: 'cubic-bezier(0.3, 0.7, 0.3, 1)' };

class HeaderDrawer extends Component {
  requiredRefs = ['details'];

  connectedCallback() {
    super.connectedCallback();

    this.addEventListener('keyup', this.#onKeyUp);
    this.#setupAnimatedElementListeners();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('keyup', this.#onKeyUp);
  }

  /**
   * Close the main menu drawer when the Escape key is pressed
   * @param {KeyboardEvent} event
   */
  #onKeyUp = (event) => {
    if (event.key !== 'Escape') return;

    this.#close(this.#getDetailsElement(event));
  };

  /**
   * @returns {boolean} Whether the main menu drawer is open
   */
  get isOpen() {
    return this.refs.details.hasAttribute('open');
  }

  /**
   * Get the closest details element to the event target
   * @param {Event | undefined} event
   * @returns {HTMLDetailsElement}
   */
  #getDetailsElement(event) {
    if (!(event?.target instanceof Element)) return this.refs.details;

    return event.target.closest('details') ?? this.refs.details;
  }

  /**
   * Toggle the main menu drawer
   */
  toggle() {
    return this.isOpen ? this.close() : this.open();
  }

  /**
   * Open the closest drawer or the main menu drawer
   * @param {Event} [event]
   */
  open(event) {
    const details = this.#getDetailsElement(event);
    const summary = details.querySelector('summary');

    if (!summary) return;

    summary.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => details.classList.add('menu-open'));

    trapFocus(details);
  }

  /**
   * Open a menu item in place, or close it if it's already open (its row shows an X while open).
   * Opening hides the other items and slides its title up to the top; closing slides the items
   * above back down from the top of the menu and those below up from the bottom.
   * @param {Event} event
   */
  toggleSubmenu(event) {
    const details = this.#getDetailsElement(event);
    if (!details) return;
    const summary = details.querySelector('summary');
    const before = summary?.getBoundingClientRect().top ?? 0;

    if (details.hasAttribute('open')) {
      event.preventDefault();
      details.addEventListener('toggle', () => this.#revealSiblings(details, before), { once: true });
      this.#close(details);
    } else {
      this.open(event);
      // The details opens after this click, which hides the other items: slide the title from where it was
      requestAnimationFrame(() => {
        if (!summary || this.#reducedMotion) return;
        const shift = before - summary.getBoundingClientRect().top;
        if (shift) summary.animate([{ transform: `translateY(${shift}px)` }, { transform: 'none' }], RETURN_TIMING);
      });
    }
  }

  get #reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * After a menu item closes, its siblings reappear: those above slide down from the top of the
   * menu, those below slide up from its bottom, and the item's title slides back into place.
   * @param {HTMLDetailsElement} details
   * @param {number} titleTop - Where the item's title was while open
   */
  #revealSiblings(details, titleTop) {
    const item = details.closest('li');
    const container = details.closest('.menu-drawer');
    if (!item?.parentElement || !container || this.#reducedMotion) return;

    const box = container.getBoundingClientRect();
    const summary = details.querySelector('summary');
    if (summary) {
      const shift = titleTop - summary.getBoundingClientRect().top;
      if (shift) summary.animate([{ transform: `translateY(${shift}px)` }, { transform: 'none' }], RETURN_TIMING);
    }

    const siblings = [...item.parentElement.children].filter((el) => el instanceof HTMLElement);
    const index = siblings.indexOf(item);
    siblings.forEach((el, i) => {
      if (el === item) return;
      const rect = el.getBoundingClientRect();
      const from = i < index ? box.top - rect.bottom : box.bottom - rect.top;
      const distance = Math.abs(i - index) - 1;
      el.animate([{ transform: `translateY(${from}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], {
        ...RETURN_TIMING,
        delay: distance * 50,
        fill: 'backwards',
      });
    });
  }

  /**
   * Go back or close the main menu drawer
   * @param {Event} [event]
   */
  back(event) {
    this.#close(this.#getDetailsElement(event));
  }

  /**
   * Close the main menu drawer
   */
  close() {
    this.#close(this.refs.details);
  }

  /**
   * Close the closest menu or submenu that is open
   *
   * @param {HTMLDetailsElement} details
   */
  #close(details) {
    const summary = details.querySelector('summary');

    if (!summary) return;

    summary.setAttribute('aria-expanded', 'false');
    details.classList.remove('menu-open');

    onAnimationEnd(details, () => {
      reset(details);

      if (details === this.refs.details) {
        removeTrapFocus();
        const openDetails = this.querySelectorAll('details[open]');
        openDetails.forEach(reset);
      } else {
        trapFocus(this.refs.details);
      }
    });
  }

  /**
   * Attach animationend event listeners to all animated elements to remove will-change after animation
   * to remove the stacking context and allow submenus to be positioned correctly
   */
  #setupAnimatedElementListeners() {
    /**
     * @param {AnimationEvent} event
     */
    function removeWillChangeOnAnimationEnd(event) {
      const target = event.target;
      if (target && target instanceof HTMLElement) {
        target.style.setProperty('will-change', 'unset');
        target.removeEventListener('animationend', removeWillChangeOnAnimationEnd);
      }
    }
    const allAnimated = this.querySelectorAll('.menu-drawer__animated-element');
    allAnimated.forEach((element) => {
      element.addEventListener('animationend', removeWillChangeOnAnimationEnd);
    });
  }
}

if (!customElements.get('header-drawer')) {
  customElements.define('header-drawer', HeaderDrawer);
}

/**
 * Reset an open details element to its original state
 *
 * @param {HTMLDetailsElement} element
 */
function reset(element) {
  element.classList.remove('menu-open');
  element.removeAttribute('open');
  element.querySelector('summary')?.setAttribute('aria-expanded', 'false');
}
