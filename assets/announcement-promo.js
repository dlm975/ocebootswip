/**
 * Promotion announcement bar: a live countdown to the end date and a close
 * button that hides the bar for the rest of the browsing session.
 *
 * Markup comes from sections/header-announcements.liquid (layout: promo).
 */
const UNITS = /** @type {const} */ (['days', 'hours', 'minutes', 'seconds']);

class AnnouncementPromo extends HTMLElement {
  /** @type {number | undefined} */
  #timer;
  /** @type {number} */
  #end = NaN;
  /** @type {string} */
  #label = '';

  connectedCallback() {
    const countdown = this.querySelector('[data-end]');
    if (countdown instanceof HTMLElement) {
      this.#end = Date.parse(countdown.dataset.end ?? '');
      this.#label = this.querySelector('[data-countdown-label]')?.textContent?.trim() ?? '';

      if (Number.isNaN(this.#end)) {
        countdown.hidden = true;
      } else {
        this.#tick();
        this.#timer = window.setInterval(this.#tick, 1000);
      }
    }

    this.querySelector('[data-announcement-close]')?.addEventListener('click', this.#dismiss);
  }

  disconnectedCallback() {
    window.clearInterval(this.#timer);
    this.querySelector('[data-announcement-close]')?.removeEventListener('click', this.#dismiss);
  }

  get #section() {
    return document.getElementById(`shopify-section-${this.dataset.sectionId}`) ?? this.closest('.shopify-section');
  }

  #tick = () => {
    const countdown = this.querySelector('[data-end]');
    if (!(countdown instanceof HTMLElement)) return;

    const remaining = Math.max(0, this.#end - Date.now());
    const totalSeconds = Math.floor(remaining / 1000);
    const values = {
      days: Math.floor(totalSeconds / 86400),
      hours: Math.floor((totalSeconds % 86400) / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60,
    };

    for (const unit of UNITS) {
      const el = countdown.querySelector(`[data-unit="${unit}"]`);
      const text = String(values[unit]).padStart(2, '0');
      if (el && el.textContent !== text) el.textContent = text;
    }

    // Screen readers get words, not "01 : 02 : 49 : 11". role="timer" keeps this from being announced every second.
    const label = countdown.querySelector('[data-countdown-label]');
    if (label) {
      const spoken = `${this.#label} ${values.days} days, ${values.hours} hours, ${values.minutes} minutes`.trim();
      if (label.textContent !== spoken) label.textContent = spoken;
    }

    if (remaining === 0) {
      window.clearInterval(this.#timer);
      if (this.hasAttribute('data-hide-when-expired') && !this.hasAttribute('data-design-mode')) {
        const section = this.#section;
        if (section) section.style.display = 'none';
      } else {
        countdown.hidden = true;
      }
    }
  };

  #dismiss = () => {
    const section = this.#section;
    if (section) section.style.display = 'none';
    window.clearInterval(this.#timer);

    // In the theme editor the bar must stay editable, so the choice isn't remembered there.
    if (this.hasAttribute('data-design-mode')) return;
    try {
      sessionStorage.setItem(this.dataset.dismissKey ?? 'announcement-dismissed', '1');
    } catch {
      // Storage blocked (private mode): the bar still closes for this page.
    }

    // Keep focus somewhere sensible for keyboard users once the button disappears.
    const main = document.getElementById('MainContent') ?? document.querySelector('main');
    if (main instanceof HTMLElement) {
      if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: true });
    }
  };
}

if (!customElements.get('announcement-promo')) {
  customElements.define('announcement-promo', AnnouncementPromo);
}
