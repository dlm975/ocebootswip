import { sectionRenderer } from '@theme/section-renderer';
import { Component } from '@theme/component';
import { FilterUpdateEvent, ThemeEvents } from '@theme/events';
import { debounce, formatMoney, startViewTransition } from '@theme/utilities';

/**
 * Search query parameter.
 * @type {string}
 */
const SEARCH_QUERY = 'q';

/**
 * Handles the main facets form functionality
 *
 * @typedef {Object} FacetsFormRefs
 * @property {HTMLFormElement} facetsForm - The main facets form element
 * @property {HTMLElement | undefined} facetStatus - The facet status element
 *
 * @extends {Component<FacetsFormRefs>}
 */
/**
 * The address bar shows a short form of the size filter (snippets/collection-in-stock-default.liquid).
 * These convert between it and Shopify's full parameters; without that snippet they change nothing.
 * @param {string | URL} url
 * @returns {URL}
 */
const expandFilterURL = (url) =>
  /** @type {any} */ (window).OceFilterUrl?.expand(url) ?? new URL(String(url), window.location.href);

/**
 * @param {string | URL} url
 * @returns {string}
 */
const compactFilterURL = (url) =>
  (/** @type {any} */ (window).OceFilterUrl?.compact(url) ?? new URL(String(url), window.location.href)).toString();

/**
 * The collection's (or search's) own sort order, as rendered on the sort dropdown.
 * @param {Element} element - Any element inside the results section
 * @returns {string | undefined}
 */
function getDefaultSortBy(element) {
  const source = element.closest('.shopify-section')?.querySelector('[data-default-sort-by]');
  return source instanceof HTMLElement ? source.dataset.defaultSortBy : undefined;
}

class FacetsFormComponent extends Component {
  requiredRefs = ['facetsForm'];

  /**
   * Creates URL parameters from form data
   * @param {FormData} [formData] - Optional form data to use instead of the main form
   * @returns {URLSearchParams} The processed URL parameters
   */
  createURLParameters(formData = new FormData(this.refs.facetsForm)) {
    let newParameters = new URLSearchParams(/** @type any */ (formData));

    if (newParameters.get('filter.v.price.gte') === '') newParameters.delete('filter.v.price.gte');
    if (newParameters.get('filter.v.price.lte') === '') newParameters.delete('filter.v.price.lte');

    newParameters.delete('page');

    // Keep links short: the grid view switch is not a filter, and the default sort order needs no parameter.
    newParameters.delete('grid');
    newParameters.delete('grid-mobile');
    if (newParameters.get('sort_by') === getDefaultSortBy(this)) newParameters.delete('sort_by');

    const searchQuery = this.#getSearchQuery();
    if (searchQuery) newParameters.set(SEARCH_QUERY, searchQuery);

    return newParameters;
  }

  /**
   * Gets the search query parameter from the current URL
   * @returns {string} The search query
   */
  #getSearchQuery() {
    const url = new URL(window.location.href);
    return url.searchParams.get(SEARCH_QUERY) ?? '';
  }

  get sectionId() {
    const id = this.getAttribute('section-id');
    if (!id) throw new Error('Section ID is required');
    return id;
  }

  /**
   * Updates the URL hash with current filter parameters
   */
  #updateURLHash() {
    const url = new URL(window.location.href);
    const urlParameters = this.createURLParameters();

    url.search = '';
    for (const [param, value] of urlParameters.entries()) {
      url.searchParams.append(param, value);
    }

    history.pushState({ urlParameters: urlParameters.toString() }, '', compactFilterURL(url));
  }

  /**
   * Updates filters and renders the section
   */
  updateFilters = () => {
    this.#updateURLHash();
    this.dispatchEvent(new FilterUpdateEvent(this.createURLParameters()));
    this.#updateSection();
  };

  /**
   * Updates the section
   */
  #updateSection() {
    const viewTransition = !this.closest('dialog');

    if (viewTransition) {
      startViewTransition(() => sectionRenderer.renderSection(this.sectionId), ['product-grid']);
    } else {
      sectionRenderer.renderSection(this.sectionId);
    }
  }

  /**
   * Updates filters based on a provided URL
   * @param {string} url - The URL to update filters with
   */
  updateFiltersByURL(url) {
    history.pushState('', '', compactFilterURL(url));
    this.dispatchEvent(new FilterUpdateEvent(this.createURLParameters()));
    this.#updateSection();
  }
}

if (!customElements.get('facets-form-component')) {
  customElements.define('facets-form-component', FacetsFormComponent);
}

/**
 * @typedef {Object} FacetInputsRefs
 * @property {HTMLInputElement[]} facetInputs - The facet input elements
 */

/**
 * Handles individual facet input functionality
 * @extends {Component<FacetInputsRefs>}
 */
class FacetInputsComponent extends Component {
  get sectionId() {
    const id = this.closest('.shopify-section')?.id;
    if (!id) throw new Error('FacetInputs component must be a child of a section');
    return id;
  }

