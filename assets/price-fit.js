/**
 * <price-fit>: keeps a card's sale price line ("RRP  NOW $price") on one line by
 * shrinking its font size to fit the space available. Below MIN_SCALE it stops
 * shrinking and lets the line wrap instead (the RRP drops above, "NOW $price" stays
 * together). Refits whenever the card changes size, including after filtering.
 */
const MIN_SCALE = 0.7;

class PriceFit extends HTMLElement {
  connectedCallback() {
    this.ro = new ResizeObserver(() => this.fit());
    this.ro.observe(this.parentElement || this);
    this.fit();
  }

  disconnectedCallback() {
    this.ro?.disconnect();
  }

  fit() {
    const box = this.parentElement;
    if (!box) return;
    const available = box.clientWidth;
    if (!available) return;

    this.removeAttribute('data-wrapped');
    this.style.fontSize = '';
    // Width of the full line at the natural size.
    const needed = this.scrollWidth;
    if (needed <= available) return;

    const scale = Math.max(MIN_SCALE, Math.floor((available / needed) * 100) / 100);
    this.style.fontSize = scale + 'em';
    if (this.scrollWidth <= available + 0.5) return;

    // Still too long: let the RRP wrap above, and size "NOW $price" to fill its own line.
    this.setAttribute('data-wrapped', '');
    this.style.fontSize = '';
    const now = this.querySelector('.bfsale-now');
    const nowWidth = now ? now.getBoundingClientRect().width : needed;
    this.style.fontSize = Math.min(1, Math.floor((available / nowWidth) * 100) / 100) + 'em';
  }
}

if (!customElements.get('price-fit')) customElements.define('price-fit', PriceFit);
