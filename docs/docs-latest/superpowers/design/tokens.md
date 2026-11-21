# Fits — design tokens

Mockups: `screens.html` in this folder (open it in a browser). Every UI task builds from these tokens and screens; don't invent new styling.

## Concept: "Sticker-book bento"
A **violet canvas** holding **chunky, rounded tiles in many colours** (lime, pink, sky, tangerine, mint, lavender, ink, white), so every screen mixes several colours. Pill chips, a floating ink pill nav with a lime active tab, and a few **stickers** (4-point sparkles, tilted vote-share badges, the "+3" stamp) give a scrapbook, fit-check feel. **Battles keep the slanted versus seam**: pink side against sky side, with a tilted lime "vs" badge.

## Colour
| Token | Hex | Use |
|---|---|---|
| `--violet` | `#5B34F2` | App canvas (every screen's background) |
| `--ink` | `#170B3B` | Text on light tiles, the nav pill, dark tiles (table, invite code), capture screen |
| `--white` | `#FFFFFF` | Text on violet/ink; inputs; neutral panels (settings, score) |
| `--lime` | `#D6FF4F` | **Primary action** (all main buttons), active nav tab, your row in the table, stickers, "vs" badge |
| `--pink` | `#FF4FA0` | **Home side** of a battle; "post by" time; highlight tiles |
| `--sky` | `#47C6FF` | **Away side** of a battle; "results" time |
| `--tangerine` | `#FF8A2A` | Secondary tiles (next battle, settings toggles panel), chat bubbles |
| `--mint` | `#5BE3B0` | "Matches out" time; secondary tiles |
| `--lavender` | `#B9A4FF` | Quiet tiles (yesterday's result, battles-per-day chip) |
| `--down` | `#FF5C5C` | Rank down, forfeit −1. Rank up uses lime. |

Rules:
- **Text on lime, pink, sky, tangerine, mint, lavender and white tiles is ink. Text on violet and ink is white.**
- The three daily times always use the same colours everywhere: **09:00 mint, 12:00 pink, 18:00 sky.**
- Chat: each person keeps one bubble colour (from sky, tangerine, pink, mint, lavender); yours is lime.
- Wrapped cards are full-bleed, each a different colour (pink, lime, sky, tangerine), with ink text.

## Type
- **Display: Unbounded** (Google Fonts) 800 (and 600). Used for screen headings (28px), tile headings (16–20px), names on photos (18px), times (18px), scores (84px), Wrapped numbers (132px), table points and the invite code.
- **Body/UI: Plus Jakarta Sans** 400/600/700/800, for everything else. Table figures use `tabular-nums`.
- Scale (px): 12 / 13 / 15 / 16 / 18 / 20 / 28 / 84 / 132. Body is 15px, line-height 1.45.
- Sentence case everywhere. No all-caps labels.

## Shape and spacing
- Screen padding 14px, gap between tiles 10px. Tile padding 16px (12px for small tiles).
- Radius: tiles 28px, photos 24px, inputs 16px, chips/buttons/nav fully round (pill). Chat bubbles 20px with one 6px corner.
- No drop shadows on tiles; colour separates them.
- **Versus seam:** a 10° slant between the two photos (CSS `clip-path`), with a 62px lime badge tilted −8° and ringed in ink.
- **Stickers** (use sparingly, at most two per screen): a 4-point sparkle SVG (lime or pink, 40–54px), a tilted lime pill with a percentage, and the "+3" stamp.
- **Nav:** an ink pill 64px high, 14px from the screen edges and bottom, with the active tab as a lime pill.
- Phone-first: designed at 390px wide, single column.

## Motion
- One orchestrated moment only: **the results reveal.** Vote bars fill from the middle (900ms ease-out), then the "+3" sticker stamps in (scales down from 1.8 with a slight bounce). Respect `prefers-reduced-motion` (show the final state instantly).
- Elsewhere, motion only responds to taps (the unpicked vote side fades).

## Copy voice
Plain, sentence case, playful. Buttons say exactly what happens: "Post my fit", "Vote for Marcus", "Reveal results now", "Save settings". Errors explain how to fix things ("Camera blocked. Allow camera access in your browser settings to post your fit.").
