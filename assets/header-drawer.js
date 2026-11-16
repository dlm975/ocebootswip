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
    if (!summary) return;

    if (details.hasAttribute('open')) {
      event.preventDefault();
      this.#closeInPlace(details, summary);
      return;
    }

    // Opening: open the details here rather than natively after the click, so the other items
    // hiding, the title sliding up from where it was and the panel easing to its new height all
    // start in the same frame.
    event.preventDefault();
    const titleTop = summary.getBoundingClientRect().top;
    const panel = details.closest('.menu-drawer');
    const panelHeight = panel?.getBoundingClientRect().height ?? 0;
    details.setAttribute('open', '');
    this.open(event);
    if (this.#reducedMotion) return;
    this.#slide(summary, titleTop - summary.getBoundingClientRect().top);
    this.#easeHeight(panel, panelHeight);
  }

  get #reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Close an open menu item: its sub items fade out, then in one step (so no frame is painted
   * halfway) the details closes and the other items, the title and the panel height are animated
   * back from where they appear to be.
   * @param {HTMLDetailsElement} details
   * @param {HTMLElement} summary
   */
  async #closeInPlace(details, summary) {
    if (details.dataset.closing) return;
    details.dataset.closing = 'true';

    summary.setAttribute('aria-expanded', 'false');
    details.classList.remove('menu-open');
    await onAnimationEnd(details);

    const panel = details.closest('.menu-drawer');
    const titleTop = summary.getBoundingClientRect().top;
    const panelHeight = panel?.getBoundingClientRect().height ?? 0;

    details.removeAttribute('open');
    delete details.dataset.closing;
    trapFocus(this.refs.details);

    this.#revealSiblings(details, summary, titleTop, panel, panelHeight);
  }

  /**
   * Siblings reappear: those above slide down from the top of the panel, those below slide up
   * from its bottom, the item's title slides back into place and the panel grows smoothly.
   * Runs in the same task as the details closing, so the new layout is never painted unanimated.
   * @param {HTMLDetailsElement} details
   * @param {HTMLElement} summary
   * @param {number} titleTop - Where the item's title was while open
   * @param {Element | null} panel - The drawer panel
   * @param {number} panelHeight - The panel's height while the item was open
   */
  #revealSiblings(details, summary, titleTop, panel, panelHeight) {
    const item = details.closest('li');
    if (!item?.parentElement) return;

    // Reappearing items would replay the drawer's opening fade (menu-drawer-nav-open); skip it
    for (const animation of item.parentElement.getAnimations({ subtree: true })) {
      if (animation instanceof CSSAnimation && animation.animationName === 'menu-drawer-nav-open') animation.finish();
    }

    if (this.#reducedMotion || !panel) return;

    const box = panel.getBoundingClientRect();
    this.#slide(summary, titleTop - summary.getBoundingClientRect().top);
    this.#easeHeight(panel, panelHeight);

    const siblings = [...item.parentElement.children].filter((el) => el instanceof HTMLElement);
    const index = siblings.indexOf(item);
    siblings.forEach((el, i) => {
      if (el === item) return;
      const rect = el.getBoundingClientRect();
      const from = i < index ? box.top - rect.bottom : box.bottom - rect.top;
      const distance = Math.abs(i - index) - 1;
      el.animate([{ transform: `translateY(${from}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], {
        ...RETURN_TIMING,
        delay: distance * 40,
        fill: 'backwards',
      });
    });
  }

  /**
   * Animate an element from a vertical offset back to its place
   * @param {Element} element
   * @param {number} offset
   */
  #slide(element, offset) {
    if (Math.abs(offset) < 1) return;
    element.animate([{ transform: `translateY(${offset}px)` }, { transform: 'none' }], RETURN_TIMING);
  }

  /**
   * Ease the drawer panel from its previous height to its new one instead of jumping
   * @param {Element | null} panel
   * @param {number} from - Previous height in px
   */
  #easeHeight(panel, from) {
    if (!(panel instanceof HTMLElement)) return;
    const to = panel.getBoundingClientRect().height;
    if (Math.abs(to - from) < 1) return;
    panel.style.overflow = 'hidden';
    const animation = panel.animate([{ height: `${from}px` }, { height: `${to}px` }], RETURN_TIMING);
    const done = () => panel.style.removeProperty('overflow');
    animation.finished.then(done, done);
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