  /**
   * Updates filters and the selected facet summary
   */
  updateFilters() {
    const facetsForm = this.closest('facets-form-component');

    if (!(facetsForm instanceof FacetsFormComponent)) return;

    facetsForm.updateFilters();
    this.#updateSelectedFacetSummary();
  }

  /**
   * Handles keydown events for the facets form
   * @param {KeyboardEvent} event - The keydown event
   */
  handleKeyDown(event) {
    if (!(event.target instanceof HTMLElement)) return;
    const closestInput = event.target.querySelector('input');

    if (!(closestInput instanceof HTMLInputElement)) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      closestInput.checked = !closestInput.checked;
      this.updateFilters();
    }
  }

  /**
   * Handles mouseover events on facet labels
   * @param {MouseEvent} event - The mouseover event
   */
  prefetchPage = debounce((event) => {
    if (!(event.target instanceof HTMLElement)) return;

    const form = this.closest('form');
    if (!form) return;

    const formData = new FormData(form);
    const inputElement = event.target.querySelector('input');

    if (!(inputElement instanceof HTMLInputElement)) return;

    if (!inputElement.checked) formData.append(inputElement.name, inputElement.value);

    const facetsForm = this.closest('facets-form-component');
    if (!(facetsForm instanceof FacetsFormComponent)) return;

    const urlParameters = facetsForm.createURLParameters(formData);

    const url = new URL(window.location.pathname, window.location.origin);

    for (const [key, value] of urlParameters) url.searchParams.append(key, value);

    if (inputElement.checked) url.searchParams.delete(inputElement.name, inputElement.value);

    sectionRenderer.getSectionHTML(this.sectionId, true, url);
  }, 200);

  cancelPrefetchPage = () => this.prefetchPage.cancel();

  /**
   * Updates the selected facet summary
   */
  #updateSelectedFacetSummary() {
    if (!this.refs.facetInputs) return;

    const checkedInputElements = this.refs.facetInputs.filter((input) => input.checked);
    const details = this.closest('details');
    const statusComponent = details?.querySelector('facet-status-component');

    if (!(statusComponent instanceof FacetStatusComponent)) return;

    statusComponent.updateListSummary(checkedInputElements);
  }
}

if (!customElements.get('facet-inputs-component')) {
  customElements.define('facet-inputs-component', FacetInputsComponent);
}

/**
 * @typedef {Object} PriceFacetRefs
 * @property {HTMLInputElement} minInput - The minimum price input
 * @property {HTMLInputElement} maxInput - The maximum price input
 */

/**
 * Handles price facet functionality
 * @extends {Component<PriceFacetRefs>}
 */
class PriceFacetComponent extends Component {
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('keydown', this.#onKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('keydown', this.#onKeyDown);
  }

  /**
   * Handles keydown events to restrict input to valid characters
   * @param {KeyboardEvent} event - The keydown event
   */
  #onKeyDown = (event) => {
    if (event.metaKey) return;

    const pattern = /[0-9]|\.|,|'| |Tab|Backspace|Enter|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Delete|Escape/;
    if (!event.key.match(pattern)) event.preventDefault();
  };

  /**
   * Updates price filter and results
   */
  updatePriceFilterAndResults() {
    const { minInput, maxInput } = this.refs;

    this.#adjustToValidValues(minInput);
    this.#adjustToValidValues(maxInput);

    const facetsForm = this.closest('facets-form-component');
    if (!(facetsForm instanceof FacetsFormComponent)) return;

    facetsForm.updateFilters();
    this.#setMinAndMaxValues();
    this.#updateSummary();
  }

  /**
   * Adjusts input values to be within valid range
   * @param {HTMLInputElement} input - The input element to adjust
   */
  #adjustToValidValues(input) {
    if (input.value.trim() === '') return;

    const value = Number(input.value);
    const min = Number(formatMoney(input.getAttribute('data-min') ?? ''));
    const max = Number(formatMoney(input.getAttribute('data-max') ?? ''));

    if (value < min) input.value = min.toString();
    if (value > max) input.value = max.toString();
  }

  /**
   * Sets min and max values for the inputs
   */
  #setMinAndMaxValues() {
    const { minInput, maxInput } = this.refs;

    if (maxInput.value) minInput.setAttribute('data-max', maxInput.value);
    if (minInput.value) maxInput.setAttribute('data-min', minInput.value);
    if (minInput.value === '') maxInput.setAttribute('data-min', '0');
    if (maxInput.value === '') minInput.setAttribute('data-max', maxInput.getAttribute('data-max') ?? '');
  }

  /**
   * Updates the price summary
   */
  #updateSummary() {
    const { minInput, maxInput } = this.refs;
    const details = this.closest('details');
    const statusComponent = details?.querySelector('facet-status-component');

    if (!(statusComponent instanceof FacetStatusComponent)) return;

    statusComponent?.updatePriceSummary(minInput, maxInput);
  }
}

