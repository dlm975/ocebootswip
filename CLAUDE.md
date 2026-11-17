# OCEBOOTS theme redesign (Shopify Horizon)

## Animation
- Build animations with Motion (motion.dev). It's bundled as `assets/motion.js` and mapped in
  the import map (`snippets/scripts.liquid`), so module scripts use
  `import { animate, spring, stagger } from 'motion';`. That's the mini animate (runs on Web
  Animations) plus springs and stagger. If something else from Motion is needed, add it to
  `scripts/motion-entry.js` and rebuild with `npm run build:motion` (keep it small).
- Plain (non-module) scripts can use `import('motion')`.
- Simple state changes (colour, opacity on hover) can stay CSS transitions.
- The bar is the menu drawer: smooth, no one-frame flashes or jumps, interruptible, measured
  and started in the same frame, heights eased, `prefers-reduced-motion` respected. Get it
  right on the first build of each part, so it doesn't need revisiting.
- House timing: 0.55s `cubic-bezier(0.3, 0.7, 0.3, 1)` for things moving into place; quick
  fades (~0.18–0.25s) on the way out.

## Working on the theme
- Branch `claude/funny-euler-txg5jg`; also push to `swatch-test`, which syncs to the unpublished
  theme "ocebootswip/swatch-test" (preview: https://oceboots.com/?preview_theme_id=191381766455).
  Allow ~1–2 minutes for the sync, then verify on the preview (Playwright, iPhone 13 + desktop).
- Never edit or publish the live theme.
- The theme sync rejects Liquid parse errors (e.g. `{{` inside a JS comment). Push a new
  section before a template that uses it.
- `{% stylesheet %}` drops selectors it doesn't know (e.g. `::details-content`): put those in
  `assets/base.css`.
