/**
 * Spelling library for search (used by assets/search-suggestions.js).
 *
 *   TERMS        - the right spelling, then the ways people get it wrong. Add to these lists
 *                  whenever a misspelling turns up; they are matched as whole words, ignoring
 *                  case, spaces, dashes and dots ("ctr 360", "ctr-360" and "ctr360" are the same).
 *   COLLECTIONS  - the brand, silo and generation collections search can suggest directly, so a
 *                  misspelt query still offers them even when no product title matches it.
 *
 * Words not in TERMS are also checked against every known word: one slip (a missing, extra,
 * swapped or wrong letter) is put right in words of 4-6 letters, two in longer ones. A word that
 * is the start of a known word is left alone, since the shopper may still be typing it.
 */
(function () {
  if (window.OceSearchSpelling) return;

  /** @type {Record<string, string[]>} */
  const TERMS = {
    // Brands
    nike: ['nikey', 'nikee', 'nkie', 'niek', 'nikr', 'nikw', 'nyke', 'naik', 'mike'],
    adidas: [
      'addidas', 'adiddas', 'addiddas', 'adidias', 'adiadas', 'adidaas', 'addias', 'adids', 'adidad',
      'adidass', 'adiddas', 'adudas', 'adisas', 'adidsa', 'adi das', 'ad idas',
    ],
    puma: ['pumma', 'pooma', 'pumah', 'pume', 'pumas'],
    mizuno: ['mizzuno', 'misuno', 'mizano', 'mizuna', 'mizunno', 'mizuino', 'mizuo', 'mizono'],
    'new balance': ['newbalance', 'new balence', 'new ballance', 'nb'],

    // Nike silos
    mercurial: [
      'mercurail', 'mecurial', 'mercurual', 'mercurical', 'mercural', 'murcurial', 'mercuial',
      'mercurio', 'mercuriel', 'mercurials', 'merucrial', 'mercurrial', 'mercury', 'merc urial',
      'mercurail', 'mercruial', 'mercuirial', 'mercurual', 'mercuria',
    ],
    superfly: [
      'superfli', 'supafly', 'super fly', 'superflie', 'suprfly', 'superflys', 'superflies',
      'superflyy', 'sueprfly', 'superfy', 'superlfy', 'sfly', 'super-fly', 'superfligh',
    ],
    vapor: ['vapour', 'vapr', 'vapoor', 'vaper', 'vapore', 'vapors', 'vapur', 'vapro', 'vaopr'],
    phantom: [
      'phatom', 'phantum', 'fantom', 'phamtom', 'phanton', 'phantome', 'phantoms', 'phanthom',
      'phnatom', 'phamton', 'fhantom', 'phantam',
    ],
    tiempo: ['tiempos', 'teimpo', 'tienpo', 'tiemop', 'tiemppo', 'tiampo', 'tiemo', 'tiempoo'],
    hypervenom: [
      'hyper venom', 'hypervenon', 'hypervemon', 'hypervenum', 'hyperveom', 'hyprvenom',
      'hypervenoms', 'hipervenom', 'hypervemom', 'hypervenmo', 'hypervnom', 'hyper-venom', 'hv',
    ],
    magista: ['magesta', 'magisto', 'majista', 'magistra', 'magitsa', 'magistas', 'magisata', 'magsta'],
    ctr360: ['ctr 360', 'ctr-360', 'crt360', 'crt 360', 'ctr36', 'ctr306'],
    'total 90': ['t90', 'total90', 'total-90', 'totla 90', 'totoal 90', 't 90'],

    // adidas silos
    predator: [
      'preditor', 'predater', 'perdator', 'preadator', 'predetor', 'predaotr', 'predators',
      'predatr', 'preddator', 'predaor', 'predotor', 'pred',
    ],
    f50: ['f 50', 'f-50', 'f fifty', 'f5o', 'f05', 'fifty'],
    copa: ['coppa', 'kopa', 'copas', 'cpoa', 'copaa'],
    nemeziz: [
      'nemesis', 'nemisis', 'nemezis', 'nemizis', 'nemeziss', 'nemesiz', 'nemeses', 'nemizes',
      'nemezes', 'nemziz', 'nemezziz',
    ],
    crazyfast: ['crazy fast', 'crazyfest', 'crasyfast', 'crazy-fast', 'crazyfst', 'crazfast', 'crazyfasr'],
    '11pro': ['11 pro', 'eleven pro', '11-pro', '11pros', 'elevenpro', '11 pr0'],
    ace: ['aec', 'acee'],
    x: [],

    // Puma and Mizuno silos
    future: ['futur', 'futre', 'furture', 'fututre'],
    ultra: ['ulta', 'ultr', 'ulrta', 'ultraa'],
    evopower: ['evo power', 'evopwer', 'evopowr', 'evo-power'],
    morelia: ['morellia', 'morelai', 'moreila', 'morila', 'morella', 'morelias', 'morelia neo', 'morlia'],

    // Generations and lines
    legend: ['legned', 'ledgend', 'legand', 'lengend', 'legen', 'legends', 'leggend'],
    maestro: ['mestro', 'maestero', 'maesto', 'maetsro', 'meastro', 'maestros'],
    maestri: ['mestri', 'maestry', 'maestre'],
    elite: ['elit', 'eilte', 'elitte', 'eliet', 'elitee', 'ellite'],
    academy: ['accademy', 'acadamy', 'acadmey', 'academi', 'akademy'],
    adizero: ['adi zero', 'adizro', 'adizer0', 'adizeroo'],
    adipure: ['adi pure', 'adipur', 'adipuer'],
    hyperfast: ['hyper fast', 'hyperfst', 'hypefast'],
    itunit: ['i tunit', 'itunite', 'ituni', 'itnuit'],
    speedflow: ['speed flow', 'speedflo', 'speedlfow', 'speedfow'],
    speedportal: ['speed portal', 'speedportel', 'speedprotal', 'speedportl'],
    ghosted: ['ghost', 'gosted', 'ghsoted'],
    accuracy: ['accurracy', 'acuracy', 'accuarcy', 'accurcy'],
    instinct: ['instict', 'insinct', 'instinkt'],
    sense: ['sence', 'sens'],
    venom: ['venon', 'vemon', 'venum'],
    vision: ['vison', 'visoin', 'vission'],
    luna: ['lunar', 'lunna'],
    obra: ['orba', 'obraa'],
    opus: ['opsu', 'opuss'],
    laser: ['lazer', 'lasar', 'laserr'],
    gt: [],
    gx: [],

    // Categories, conditions and grounds
    football: ['footbal', 'fotball', 'footbll', 'fooball', 'footbaal'],
    boots: ['boot', 'botts', 'bots', 'bootz', 'bootss'],
    accessories: ['accesories', 'accessorys', 'acessories', 'accessries', 'accesorries', 'acessorys'],
    sale: ['sael', 'slae'],
    grails: ['grail', 'grials', 'grals'],
    firm: ['frim', 'fim'],
    soft: ['sotf', 'sfot'],
    ground: ['grond', 'groudn', 'gound'],
    fg: ['f.g', 'f g', 'firmground'],
    sg: ['s.g', 's g', 'softground'],
    ag: ['a.g', 'a g'],
    worn: ['worne', 'wron'],
    laceless: ['lace less', 'laceles', 'lacless', 'lace-less'],

    // Players
    ronaldo: ['ronald', 'ronaldoo', 'ronalod', 'rnaldo'],
    cr7: ['cr 7', 'cr-7', 'cr07'],
    messi: ['mesi', 'messy', 'mess1', 'meesi'],
    neymar: ['neymer', 'neimar', 'nemar', 'neymr', 'neymarjr', 'ney'],
    pogba: ['pogbs', 'pogaba', 'pobga'],
    olise: ['olisse', 'ollise', 'oliese'],
    mbappe: ['mbape', 'mbappé', 'mbapee', 'mbappee', 'embappe'],
  };

  /** Everyday words in product titles: known, so never "corrected" into a model name */
  const COMMON = (
    'black white gold silver pink blue green orange yellow purple grey gray red volt crimson ' +
    'chrome bright dark light zoom air dream speed club pro kids junior mens womens size pack ' +
    'edition limited player sample used new sock socks cleats soccer studs stud artificial grass ' +
    'turf indoor leather knit primeknit flyknit dynamic fit low high mid laces lace boot boots ' +
    'football condition original rare vintage retro'
  ).split(' ');

  /** Brand, silo and generation collections search can suggest on their own */
  const COLLECTIONS = [
    ['Nike', '/collections/nike'],
    ['adidas', '/collections/adidas'],
    ['Puma', '/collections/puma-1'],
    ['Mizuno', '/collections/mizuno'],
    ['New Balance', '/collections/new-balance'],
    ['Nike Mercurial', '/collections/nike-mercurial'],
    ['Nike Mercurial Superfly', '/collections/mercurial'],
    ['Nike Mercurial Vapor', '/collections/superfly-copy'],
    ['Nike Phantom', '/collections/phantom-1'],
    ['Nike Tiempo', '/collections/tiempo-1'],
    ['Nike Tiempo Maestro', '/collections/nike-tiempo-maestro'],
    ['Nike Hypervenom', '/collections/hypervenom-1'],
    ['Nike Magista', '/collections/magista-1'],
    ['Nike Total 90', '/collections/total-91'],
    ['Nike CTR360', '/collections/ctr360-1'],
    ['adidas Predator', '/collections/predator-1'],
    ['adidas X', '/collections/x'],
    ['adidas F50', '/collections/f50'],
    ['adidas Copa', '/collections/copa'],
    ['adidas Nemeziz', '/collections/nemeziz'],
    ['adidas Crazyfast', '/collections/crazyfast'],
    ['adidas 11Pro', '/collections/11pro'],
    ['Puma Future', '/collections/puma-future'],
    ['Puma Ultra', '/collections/puma-ultra'],
    ['Puma evoPOWER', '/collections/puma-evopower'],
    ['Mizuno Morelia', '/collections/mizuno-morelia'],
    ['adidas 11Pro Elite', '/collections/adidas-11pro-elite'],
    ['adidas adiPure 11Pro', '/collections/adidas-adipure-11pro'],
    ['adidas Ace 15', '/collections/adidas-ace-15'],
    ['adidas Ace 16', '/collections/adidas-ace-16'],
    ['adidas Ace 17', '/collections/adidas-ace-17'],
    ['adidas Copa 19', '/collections/adidas-copa-19'],
    ['adidas Copa 20', '/collections/adidas-copa-20'],
    ['adidas Copa Pure', '/collections/adidas-copa-pure'],
    ['adidas Copa Sense', '/collections/adidas-copa-sense'],
    ['adidas F50 Adizero', '/collections/adidas-f50-adizero'],
    ['adidas F50 Elite', '/collections/adidas-f50-elite'],
    ['adidas F50 Hyperfast', '/collections/adidas-f50-hyperfast'],
    ['adidas F50 iTunit', '/collections/adidas-f50-itunit'],
    ['adidas Nemeziz 17', '/collections/adidas-nemeziz-17'],
    ['adidas Nemeziz 18', '/collections/adidas-nemeziz-18'],
    ['adidas Nemeziz 19', '/collections/adidas-nemeziz-19'],
    ['adidas Predator Accuracy', '/collections/adidas-predator-accuracy'],
    ['adidas Predator FT', '/collections/adidas-predator-ft'],
    ['adidas Predator Instinct', '/collections/adidas-predator-instinct'],
    ['adidas Predator LZ', '/collections/adidas-predator-lz'],
    ['adidas X 15', '/collections/adidas-x-15'],
    ['adidas X 16', '/collections/adidas-x-16'],
    ['adidas X 17', '/collections/adidas-x-17'],
    ['adidas X 18', '/collections/adidas-x-18'],
    ['adidas X 19', '/collections/adidas-x-19'],
    ['adidas X Crazyfast', '/collections/adidas-x-crazyfast'],
    ['adidas X Ghosted', '/collections/adidas-x-ghosted'],
    ['adidas X Speedflow', '/collections/adidas-x-speedflow'],
    ['adidas X Speedportal', '/collections/adidas-x-speedportal'],
    ['Nike CTR360 Maestri 1', '/collections/nike-ctr360-maestri-1'],
    ['Nike CTR360 Maestri 2', '/collections/nike-ctr360-maestri-2'],
    ['Nike CTR360 Maestri 3', '/collections/nike-ctr360-maestri-3'],
    ['Nike Hypervenom Phantom 1', '/collections/nike-hypervenom-phantom-1'],
    ['Nike Hypervenom Phantom 2', '/collections/nike-hypervenom-phantom-2'],
    ['Nike Hypervenom Phantom 3', '/collections/nike-hypervenom-phantom-3'],
    ['Nike Magista Obra 1', '/collections/nike-magista-obra-1'],
    ['Nike Magista Obra 2', '/collections/nike-magista-obra-2'],
    ['Nike Magista Opus 1', '/collections/nike-magista-opus-1'],
    ['Nike Magista Opus 2', '/collections/nike-magista-opus-2'],
    ['Nike Phantom 6', '/collections/nike-phantom-6'],
    ['Nike Phantom GT', '/collections/nike-phantom-gt'],
    ['Nike Phantom GT 2', '/collections/nike-phantom-gt-2'],
    ['Nike Phantom GX', '/collections/nike-phantom-gx'],
    ['Nike Phantom GX 2', '/collections/nike-phantom-gx-2'],
    ['Nike Phantom Luna', '/collections/nike-phantom-luna'],
    ['Nike Phantom Venom', '/collections/nike-phantom-venom'],
    ['Nike Phantom Vision', '/collections/nike-phantom-vision'],
    ['Nike Phantom Vision 2', '/collections/nike-phantom-vision-2'],
    ['Nike Total 90 Laser 3', '/collections/nike-total-90-laser-3'],
    ['Nike Total 90 Laser 4', '/collections/nike-total-90-laser-4'],
    ['Nike Tiempo Legend', '/collections/tiempo-1'],
  ]
    .concat(
      [3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => ['Nike Mercurial Superfly ' + n, '/collections/nike-mercurial-superfly-' + n]),
      [1, 3, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((n) => ['Nike Mercurial Vapor ' + n, '/collections/nike-mercurial-vapor-' + n]),
      [3, 4, 5, 6, 7, 8, 9, 10].map((n) => ['Nike Tiempo Legend ' + n, '/collections/nike-tiempo-legend-' + n]),
      [
        ['Accessories', '/collections/accessories-services'],
        ['Football Boots', '/collections/all-football-boots'],
        ['Grails', '/collections/grails'],
        ['Soft Ground', '/collections/soft-ground'],
        ['The CR7 Collection', '/collections/cr7'],
        ['The Messi Collection', '/collections/messi-1'],
        ['The Neymar Jr Collection', '/collections/neymar-jr'],
        ['The Pogba Collection', '/collections/pogba'],
        ['The Olise Collection', '/collections/olise'],
        ['Like New', '/collections/like-new'],
        ['Lightly Worn', '/collections/used-a-2'],
        ['New Arrivals', '/collections/new-arrivals-1'],
      ]
    )
    .map(([title, url]) => ({ title, url }));

  const squash = (text) => text.toLowerCase().replace(/[\s.\-_'’]+/g, '');
  const clean = (word) => word.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Misspelling (squashed) -> right spelling
  const fixes = new Map();
  // Every word the store knows
  const vocabulary = new Set();
  for (const right in TERMS) {
    right.split(' ').forEach((word) => vocabulary.add(clean(word)));
    TERMS[right].forEach((wrong) => fixes.set(squash(wrong), right));
  }
  COMMON.forEach((word) => vocabulary.add(word));
  COLLECTIONS.forEach((entry) => entry.title.split(/\s+/).forEach((word) => vocabulary.add(clean(word))));
  const words = Array.from(vocabulary).filter((word) => word.length >= 3 && /[a-z]/.test(word));

  /** Optimal string alignment distance (a swap of two letters counts as one slip) */
  function distance(a, b, limit) {
    if (Math.abs(a.length - b.length) > limit) return limit + 1;
    let prev2 = [];
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const row = [i];
      let best = i;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let value = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, prev2[j - 2] + 1);
        row.push(value);
        best = Math.min(best, value);
      }
      if (best > limit) return limit + 1;
      prev2 = prev;
      prev = row;
    }
    return prev[b.length];
  }

  /** @param {string} word - already cleaned */
  function fixWord(word) {
    if (!word || /^\d+$/.test(word) || vocabulary.has(word)) return word;
    if (fixes.has(word)) return fixes.get(word);
    if (word.length < 4) return word;
    // Still being typed: the start of a known word
    if (words.some((known) => known.startsWith(word))) return word;
    const limit = word.length >= 7 ? 2 : 1;
    let best = null;
    let bestDistance = limit + 1;
    let tie = false;
    for (const known of words) {
      if (known.length < 4) continue;
      const d = distance(word, known, limit);
      if (d < bestDistance) {
        best = known;
        bestDistance = d;
        tie = false;
      } else if (d === bestDistance) {
        tie = true;
      }
    }
    return best && !tie ? best : word;
  }

  /**
   * The query with misspellings put right
   * @param {string} query
   * @returns {{ query: string, changed: boolean }}
   */
  function correct(query) {
    const original = query.replace(/\s+/g, ' ').trim();
    // Split letters from trailing numbers ("vapor15" -> "vapor 15"), except names like f50 and ctr360
    const tokens = original
      .split(' ')
      .filter(Boolean)
      .flatMap((token) => {
        const clean_ = squash(token);
        if (fixes.has(clean_) || vocabulary.has(clean_)) return [token];
        const split = clean_.match(/^([a-z]{3,})(\d{1,2})$/);
        return split ? [split[1], split[2]] : [token];
      });

    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      // Two or three words that belong together ("hyper venom", "super fly", "ctr 360")
      let joined = null;
      for (const span of [3, 2]) {
        if (i + span > tokens.length) continue;
        const key = squash(tokens.slice(i, i + span).join(''));
        const spaced = squash(tokens.slice(i, i + span).join(' '));
        const hit = fixes.get(key) || fixes.get(spaced) || (vocabulary.has(key) && span === 2 && key);
        if (hit && (fixes.has(key) || !tokens.slice(i, i + span).every((t) => vocabulary.has(clean(t))))) {
          joined = hit;
          i += span - 1;
          break;
        }
      }
      if (joined) {
        out.push(joined);
        continue;
      }
      const token = tokens[i];
      const fixed = fixWord(squash(token));
      out.push(fixed === squash(token) ? token : fixed);
    }

    const result = out.join(' ');
    return { query: result, changed: result.toLowerCase() !== original.toLowerCase() };
  }

  /**
   * Collections whose names hold every word of the (corrected) query, most specific match first
   * @param {string} query
   * @param {number} [max]
   * @returns {{ text: string, url: string }[]}
   */
  function collections(query, max) {
    const queryWords = query.split(/\s+/).map(clean).filter(Boolean);
    if (!queryWords.length) return [];
    return COLLECTIONS.map((entry, index) => {
      const titleWords = entry.title.split(/\s+/).map(clean);
      const all = queryWords.every((word) =>
        titleWords.some((titleWord) => (/^\d+$/.test(word) ? titleWord === word : titleWord.startsWith(word)))
      );
      return all ? { entry, extra: titleWords.length - queryWords.length, index } : null;
    })
      .filter(Boolean)
      .sort((a, b) => a.extra - b.extra || a.index - b.index)
      .slice(0, max || 4)
      .map((match) => ({ text: match.entry.title, url: match.entry.url }));
  }

  /** @param {string} text */
  function collectionUrl(text) {
    const key = clean(text);
    const found = COLLECTIONS.find((entry) => clean(entry.title) === key);
    return found ? found.url : null;
  }

  window.OceSearchSpelling = { TERMS, COLLECTIONS, correct, collections, collectionUrl };
})();