if (!customElements.get('price-facet-component')) {
  customElements.define('price-facet-component', PriceFacetComponent);
}

/**
 * Handles clearing of facet filters
 * @extends {Component}
 */
class FacetClearComponent extends Component {
  requiredRefs = ['clearButton'];

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('keyup', this.#handleKeyUp);
    document.addEventListener(ThemeEvents.FilterUpdate, this.#handleFilterUpdate);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener(ThemeEvents.FilterUpdate, this.#handleFilterUpdate);
  }

  /**
   * Clears the filter
   * @param {Event} event - The click event
   */
  clearFilter(event) {
    if (!(event.target instanceof HTMLElement)) return;

    if (event instanceof KeyboardEvent) {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
    }

    const container = event.target.closest('facet-inputs-component, price-facet-component');
    container?.querySelectorAll('[type="checkbox"]:checked, input').forEach((input) => {
      if (input instanceof HTMLInputElement) {
        input.checked = false;
        input.value = '';
      }
    });

    const details = event.target.closest('details');
    const statusComponent = details?.querySelector('facet-status-component');

    if (!(statusComponent instanceof FacetStatusComponent)) return;

    statusComponent.clearSummary();

    const facetsForm = this.closest('facets-form-component');
    if (!(facetsForm instanceof FacetsFormComponent)) return;

    facetsForm.updateFilters();
  }

  /**
   * Handles keyup events
   * @param {KeyboardEvent} event - The keyup event
   */
  #handleKeyUp = (event) => {
    if (event.metaKey) return;
    if (event.key === 'Enter') this.clearFilter(event);
  };

  /**
   * Toggle clear button visibility when filters are applied. Happens before the
   * Section Rendering Request resolves.
   *
   * @param {FilterUpdateEvent} event
   */
  #handleFilterUpdate = (event) => {
    const { clearButton } = this.refs;
    if (clearButton instanceof Element) {
      clearButton.classList.toggle('facets__clear--active', event.shouldShowClearAll());
    }
  };
}

if (!customElements.get('facet-clear-component')) {
  customElements.define('facet-clear-component', FacetClearComponent);
}

/**
 * @typedef {Object} FacetRemoveComponentRefs
 * @property {HTMLInputElement | undefined} clearButton - The button to clear filters
 */

/**
 * Handles removal of individual facet filters
 * @extends {Component<FacetRemoveComponentRefs>}
 */
class FacetRemoveComponent extends Component {
  connectedCallback() {
    super.connectedCallback();
    document.addEventListener(ThemeEvents.FilterUpdate, this.#handleFilterUpdate);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener(ThemeEvents.FilterUpdate, this.#handleFilterUpdate);
  }

  /**
   * Removes the filter
   * @param {Object} data - The data object
   * @param {string} data.form - The form to remove the filter from
   * @param {Event} event - The click event
   */
  removeFilter({ form }, event) {
    if (event instanceof KeyboardEvent) {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
    }

    const url = this.dataset.url;
    if (!url) return;

    const facetsForm = form ? document.getElementById(form) : this.closest('facets-form-component');

    if (!(facetsForm instanceof FacetsFormComponent)) return;

    facetsForm.updateFiltersByURL(url);
  }

  /**
   * Toggle clear button visibility when filters are applied. Happens before the
   * Section Rendering Request resolves.
   *
   * @param {FilterUpdateEvent} event
   */
  #handleFilterUpdate = (event) => {
    const { clearButton } = this.refs;
    if (clearButton instanceof Element) {
      clearButton.classList.toggle('active', event.shouldShowClearAll());
    }
  };
}

if (!customElements.get('facet-remove-component')) {
  customElements.define('facet-remove-component', FacetRemoveComponent);
}

/**
 * Handles sorting filter functionality
 *
 * @typedef {Object} SortingFilterRefs
 * @property {HTMLDetailsElement} details - The details element
 * @property {HTMLElement} summary - The summary element
 * @property {HTMLElement} listbox - The listbox element
 *
 * @extends {Component}
 */
class SortingFilterComponent extends Component {
  requiredRefs = ['details', 'summary', 'listbox'];

  /**
   * Handles keyboard navigation in the sorting dropdown
   * @param {KeyboardEvent} event - The keyboard event
   */
  handleKeyDown = (event) => {
    const { listbox } = this.refs;
    if (!(listbox instanceof Element)) return;

    const options = Array.from(listbox.querySelectorAll('[role="option"]'));
    const currentFocused = options.find((option) => option instanceof HTMLElement && option.tabIndex === 0);
    let newFocusIndex = currentFocused ? options.indexOf(currentFocused) : 0;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        newFocusIndex = Math.min(newFocusIndex + 1, options.length - 1);
        this.#moveFocus(options, newFocusIndex);
        break;

      case 'ArrowUp':
        event.preventDefault();
        newFocusIndex = Math.max(newFocusIndex - 1, 0);
        this.#moveFocus(options, newFocusIndex);
        break;

      case 'Enter':
      case ' ':
        if (event.target instanceof Element) {
          const targetOption = event.target.closest('[role="option"]');
          if (targetOption) {
            event.preventDefault();
            this.#selectOption(targetOption);
          }
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.#closeDropdown();
        break;
    }
  };

