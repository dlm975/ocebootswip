/**
 * Category suggestions for search, shared by the full-screen search
 * (snippets/custom-search-overlay.liquid) and the search results page
 * (sections/search-summary.liquid), so both suggest exactly the same.
 *
 * Suggestions come from the titles of the products matching what was typed: for each title, the
 * words up to the one typed give a category ("Nike Mercurial Vapor"); one word less gives its
 * parent ("Nike Mercurial") and one more a narrower one ("Nike Mercurial Vapor 15"). Broader
 * first, then the most common. A suggestion that is a Shop by Silo brand, or a brand ending in one
 * of its models, links to that collection; any other opens the search results for it.
 *
 * Suggestions shown in the search are remembered for the visit, so the results page can show
 * them straight away when that search is submitted.
 */
(function () {
  if (window.OceSearchSuggest) return;

  const STORE_PREFIX = 'oce-search-suggest:';
  const clean = (word) => word.toLowerCase().replace(/[^a-z0-9]/g, '');

  /**
   * @param {string} query
   * @param {string[]} titles
   * @param {number} [max]
   * @returns {{ text: string, length: number, count: number, first: number }[]}
   */
  function build(query, titles, max) {
    const queryWords = query.split(/\s+/).map(clean).filter(Boolean);
    if (!queryWords.length) return [];
    const found = new Map();

    titles.forEach(function (title, titleIndex) {
      const words = title.split(/\s+/).filter(Boolean);
      const lower = words.map(clean);
      let at = -1;
      for (const queryWord of queryWords) {
        const next = lower.findIndex(function (word, index) {
          return index > at && word.startsWith(queryWord);
        });
        if (next === -1) return;
        at = next;
      }

      [at, at + 1, at + 2].forEach(function (length) {
        if (length < 1 || length > words.length) return;
        const phraseWords = words.slice(0, length);
        // Stop at nicknames and colourways ('Golden Horizon'), slashes and the like
        if (phraseWords.some(function (word) { return /['"’‘(\/]/.test(word); })) return;
        if (!clean(phraseWords[phraseWords.length - 1])) return;
        const text = phraseWords.join(' ');
        const key = text.toLowerCase();
        const entry = found.get(key) || { text: text, length: length, count: 0, first: titleIndex };
        entry.count += 1;
        found.set(key, entry);
      });
    });

    return Array.from(found.values())
      .sort(function (a, b) {
        return a.length - b.length || b.count - a.count || a.first - b.first;
      })
      .slice(0, max || 4);
  }

  /**
   * @param {string} text
   * @param {{ name: string, url: string, models: Record<string, string> }[]} catalog
   * @param {string} searchUrl
   */
  function url(text, catalog, searchUrl) {
    const words = text.split(/\s+/).map(clean).filter(Boolean);
    const brand = (catalog || []).find(function (entry) { return clean(entry.name) === words[0]; });
    if (brand) {
      if (words.length === 1) return brand.url;
      const last = words[words.length - 1];
      for (const model in brand.models) {
        if (clean(model) === last) return brand.models[model];
      }
    }
    return searchUrl + '?q=' + encodeURIComponent(text) + '&type=product';
  }

  /** @param {string} id */
  function readCatalog(id) {
    try {
      const element = document.getElementById(id);
      return element ? JSON.parse(element.textContent || '[]') : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Matching product titles and the rendered product cards for a query
   * @param {string} query
   * @param {string} suggestUrl - routes.predictive_search_url
   * @param {AbortSignal} [signal]
   */
  function fetchResults(query, suggestUrl, signal) {
    const requestUrl =
      suggestUrl +
      '?q=' + encodeURIComponent(query) +
      '&resources[type]=product&resources[limit]=10&resources[limit_scope]=each' +
      '&resources[options][unavailable_products]=last' +
      '&section_id=search-overlay-results';
    return fetch(requestUrl, { signal: signal })
      .then(function (response) { return response.text(); })
      .then(function (html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const results = doc.querySelector('[data-cs-results]');
        let titles = [];
        try {
          titles = JSON.parse((results && results.querySelector('[data-cs-titles]').textContent) || '[]');
        } catch (e) {
          titles = [];
        }
        return { titles: titles, grid: results ? results.querySelector('.cs-grid') : null };
      });
  }

  const key = (query) => STORE_PREFIX + query.trim().toLowerCase();

  /** @param {string} query @param {{ text: string, url: string }[]} list */
  function remember(query, list) {
    try {
      sessionStorage.setItem(key(query), JSON.stringify(list));
    } catch (e) {
      /* storage unavailable: the results page fetches them instead */
    }
  }

  /** @param {string} query @returns {{ text: string, url: string }[] | null} */
  function recall(query) {
    try {
      const stored = sessionStorage.getItem(key(query));
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  }

  window.OceSearchSuggest = {
    build: build,
    url: url,
    readCatalog: readCatalog,
    fetchResults: fetchResults,
    remember: remember,
    recall: recall,
  };
})();
