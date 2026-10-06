# Brand guide (observed, not official)

This prototype borrows the visual language of Bolt Pharmacy so reviewers can judge it in context. It is an **unofficial, independent concept**. Bolt Pharmacy and AIOS have not reviewed or endorsed it. The Bolt name and logo belong to their owner (Bolt Healthcare Ltd / AIOS); they are used here only to identify the product the concept is about.

## Sources observed (2026-10-06)
| What | Source |
| --- | --- |
| Rendered home page, 390 px and 1440 px | https://www.boltpharmacy.co.uk/ (screenshots in `docs/evidence/`) |
| Official logo (unmodified) | https://cdn.prod.website-files.com/68072c16317fc2e0431a531c/6a8fd92111c6f0666675c026_bolt-logo_horizontal_colour-whitebg_transp.svg → `public/brand/bolt-logo-horizontal.svg` |
| Favicon (unmodified) | https://cdn.prod.website-files.com/68072c16317fc2e0431a531c/6a9a6f975826064dd3518025_bolt-favicon.png → `public/brand/bolt-favicon.png` |
| Design tokens | https://cdn.prod.website-files.com/68072c16317fc2e0431a531c/css/boltpharmacy.shared.7c72c5e4f.min.css (the current `--_bolt-v2---*` variables) |
| Existing app scope | https://apps.apple.com/gb/app/bolt-pharmacy/id6759058529 (order tracking, re-ordering, weight/dose logs, reminders) |

Only the current `--_bolt-v2---*` token set was used. Older variables in the same stylesheet (`--brand--*`, `--_m-vmt---*`, `--_brx---*`) belong to legacy templates and were deliberately ignored.

## What the live site looks like
White canvas; dark navy, heavy, tightly set headings; slate body copy; one bright blue rounded call to action per view; the logo's green-to-blue mark as the only gradient. No dark mode, no glassmorphism.

## Tokens used
| Role | Token in Bolt CSS | Value | Used for |
| --- | --- | --- | --- |
| Page | `bg--page` | `#ffffff` | Canvas |
| Raised surface | `bg--raised` | `#f5f9ff` | Cards |
| Sunken surface | `bg--sunken` | `#ebf2fe` | Preview panes, chips |
| Heading | `text--heading` | `#001c54` | Headings, logo wordmark |
| Primary text | `text--primary` | `#172233` | Body |
| Secondary text | `text--secondary` | `#5a6a84` | Captions |
| Primary action | `action--primary` | `#005ee3` | One main button per screen, focus ring (`border--focus`) |
| Border | `border--default` / `border--subtle` | `#ced8e7` / `#dee5f2` | Card and input borders |
| Accent | `accent--accent` | `#1e7779` | Positive state text (AA on white) |
| Accent surface | `accent--surface` / `green--025` | `#58ff8a` / `#d7fedd` | Small positive badges only |
| Caution | `orange--400` on `orange--050` | `#b53700` / `#ffdcd1` | Revoked / guardrail states |
| Hold | `yellow--500` on `yellow--050` | `#464330` / `#fee75c` | "Hold for more evidence" |
| Radius | `radius--500` (buttons, 1.25rem), `radius--600` (cards) | | |

Contrast checks (WCAG 2.1 relative luminance, computed): `#005ee3` on white 5.66:1 (and white on `#005ee3`); `#001c54` on white 16.23:1; `#5a6a84` on white 5.48:1 and on `#f5f9ff` 5.19:1; `#1e7779` on white 5.29:1; `#b53700` on `#ffdcd1` 4.67:1; `#464330` on `#fee75c` 7.98:1; `#114c4d` on `#d7fedd` 8.83:1. All meet AA (4.5:1) for body text.

## Type
The live site uses **Bolt Display** (headings, weight 800) and **Bolt Sans Flex** (body). These are proprietary brand fonts with no public licence, so they are **not** used. The substitute is **Inter Tight** (variable, SIL Open Font License 1.1, `public/fonts/`), chosen because it is a compact grotesque that holds a heavy weight close to the observed headings. Headings use weight 800 with tight tracking; body uses 400–600.

## Logo rules applied
- The official SVG is used as downloaded: not redrawn, recoloured, cropped or animated.
- It always sits on white, with clear space at least the height of the mark's crossbar.
- It is always accompanied by the persistent label "Independent product prototype - synthetic demo".
- No look-alike or derivative mark was created.

## What is deliberately not borrowed
- Prescription marketing, eligibility checks, medication imagery, prices, Trustpilot ratings, patient counts or any sales flow.
- Photography and illustrations from the site.
- Medical-effectiveness or weight-loss claims.

## Voice
Calm, plain and adult. Short sentences. Permission-giving ("You can stop at any time"), never pressure ("Don't lose your streak"). Celebrate asking for support, not body change.