  /**
   * Handles details toggle event
   */
  handleToggle = () => {
    const { details, summary, listbox } = this.refs;
    if (!(details instanceof HTMLDetailsElement) || !(summary instanceof HTMLElement)) return;

    const isOpen = details.open;
    summary.setAttribute('aria-expanded', isOpen.toString());

    if (isOpen && listbox instanceof Element) {
      // Move focus to selected option when dropdown opens
      const selectedOption = listbox.querySelector('[aria-selected="true"]');
      if (selectedOption instanceof HTMLElement) {
        selectedOption.focus();
      }
    }
  };

  /**
   * Moves focus between options
   * @param {Element[]} options - The option elements
   * @param {number} newIndex - The index of the option to focus
   */
  #moveFocus(options, newIndex) {
    // Remove tabindex from all options
    options.forEach((option) => {
      if (option instanceof HTMLElement) {
        option.tabIndex = -1;
      }
    });

    // Set tabindex and focus on new option
    const targetOption = options[newIndex];
    if (targetOption instanceof HTMLElement) {
      targetOption.tabIndex = 0;
      targetOption.focus();
    }
  }

  /**
   * Selects an option and triggers form submission
   * @param {Element} option - The option element to select
   */
  #selectOption(option) {
    const input = option.querySelector('input[type="radio"]');
    if (input instanceof HTMLInputElement && option instanceof HTMLElement) {
      // Update aria-selected states
      this.querySelectorAll('[role="option"]').forEach((opt) => {
        opt.setAttribute('aria-selected', 'false');
      });
      option.setAttribute('aria-selected', 'true');

      // Trigger click on the input to ensure normal form behavior
      input.click();

      // Close dropdown and return focus (handles tabIndex reset)
      this.#closeDropdown();
    }
  }

  /**
   * Closes the dropdown and returns focus to summary
   */
  #closeDropdown() {
    const { details, summary } = this.refs;
    if (details instanceof HTMLDetailsElement) {
      // Reset focus to match the actual selected option
      const options = this.querySelectorAll('[role="option"]');
      const selectedOption = this.querySelector('[aria-selected="true"]');

      options.forEach((opt) => {
        if (opt instanceof HTMLElement) {
          opt.tabIndex = -1;
        }
      });

      if (selectedOption instanceof HTMLElement) {
        selectedOption.tabIndex = 0;
      }

      details.open = false;
      if (summary instanceof HTMLElement) {
        summary.focus();
      }
    }
  }

  /**
   * Updates filter and sorting
   * @param {Event} event - The change event
   */
  updateFilterAndSorting(event) {
    const facetsForm =
      this.closest('facets-form-component') || this.closest('.shopify-section')?.querySelector('facets-form-component');

    if (!(facetsForm instanceof FacetsFormComponent)) return;
    const isMobile = window.innerWidth < 750;

    const shouldDisable = this.dataset.shouldUseSelectOnMobile === 'true';

    // Because we have a select element on mobile and a bunch of radio buttons on desktop,
    // we need to disable the input during "form-submission" to prevent duplicate entries.
    if (shouldDisable) {
      if (isMobile) {
        const inputs = this.querySelectorAll('input[name="sort_by"]');
        inputs.forEach((input) => {
          if (!(input instanceof HTMLInputElement)) return;
          input.disabled = true;
        });
      } else {
        const selectElement = this.querySelector('select[name="sort_by"]');
        if (!(selectElement instanceof HTMLSelectElement)) return;
        selectElement.disabled = true;
      }
    }

    facetsForm.updateFilters();
    this.updateFacetStatus(event);

    // Re-enable the input after the form-submission
    if (shouldDisable) {
      if (isMobile) {
        const inputs = this.querySelectorAll('input[name="sort_by"]');
        inputs.forEach((input) => {
          if (!(input instanceof HTMLInputElement)) return;
          input.disabled = false;
        });
      } else {
        const selectElement = this.querySelector('select[name="sort_by"]');
        if (!(selectElement instanceof HTMLSelectElement)) return;
        selectElement.disabled = false;
      }
    }

    // Close the details element when a value is selected
    const { details } = this.refs;
    if (!(details instanceof HTMLDetailsElement)) return;
    details.open = false;
  }

  /**
   * Updates the facet status
   * @param {Event} event - The change event
   */
  updateFacetStatus(event) {
    if (!(event.target instanceof HTMLSelectElement)) return;

    const details = this.querySelector('details');
    if (!details) return;

    const facetStatus = details.querySelector('facet-status-component');
    if (!(facetStatus instanceof FacetStatusComponent)) return;

    facetStatus.textContent =
      event.target.value !== details.dataset.defaultSortBy ? event.target.dataset.optionName ?? '' : '';
  }
}

