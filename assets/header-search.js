/**
 * Desktop header search field (snippets/search.liquid, style: 'bar').
 *
 * The field is the theme's predictive-search-component. Outside a dialog it opens its
 * results on focus but has nothing that closes them again, so this wrapper closes them
 * when focus or a click leaves the field, and on Escape.
 */
const EXPANDED = 'predictive-search--expanded';

class HeaderSearch extends HTMLElement {
  #controller = new AbortController();

  connectedCallback() {
    const { signal } = this.#controller;

    this.addEventListener('focusout', this.#onFocusOut, { signal });
    document.addEventListener('pointerdown', this.#onPointerDown, { signal });
    // Capture phase: runs before the component's own keydown handlers.
    this.addEventListener('keydown', this.#onKeyDown, { signal, capture: true });
  }

  disconnectedCallback() {
    this.#controller.abort();
  }

  get #component() {
    return this.querySelector('predictive-search-component');
  }

  get #input() {
    return /** @type {HTMLInputElement | null} */ (this.querySelector('input[type="search"]'));
  }

  #collapse() {
    const component = this.#component;
    if (!component) return;
    component.classList.remove(EXPANDED);
    this.#input?.setAttribute('aria-expanded', 'false');
  }

  #expand() {
    this.#input?.setAttribute('aria-expanded', 'true');
  }

  /** @param {FocusEvent} event */
  #onFocusOut = (event) => {
    const next = event.relatedTarget;
    if (next instanceof Node && this.contains(next)) return;
    this.#collapse();
  };

  /** @param {PointerEvent} event */
  #onPointerDown = (event) => {
    if (event.target instanceof Node && this.contains(event.target)) {
      this.#expand();
      return;
    }
    this.#collapse();
  };

  /** @param {KeyboardEvent} event */
  #onKeyDown = (event) => {
    const input = this.#input;

    if (event.key === 'Escape') {
      // Let the component clear the query, then close and leave focus on the field.
      requestAnimationFrame(() => this.#collapse());
      return;
    }

    if (event.key === 'Enter' && input) {
      // Same clean-up as the search overlay: send what was typed, without stray wildcards.
      const cleaned = input.value.replace(/\*+/g, ' ').replace(/\s+/g, ' ').trim();
      if (!cleaned) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      input.value = cleaned;
    }
  };
}

if (!customElements.get('header-search')) {
  customElements.define('header-search', HeaderSearch);
}
