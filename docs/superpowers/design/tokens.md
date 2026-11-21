# Fits — design tokens

Mockups: `screens.html` in this folder (open it in a browser). Every UI task builds from these tokens and screens; don't invent new styling.

## Concept: "Colour-block season"
A fashion shoot set crossed with a fixture card. **Each tab is its own coloured set**, with a soft arch backdrop behind the content, like a studio backdrop. **Battles use the slanted versus seam**, with a pink side and a cobalt side and a butter "vs" badge. Headings and names are set in an italic Didone, like a fashion magazine. Content sits on white panels; nothing else is decorated.

## Colour
| Token | Hex | Use |
|---|---|---|
| `--ink` | `#1E1238` | Text, primary buttons, bottom nav, capture screen background |
| `--white` | `#FFFFFF` | Panels, inputs, chat bubbles |
| `--lilac` | `#CDB8FF` | **Today** set (and the app's default background) |
| `--mint` | `#8FE3BF` | **League** set; highlights your row in the table |
| `--butter` | `#FFE066` | **Chat** and **Vote** sets; the "vs" badge and the "+3" stamp |
| `--tangerine` | `#FF8A3D` | **Group** (settings) and **Join** sets |
| `--home` | `#FF3E8A` | Left battle side; **Results** set; shutter button, toggles |
| `--away` | `#2B44FF` | Right battle side; **Wrapped** base colour; focus ring |
| `--muted` | `rgba(30,18,56,.72)` | Secondary text (ink at 72%, so it stays readable on every set colour) |
| `--line` | `rgba(30,18,56,.14)` | Row dividers |
| `--up` / `--down` | `#0F7A55` / `#D93A3F` | Rank arrows; forfeit −1 |

### Sets (screen background + arch backdrop)
| Screen | Background | Arch |
|---|---|---|
| Today | lilac | white 35% |
| Vote / share-link vote | butter | white 45% |
| Results | home pink | butter 55% |
| League | mint | white 40% |
| Chat | butter | white 45% |
| Group settings | tangerine | butter 50% |
| Join | tangerine | lilac 60% |
| Capture | ink | lilac 12% (the only dark screen) |
| Wrapped | cobalt, with each card using a different pairing | pink 85% |

The arch is a 330×620 shape with a fully rounded top, centred, starting 70px from the top of the screen (`::before`, `pointer-events:none`). The bottom nav is ink, and the active tab's dot takes that tab's set colour.

## Type
- **Display: Bodoni Moda** (Google Fonts, optical sizes 6–96, weights 500/700, roman + italic). **Italic 700** for headings, names on photos, the "vs" badge, stamps, the invite code and Wrapped numbers. Roman 700 for scores, times and table points.
- **Body/UI: Schibsted Grotesk** 400/500/700, for everything else. Table figures use `tabular-nums`.
- Scale (px): 13 / 15 / 17 / 22 / 32 / 40 / 56 / 104. Headings are 40px. Body is 15–17px, line-height 1.45.
- Sentence case everywhere. No all-caps labels and no eyebrow labels. Don't use Bodoni below 20px (its hairlines disappear).

## Shape and spacing
- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48.
- Radius by hierarchy: outfit photos 24px, panels 18px, inputs 12px, buttons fully round (pill).
- Photos and the versus card get one soft shadow: `0 18px 30px -18px rgba(30,18,56,.5)`. Nothing else has a shadow.
- The versus seam is a 10° slant between the two photos (CSS `clip-path`), with a 66px butter badge ringed in ink.
- Phone-first: designed at 390px wide, single column, sticky bottom nav (Today, League, Chat, Group).

## Motion
- One orchestrated moment only: **the results reveal.** Vote bars fill from the middle (900ms ease-out), then the "+3" stamps in. Respect `prefers-reduced-motion` (show the final state instantly).
- Elsewhere, motion only responds to taps (the unpicked vote side fades).

## Copy voice
Plain, sentence case, with a little runway swagger. Buttons say exactly what happens: "Post my fit", "Vote for Marcus", "Reveal results now", "Save settings". Errors explain how to fix things ("Camera blocked. Allow camera access in your browser settings to post your fit.").