if (!customElements.get('sorting-filter-component')) {
  customElements.define('sorting-filter-component', SortingFilterComponent);
}

/**
 * Sort control that sits outside the filter drawer, next to the grid view switch.
 * A native select: choosing an option updates sort_by in the URL (keeping every
 * applied filter) and re-renders the results through the facets form.
 */
class SortSelectComponent extends HTMLElement {
  connectedCallback() {
    this.addEventListener('change', this.#handleChange);
    document.addEventListener(ThemeEvents.FilterUpdate, this.#syncFromURL);
    window.addEventListener('popstate', this.#syncFromURL);
  }

  disconnectedCallback() {
    this.removeEventListener('change', this.#handleChange);
    document.removeEventListener(ThemeEvents.FilterUpdate, this.#syncFromURL);
    window.removeEventListener('popstate', this.#syncFromURL);
  }

  /** @param {Event} event */
  #handleChange = (event) => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) return;

    const url = expandFilterURL(window.location.href);
    if (select.value === getDefaultSortBy(this)) {
      url.searchParams.delete('sort_by');
    } else {
      url.searchParams.set('sort_by', select.value);
    }
    url.searchParams.delete('page');

    const facetsForm = this.closest('.shopify-section')?.querySelector('facets-form-component');

    if (facetsForm instanceof FacetsFormComponent) {
      facetsForm.updateFiltersByURL(url.toString());
    } else {
      window.location.assign(url.toString());
    }
  };

  /** Keeps the select in step when sorting changes elsewhere (desktop dropdown, back button). */
  #syncFromURL = () => {
    const select = this.querySelector('select');
    const sortBy = new URL(window.location.href).searchParams.get('sort_by') ?? getDefaultSortBy(this);
    if (select && sortBy && select.value !== sortBy) select.value = sortBy;
  };
}

if (!customElements.get('sort-select-component')) {
  customElements.define('sort-select-component', SortSelectComponent);
}

const SIZE_SYSTEMS = ['us', 'uk', 'eu'];
const SIZE_SYSTEM_STORE_KEY = 'csh-size-system';
const SIZE_SYSTEM_EVENT = 'size-system:change';

/**
 * "US 9 - UK 8 - EU 42 2/3" -> { us: '9', uk: '8', eu: '42 2/3' }
 * @param {string} value
 * @returns {Record<string, string>}
 */
const parseSizeValue = (value) => {
  /** @type {Record<string, string>} */
  const sizes = {};
  for (const system of SIZE_SYSTEMS) {
    const match = value.match(new RegExp('\\b' + system + '\\s*([0-9]+(?:\\.[0-9]+)?(?:\\s+[12]/3)?)', 'i'));
    if (match?.[1]) sizes[system] = match[1].replace(/\s+/g, ' ').trim();
  }
  return sizes;
};

/** @param {string} size */
const sizeToNumber = (size) => {
  const [whole = '', fraction] = size.split(' ');
  let number = parseFloat(whole);
  if (fraction === '1/3') number += 1 / 3;
  if (fraction === '2/3') number += 2 / 3;
  return number;
};

/** @param {string} size */
const prettySize = (size) => size.replace(' 1/3', '⅓').replace(' 2/3', '⅔');

/**
 * Size filter for the filter drawer: a US / UK / EU switch and one button per size.
 *
 * The filter's real checkboxes stay in the form (hidden) and remain the source of
 * truth, so the rest of the facets code works unchanged. Each size button covers
 * every option value with that size in the chosen system ("US 9 - UK 8 - EU 42"
 * and "US 9 - UK 8.5 - EU 42.5" are both "US 9"), and pressing it ticks those
 * checkboxes and fires the same change event a shopper's tap would.
 * The chosen system is shared with the collection size header.
 */
class FacetSizeChips extends HTMLElement {
  /** @type {MutationObserver | undefined} */
  #observer;
  #system = 'us';
  #renderQueued = false;
  /** @type {string | null} */
  #restoreFocusKey = null;

  connectedCallback() {
    this.#system = this.#initialSystem();
    this.addEventListener('click', this.#handleClick);
    this.addEventListener('focusout', (event) => {
      if (event.relatedTarget) this.#restoreFocusKey = null;
    });
    this.addEventListener('keydown', this.#handleKeyDown);
    document.addEventListener(SIZE_SYSTEM_EVENT, this.#handleSystemChange);

    // Section re-renders morph this markup back to what the server sent, so redraw afterwards.
    this.#observer = new MutationObserver(() => this.#queueRender());
    this.#render();
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#handleClick);
    this.removeEventListener('keydown', this.#handleKeyDown);
    document.removeEventListener(SIZE_SYSTEM_EVENT, this.#handleSystemChange);
    this.#observer?.disconnect();
  }

  get #root() {
    return this.closest('facet-inputs-component') ?? this.parentElement;
  }

  /** @returns {HTMLInputElement[]} */
  get #inputs() {
    return Array.from(this.#root?.querySelectorAll('input[type="checkbox"]') ?? []);
  }

  #initialSystem() {
    try {
      const saved = localStorage.getItem(SIZE_SYSTEM_STORE_KEY);
      if (saved && SIZE_SYSTEMS.includes(saved)) return saved;
    } catch (error) {
      // Storage unavailable: fall through to the default.
    }
    const header = document.querySelector('collection-size-selector');
    const fallback = (header instanceof HTMLElement && header.dataset.defaultSys) || this.dataset.defaultSys;
    return fallback && SIZE_SYSTEMS.includes(fallback) ? fallback : 'us';
  }

  #queueRender() {
    if (this.#renderQueued) return;
    this.#renderQueued = true;
    requestAnimationFrame(() => {
      this.#renderQueued = false;
      if (this.isConnected) this.#render();
    });
  }

  /** Every option value grouped by its size in the current system, smallest first. */
  #groups() {
    /** @type {Map<string, { label: string, order: number, inputs: HTMLInputElement[] }>} */
    const groups = new Map();
    let unparsed = 0;

    for (const input of this.#inputs) {
      const size = parseSizeValue(input.value)[this.#system];
      const key = size ?? `raw:${input.value}`;
      let group = groups.get(key);
      if (!group) {
        group = size
          ? { label: prettySize(size), order: sizeToNumber(size), inputs: [] }
          : { label: input.dataset.label || input.value, order: Number.MAX_SAFE_INTEGER, inputs: [] };
        groups.set(key, group);
      }
      if (!size) unparsed++;
      group.inputs.push(input);
    }

    return { groups: [...groups.values()].sort((a, b) => a.order - b.order), unparsed };
  }

  #render() {
    this.#observer?.disconnect();

    const toggle = this.querySelector('.size-facet__toggle');
    const list = this.querySelector('.size-facet__chips');
    const inputs = this.#inputs;
    const { groups, unparsed } = this.#groups();

    // None of the values are "US x - UK y - EU z" sizes: leave the theme's own list in place.
    const usable = inputs.length > 0 && unparsed < inputs.length;
    this.hidden = !usable;
    this.#root?.querySelector('.facets__inputs-wrapper')?.toggleAttribute('hidden', usable);

    if (usable && toggle instanceof HTMLElement && list) {
      toggle.dataset.sys = this.#system;
      for (const button of toggle.querySelectorAll('.size-facet__sys')) {
        if (!(button instanceof HTMLElement)) continue;
        const selected = button.dataset.sys === this.#system;
        button.setAttribute('aria-checked', String(selected));
        button.tabIndex = selected ? 0 : -1;
      }


      list.replaceChildren(
        ...groups.map((group, index) => {
          const pressed = group.inputs.some((input) => input.checked);
          const item = document.createElement('li');
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'size-facet__chip';
          button.textContent = group.label;
          button.dataset.index = String(index);
          button.dataset.key = `${this.#system}:${group.label}`;
          button.setAttribute('aria-pressed', String(pressed));
          if (group.order !== Number.MAX_SAFE_INTEGER) {
            button.setAttribute('aria-label', `${this.#system.toUpperCase()} ${group.label}`);
          }
          button.disabled = !pressed && group.inputs.every((input) => input.disabled);
          item.append(button);
          return item;
        })
      );

      // A re-render replaces the pressed button: hand keyboard focus back to it.
      if (this.#restoreFocusKey && (!document.activeElement || document.activeElement === document.body)) {
        for (const button of list.querySelectorAll('.size-facet__chip')) {
          if (button instanceof HTMLElement && button.dataset.key === this.#restoreFocusKey) {
            button.focus({ preventScroll: true });
          }
        }
      }
    }

    if (this.#root) {
      this.#observer?.observe(this.#root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['checked', 'disabled', 'aria-checked', 'data-sys', 'hidden'],
      });
    }
  }

  /**
   * @param {string} system
   * @param {boolean} remember
   */
  #setSystem(system, remember) {
    if (!SIZE_SYSTEMS.includes(system) || system === this.#system) return;
    this.#system = system;
    this.#render();

    if (!remember) return;
    try {
      localStorage.setItem(SIZE_SYSTEM_STORE_KEY, system);
    } catch (error) {
      // Storage unavailable: the choice lasts for this page only.
    }
    document.dispatchEvent(new CustomEvent(SIZE_SYSTEM_EVENT, { detail: system }));
  }

  /** @param {Event} event */
  #handleSystemChange = (event) => {
    if (event instanceof CustomEvent && typeof event.detail === 'string') this.#setSystem(event.detail, false);
  };

  /** @param {MouseEvent} event */
  #handleClick = (event) => {
    if (!(event.target instanceof Element)) return;

    const systemButton = event.target.closest('.size-facet__sys');
    if (systemButton instanceof HTMLElement && systemButton.dataset.sys) {
      this.#setSystem(systemButton.dataset.sys, true);
      return;
    }

    const chip = event.target.closest('.size-facet__chip');
    if (!(chip instanceof HTMLButtonElement) || chip.disabled) return;

    const group = this.#groups().groups[Number(chip.dataset.index)];
    if (!group) return;

    const pressed = chip.getAttribute('aria-pressed') === 'true';
    for (const input of group.inputs) {
      if (pressed) input.checked = false;
      else if (!input.disabled) input.checked = true;
    }
    chip.setAttribute('aria-pressed', String(!pressed));
    this.#restoreFocusKey = chip.dataset.key ?? null;

    // Same event a tap on the checkbox would fire: the facets form picks it up from here.
    group.inputs[0]?.dispatchEvent(new Event('change', { bubbles: true }));
  };

  /**
   * Arrow keys move between US / UK / EU, as in a radio group.
   * @param {KeyboardEvent} event
   */
  #handleKeyDown = (event) => {
    if (!(event.target instanceof HTMLElement) || !event.target.classList.contains('size-facet__sys')) return;

    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;

    event.preventDefault();
    const next = SIZE_SYSTEMS[(SIZE_SYSTEMS.indexOf(this.#system) + step + SIZE_SYSTEMS.length) % SIZE_SYSTEMS.length];
    if (!next) return;
    this.#setSystem(next, true);
    const button = this.querySelector(`.size-facet__sys[data-sys="${next}"]`);
    if (button instanceof HTMLElement) button.focus();
  };
}

if (!customElements.get('facet-size-chips')) {
  customElements.define('facet-size-chips', FacetSizeChips);
}

/**
 * @typedef {Object} FacetStatusRefs
 * @property {HTMLElement} facetStatus - The facet status element
 */

/**
 * Handles facet status display
 * @extends {Component<FacetStatusRefs>}
 */
class FacetStatusComponent extends Component {
  /**
   * Updates the list summary
   * @param {HTMLInputElement[]} checkedInputElements - The checked input elements
   */
  updateListSummary(checkedInputElements) {
    const checkedInputElementsCount = checkedInputElements.length;

    this.getAttribute('facet-type') === 'swatches'
      ? this.#updateSwatchSummary(checkedInputElements, checkedInputElementsCount)
      : this.#updateBubbleSummary(checkedInputElements, checkedInputElementsCount);
  }

  /**
   * Updates the swatch summary
   * @param {HTMLInputElement[]} checkedInputElements - The checked input elements
   * @param {number} checkedInputElementsCount - The number of checked inputs
   */
  #updateSwatchSummary(checkedInputElements, checkedInputElementsCount) {
    const { facetStatus } = this.refs;
    facetStatus.classList.remove('bubble', 'facets__bubble');

    if (checkedInputElementsCount === 0) {
      facetStatus.innerHTML = '';
      return;
    }

    if (checkedInputElementsCount > 3) {
      facetStatus.innerHTML = checkedInputElementsCount.toString();
      facetStatus.classList.add('bubble', 'facets__bubble');
      return;
    }

    facetStatus.innerHTML = Array.from(checkedInputElements)
      .map((inputElement) => {
        const swatch = inputElement.parentElement?.querySelector('span.swatch');
        return swatch?.outerHTML ?? '';
      })
      .join('');
  }

  /**
   * Updates the bubble summary
   * @param {HTMLInputElement[]} checkedInputElements - The checked input elements
   * @param {number} checkedInputElementsCount - The number of checked inputs
   */
  #updateBubbleSummary(checkedInputElements, checkedInputElementsCount) {
    const { facetStatus } = this.refs;
    facetStatus.classList.remove('bubble', 'facets__bubble');

    if (checkedInputElementsCount === 0) {
      facetStatus.innerHTML = '';
      return;
    }

    if (checkedInputElementsCount === 1) {
      facetStatus.innerHTML = checkedInputElements[0]?.dataset.label ?? '';
      return;
    }

    facetStatus.innerHTML = checkedInputElementsCount.toString();
    facetStatus.classList.add('bubble', 'facets__bubble');
  }

  /**
   * Updates the price summary
   * @param {HTMLInputElement} minInput - The minimum price input
   * @param {HTMLInputElement} maxInput - The maximum price input
   */
  updatePriceSummary(minInput, maxInput) {
    const minInputValue = minInput.value;
    const maxInputValue = maxInput.value;
    const { facetStatus } = this.refs;

    if (!minInputValue && !maxInputValue) {
      facetStatus.innerHTML = '';
      return;
    }

    const minInputNum = this.#parseCents(minInputValue, '0');
    const maxInputNum = this.#parseCents(maxInputValue, facetStatus.dataset.rangeMax);
    facetStatus.innerHTML = `${this.#formatMoney(minInputNum)}–${this.#formatMoney(maxInputNum)}`;
  }

  /**
   * Parses a decimal number as cents
   * @param {string} value - The stringified decimal number to parse
   * @param {string} fallback - The fallback value in case `value` is invalid
   * @returns {number} The money value in cents
   */
  #parseCents(value, fallback = '0') {
    const parts = value ? value.trim().split(/[^0-9]/) : (parseInt(fallback, 10) / 100).toString();
    const [wholeStr, fractionStr, ...rest] = parts;
    if (typeof wholeStr !== 'string' || rest.length > 0) return parseInt(fallback, 10);

    const whole = parseInt(wholeStr, 10);
    let fraction = parseInt(fractionStr || '0', 10);

    // Use two most-significant digits, e.g. 1 -> 10, 12 -> 12, 123 -> 12.3, 1234 -> 12.34, etc
    fraction = fraction * Math.pow(10, 2 - fraction.toString().length);

    return whole * 100 + fraction;
  }

  /**
   * Formats money, replicated the implementation of the `money` liquid filters
   * @param {number} moneyValue - The money value
   * @returns {string} The formatted money value
   */
  #formatMoney(moneyValue) {
    if (!(this.refs.moneyFormat instanceof HTMLTemplateElement)) return '';

    const template = this.refs.moneyFormat.content.textContent || '{{amount}}';
    const currency = this.refs.facetStatus.dataset.currency || '';

    return template.replace(/{{\s*(\w+)\s*}}/g, (_, placeholder) => {
      if (typeof placeholder !== 'string') return '';
      if (placeholder === 'currency') return currency;

      let thousandsSeparator = ',';
      let decimalSeparator = '.';
      let precision = CURRENCY_DECIMALS[currency.toUpperCase()] ?? DEFAULT_CURRENCY_DECIMALS;

      if (placeholder === 'amount') {
        // Check first since it's the most common, use defaults.
      } else if (placeholder === 'amount_no_decimals') {
        precision = 0;
      } else if (placeholder === 'amount_with_comma_separator') {
        thousandsSeparator = '.';
        decimalSeparator = ',';
      } else if (placeholder === 'amount_no_decimals_with_comma_separator') {
        // Weirdly, this is correct. It uses amount_with_comma_separator's
        // behaviour but removes decimals, resulting in an unintuitive
        // output that can't possibly include commas, despite the name.
        thousandsSeparator = '.';
        precision = 0;
      } else if (placeholder === 'amount_no_decimals_with_space_separator') {
        thousandsSeparator = ' ';
        precision = 0;
      } else if (placeholder === 'amount_with_space_separator') {
        thousandsSeparator = ' ';
        decimalSeparator = ',';
      } else if (placeholder === 'amount_with_period_and_space_separator') {
        thousandsSeparator = ' ';
        decimalSeparator = '.';
      } else if (placeholder === 'amount_with_apostrophe_separator') {
        thousandsSeparator = "'";
        decimalSeparator = '.';
      }

      return this.#formatCents(moneyValue, thousandsSeparator, decimalSeparator, precision);
    });
  }

