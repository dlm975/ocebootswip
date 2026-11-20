/**
 * Filter drawer: the filters behave like the items in the menu drawer (assets/header-drawer.js).
 * They start closed. Tapping one hides the others, slides its title up to the top and drops its
 * options down from under it; its arrow becomes an X. Tapping it again fades the options out,
 * then the filters above slide back down from the top of the drawer and those below up from its
 * bottom, while the title glides back into place and the drawer eases to its new height.
 *
 * Filters opt in with data-drawer-focus on their accordion-custom (snippets/list-filter.liquid,
 * snippets/price-filter.liquid). Which one is open survives the drawer re-rendering after a
 * filter changes, because the page morph keeps each details element's open state.
 */
(function () {
  if (window.OceFilterDrawerFocus) return;
  window.OceFilterDrawerFocus = true;

  const TIMING = { duration: 550, easing: 'cubic-bezier(0.3, 0.7, 0.3, 1)' };
  const FADE_OUT = { duration: 180, easing: 'cubic-bezier(0.4, 0, 1, 1)' };
  const STAGGER = 40;

  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.addEventListener('click', function (event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const summary = target.closest('accordion-custom[data-drawer-focus] > details > summary');
    if (!summary) return;
    const details = summary.parentElement;
    const item = details && details.parentElement;
    if (!(details instanceof HTMLDetailsElement) || !item) return;

    event.preventDefault();
    if (details.dataset.closing) return;
    if (details.open) close(item, details, summary);
    else open(item, details, summary);
  });

  /** The drawer panel whose height follows its content, and the list that scrolls inside it */
  function parts(item) {
    return {
      panel: item.closest('dialog'),
      list: item.parentElement,
    };
  }

  /**
   * @param {HTMLElement} item
   * @param {HTMLDetailsElement} details
   * @param {HTMLElement} summary
   */
  function open(item, details, summary) {
    const { panel, list } = parts(item);
    const titleTop = summary.getBoundingClientRect().top;
    const panelHeight = panel ? panel.getBoundingClientRect().height : 0;

    // Only one open at a time (one may still be open from before a re-render)
    list.querySelectorAll(':scope > accordion-custom[data-drawer-focus] > details[open]').forEach(function (other) {
      if (other !== details) other.open = false;
    });

    details.open = true;
    summary.setAttribute('aria-expanded', 'true');
    if (list) list.scrollTop = 0;
    if (reducedMotion()) return;

    slide(summary, titleTop - summary.getBoundingClientRect().top);
    easeHeight(panel, panelHeight);

    const content = details.querySelector(':scope > .details-content');
    if (content) {
      content.animate(
        [
          { opacity: 0, transform: 'translateY(-24px)', clipPath: 'inset(0 0 100% 0)' },
          { opacity: 1, transform: 'none', clipPath: 'inset(0 0 -50% 0)' },
        ],
        { ...TIMING, fill: 'backwards' }
      );
    }
  }

  /**
   * @param {HTMLElement} item
   * @param {HTMLDetailsElement} details
   * @param {HTMLElement} summary
   */
  async function close(item, details, summary) {
    details.dataset.closing = 'true';
    summary.setAttribute('aria-expanded', 'false');

    const content = details.querySelector(':scope > .details-content');
    if (content && !reducedMotion()) {
      const fade = content.animate([{ opacity: 1 }, { opacity: 0 }], { ...FADE_OUT, fill: 'forwards' });
      try {
        await fade.finished;
      } catch (e) {
        /* cancelled: close anyway */
      }
    }

    // Measure, close and start every animation in the same task, so the new layout is never
    // painted unanimated
    const { panel, list } = parts(item);
    const titleTop = summary.getBoundingClientRect().top;
    const panelHeight = panel ? panel.getBoundingClientRect().height : 0;

    details.open = false;
    delete details.dataset.closing;
    if (content) content.getAnimations().forEach(function (animation) { animation.cancel(); });
    if (reducedMotion() || !panel || !list) return;

    // Bring the closed filter back to where it sat, so the others arrive around it
    list.scrollTop = 0;
    const listBox = list.getBoundingClientRect();
    const itemBox = item.getBoundingClientRect();
    if (itemBox.bottom > listBox.bottom) list.scrollTop += itemBox.bottom - listBox.bottom;

    slide(summary, titleTop - summary.getBoundingClientRect().top);
    easeHeight(panel, panelHeight);

    const box = list.getBoundingClientRect();
    const siblings = Array.from(list.children).filter(function (el) { return el instanceof HTMLElement; });
    const index = siblings.indexOf(item);
    siblings.forEach(function (el, i) {
      if (el === item) return;
      const rect = el.getBoundingClientRect();
      if (rect.bottom < box.top - 1 || rect.top > box.bottom + 1) return; // out of view
      const from = i < index ? box.top - rect.bottom : box.bottom - rect.top;
      el.animate([{ transform: 'translateY(' + from + 'px)', opacity: 0 }, { transform: 'none', opacity: 1 }], {
        ...TIMING,
        delay: (Math.abs(i - index) - 1) * STAGGER,
        fill: 'backwards',
      });
    });
  }

  /** Animate an element from a vertical offset back to its place */
  function slide(element, offset) {
    if (Math.abs(offset) < 1) return;
    element.animate([{ transform: 'translateY(' + offset + 'px)' }, { transform: 'none' }], TIMING);
  }

  /** Ease the drawer from its previous height to its new one instead of jumping */
  function easeHeight(panel, from) {
    if (!(panel instanceof HTMLElement)) return;
    const to = panel.getBoundingClientRect().height;
    if (Math.abs(to - from) < 1) return;
    panel.getAnimations().forEach(function (animation) {
      if (!(animation instanceof CSSAnimation)) animation.cancel();
    });
    panel.animate([{ height: from + 'px' }, { height: to + 'px' }], TIMING);
  }
})();
