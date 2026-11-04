# Your plan: surfaces audit

3 November 2026, before the judges' preview. Scope: the page canvas and the component shells on `/plan`, meaning the calendar panel, the Your courses rail panel and its well, the course card shells, and the rail footer. Out of scope: buttons, labels, and the class blocks (colors, hatch, dotted edge).

## What the surfaces must do

- Separate three layers at a glance: page, panel, card.
- Leave the class blocks and the red Confirm plan button as the loudest things on screen.
- Hold up in a 20-second look on a projector or laptop, where a 1.5% lightness step disappears.

## Review (emil-ui-review, surfaces dimension)

Verdict: approve with changes. Nothing breaks, but the page reads as one white sheet.

| Before | After | Why |
|---|---|---|
| Canvas `oklch(0.985 0.002 262)` (`.plan.workspace`) against white panels: a 0.015 lightness step | A canvas at least 0.03 to 0.05 darker than the panel surface, or a tinted one | Panels currently separate only through a 5% alpha shadow, so on a projector the page is flat white |
| The top bar, canvas, calendar and rail cards are all white or near-white | Give at least one layer a fill that is not white | No figure and ground; nothing reads as a container until you hover |
| Rail well `color-mix(muted 55%, surface)` ≈ L 0.975 with white cards ringed at 6% | Make the well deep enough that white cards read as cards, or drop the cards' ring and let the fill do it | Cards and well blend, so the rail reads as a list of outlines |
| The calendar's hour gutter, day header and grid share one white | Tone the gutter and header apart from the grid | The calendar has no internal structure besides 6% rules |
| Every neutral sits on hue 262 at chroma ≤ 0.006 | A deliberate temperature, either kept cool with more contrast or chosen | The cool gray was chosen for Linear-like calm; at this lightness it reads as unchosen |
| Panel radius 12px, card radius 12px inside 12px padding | Card radius = panel radius − inset (12 − 12 → use ~8px, or raise the panel's) | Concentric radii (emil-surfaces) |
| Elevation on both panels, rings on cards, borders on footer and header | One depth system per layer | emil-surfaces: one depth cue per surface |

## Direction

1. Keep the class blocks, buttons and labels exactly as they are; every variant is CSS on shells and tokens only.
2. Try contrast, temperature, brand hue and depth system as separate axes, on the real page with real data.
3. Choose one and fold it into `schedule-pair.css` and `plan.css`. Record the rejected options in `productthink.md`.

## Open questions

- `productthink.md` sets cool gray neutrals. The Paper and Cherry variants change that, and choosing either one updates the product notes.
- Should the top bar follow the canvas or stay white?

## Sources

`~/.claude/skills/emil-surfaces/SKILL.md`, `~/.claude/skills/emil-color/SKILL.md`, `~/.claude/skills/emil-ui-review/STANDARDS.md`. This is a visual-tone question, so I did no outside research.

## Outcome

Kept Current, 3 November 2026. Tray, Paper, Cherry and Flat were built as CSS-only variants on the real page and compared. Paper and Cherry were refined once, because warm shells under cool text, chips and buttons read as off. Rafiat still preferred Current, and the prototype route was deleted.

One fix carried over: `.sp-week-head` declared both `backdrop-filter` and `-webkit-backdrop-filter`. Lightning CSS kept only the last one, so the intended blur on the day header never applied. The stylesheet now declares only the unprefixed property.