  /**
   * Formats money in cents
   * @param {number} moneyValue - The money value in cents (hundredths of one major currency unit)
   * @param {string} thousandsSeparator - The thousands separator
   * @param {string} decimalSeparator - The decimal separator
   * @param {number} precision - The precision
   * @returns {string} The formatted money value
   */
  #formatCents(moneyValue, thousandsSeparator, decimalSeparator, precision) {
    const roundedNumber = (moneyValue / 100).toFixed(precision);

    let [a, b] = roundedNumber.split('.');
    if (!a) a = '0';
    if (!b) b = '';

    // Split by groups of 3 digits
    a = a.replace(/\d(?=(\d\d\d)+(?!\d))/g, (digit) => digit + thousandsSeparator);

    return precision <= 0 ? a : a + decimalSeparator + b.padEnd(precision, '0');
  }

  /**
   * Clears the summary
   */
  clearSummary() {
    this.refs.facetStatus.innerHTML = '';
  }
}

if (!customElements.get('facet-status-component')) {
  customElements.define('facet-status-component', FacetStatusComponent);
}

/**
 * Default currency decimals used in most currenies
 * @constant {number}
 */
const DEFAULT_CURRENCY_DECIMALS = 2;

/**
 * Decimal precision for currencies that have a non-default precision
 * @type {Record<string, number>}
 */
const CURRENCY_DECIMALS = {
  BHD: 3,
  BIF: 0,
  BYR: 0,
  CLF: 4,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  IQD: 3,
  ISK: 0,
  JOD: 3,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  KWD: 3,
  LYD: 3,
  MRO: 5,
  OMR: 3,
  PYG: 0,
  RWF: 0,
  TND: 3,
  UGX: 0,
  UYI: 0,
  UYW: 4,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XAG: 0,
  XAU: 0,
  XBA: 0,
  XBB: 0,
  XBC: 0,
  XBD: 0,
  XDR: 0,
  XOF: 0,
  XPD: 0,
  XPF: 0,
  XPT: 0,
  XSU: 0,
  XTS: 0,
  XUA: 0,
};
