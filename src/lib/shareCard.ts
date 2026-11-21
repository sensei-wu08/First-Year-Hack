import { APP_NAME, TAGLINE } from '../brand'

// ---------- Data ----------

/** One drawable piece of a Wrapped card, in top-to-bottom order. */
export type ShareBlock =
  | { kind: 'hero'; text: string }
  | { kind: 'title'; text: string }
  | { kind: 'line'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'rows'; rows: { rank: string; name: string; sub?: string; end: string }[] }
  | { kind: 'photo'; url: string; label: string; badge: string }

/** What a story card needs to be drawn as an image. */
export interface ShareCardData {
  chip?: string
  blocks: ShareBlock[]
}

/** Card colour names, matching the `--color-*` tokens in theme.css. */
export type ShareTone = 'pink' | 'lime' | 'sky' | 'tangerine'

export interface Palette {
  bg: string
  ink: string
  white: string
  lime: string
}

export type Measure = (text: string) => number

// ---------- Pure helpers ----------

/** Greedy line wrapper. Words wider than `maxWidth` are broken by character. */
export function wrapText(measure: Measure, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const tryLine = line ? `${line} ${word}` : word
    if (measure(tryLine) <= maxWidth) {
      line = tryLine
      continue
    }
    if (line) lines.push(line)
    line = ''
    if (measure(word) <= maxWidth) {
      line = word
      continue
    }
    for (const ch of Array.from(word)) {
      if (line && measure(line + ch) > maxWidth) {
        lines.push(line)
        line = ch
      } else {
        line += ch
      }
    }
  }
  if (line) lines.push(line)
  return lines
}

/** Keeps the first `max` lines and ends the last one with an ellipsis when something was cut. */
export function clampLines(lines: string[], max: number): string[] {
  if (lines.length <= max) return lines
  const kept = lines.slice(0, max)
  kept[max - 1] = `${kept[max - 1].replace(/[\s.,;:!?…]+$/, '')}…`
  return kept
}

/** Shortens a single line with an ellipsis until it fits. */
export function fitText(measure: Measure, text: string, maxWidth: number): string {
  if (measure(text) <= maxWidth) return text
  const chars = Array.from(text)
  while (chars.length > 1 && measure(`${chars.join('').trimEnd()}…`) > maxWidth) chars.pop()
  return `${chars.join('').trimEnd()}…`
}

// ---------- Drawing ----------

export const CARD_W = 1080
export const CARD_H = 1920
const PAD = 56
const GAP = 36
const DISPLAY = '"Unbounded", system-ui, sans-serif'
const BODY = '"Plus Jakarta Sans", system-ui, sans-serif'

type Ctx = CanvasRenderingContext2D

function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

interface Item {
  /** Fixed height, or null when the item takes the space that is left. */
  h: number | null
  draw(y: number, h: number): void
}

function measurer(ctx: Ctx): Measure {
  return (s) => ctx.measureText(s).width
}

/** Draws the whole card. `photo` is already loaded, or null to skip it. */
export function drawCard(ctx: Ctx, pal: Palette, data: ShareCardData, photo: CanvasImageSource | null): void {
  const m = measurer(ctx)
  const maxW = CARD_W - PAD * 2
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillStyle = pal.bg
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  // Footer: wordmark and tagline.
  ctx.font = `600 30px ${BODY}`
  const tagLines = clampLines(wrapText(m, TAGLINE, maxW), 2)
  const footerH = 72 + 14 + tagLines.length * 40
  const footerTop = CARD_H - PAD - footerH
  ctx.fillStyle = pal.ink
  ctx.font = `800 72px ${DISPLAY}`
  ctx.fillText(APP_NAME, PAD, footerTop)
  ctx.font = `600 30px ${BODY}`
  tagLines.forEach((l, i) => ctx.fillText(l, PAD, footerTop + 72 + 14 + i * 40))

  // Chip.
  let top = 150
  if (data.chip) {
    let size = 36
    ctx.font = `700 ${size}px ${BODY}`
    while (size > 22 && m(data.chip) > maxW - 56) {
      size -= 2
      ctx.font = `700 ${size}px ${BODY}`
    }
    const w = Math.min(maxW, m(data.chip) + 56)
    const h = 76
    ctx.fillStyle = pal.ink
    roundRectPath(ctx, PAD, top, w, h, h / 2)
    ctx.fill()
    ctx.fillStyle = pal.white
    ctx.fillText(data.chip, PAD + 28, top + (h - size) / 2 - 2)
    top += h + GAP
  }

  // Blocks, laid out top to bottom. A photo block takes whatever height is left.
  const items: Item[] = data.blocks.map((b) => blockItem(ctx, pal, b, photo, m, maxW))
  const bottom = footerTop - GAP
  const fixed = items.reduce((sum, it) => sum + (it.h ?? 0), 0) + GAP * Math.max(0, items.length - 1)
  const flexH = Math.max(360, bottom - top - fixed)
  let y = top
  for (const it of items) {
    const h = it.h ?? flexH
    it.draw(y, h)
    y += h + GAP
  }
}

function textItem(ctx: Ctx, fill: string, font: string, text: string, lh: number, maxW: number, maxLines: number): Item {
  ctx.font = font
  const lines = clampLines(wrapText(measurer(ctx), text, maxW), maxLines)
  return {
    h: lines.length * lh,
    draw(y) {
      ctx.font = font
      ctx.fillStyle = fill
      lines.forEach((l, i) => ctx.fillText(l, PAD, y + i * lh))
    },
  }
}

function blockItem(
  ctx: Ctx,
  pal: Palette,
  b: ShareBlock,
  photo: CanvasImageSource | null,
  m: Measure,
  maxW: number,
): Item {
  switch (b.kind) {
    case 'hero': {
      let size = b.text.length > 3 ? 232 : 366
      ctx.font = `800 ${size}px ${DISPLAY}`
      while (size > 60 && m(b.text) > maxW) {
        size = Math.floor(size * 0.92)
        ctx.font = `800 ${size}px ${DISPLAY}`
      }
      const font = ctx.font
      return {
        h: Math.round(size * 0.95),
        draw(y) {
          ctx.font = font
          ctx.fillStyle = pal.ink
          ctx.fillText(b.text, PAD, y)
        },
      }
    }
    case 'title':
      return textItem(ctx, pal.ink, `800 78px ${DISPLAY}`, b.text, 86, maxW, 3)
    case 'line':
      return textItem(ctx, pal.ink, `800 55px ${BODY}`, b.text, 66, 760, 5)
    case 'quote': {
      const long = b.text.length > 120
      return textItem(ctx, pal.ink, `800 ${long ? 55 : 78}px ${DISPLAY}`, `“${b.text}”`, long ? 68 : 94, maxW, long ? 9 : 6)
    }
    case 'rows': {
      const heights = b.rows.map((r) => (r.sub ? 132 : 100))
      const total = heights.reduce((a, c) => a + c, 0) + 22 * Math.max(0, b.rows.length - 1)
      return {
        h: total,
        draw(y) {
          let ry = y
          b.rows.forEach((r, i) => {
            const h = heights[i]
            ctx.save()
            ctx.globalAlpha = 0.55
            ctx.fillStyle = pal.white
            roundRectPath(ctx, PAD, ry, maxW, h, h / 2)
            ctx.fill()
            ctx.restore()
            ctx.fillStyle = pal.ink
            ctx.font = `800 40px ${DISPLAY}`
            const endW = m(r.end)
            ctx.fillText(r.end, PAD + maxW - 40 - endW, ry + (h - 40) / 2)
            ctx.textAlign = 'center'
            ctx.fillText(r.rank, PAD + 70, ry + (h - 40) / 2)
            ctx.textAlign = 'left'
            const nameX = PAD + 140
            const nameW = maxW - 140 - 40 - endW - 24
            ctx.font = `800 44px ${BODY}`
            const name = fitText((s) => ctx.measureText(s).width, r.name, nameW)
            if (r.sub) {
              ctx.fillText(name, nameX, ry + 20)
              ctx.font = `600 30px ${BODY}`
              ctx.fillText(fitText((s) => ctx.measureText(s).width, r.sub, nameW), nameX, ry + 76)
            } else {
              ctx.fillText(name, nameX, ry + (h - 44) / 2 - 2)
            }
            ry += h + 22
          })
        },
      }
    }
    case 'photo':
      return {
        h: null,
        draw(y, h) {
          ctx.save()
          roundRectPath(ctx, PAD, y, maxW, h, 66)
          ctx.clip()
          ctx.fillStyle = pal.ink
          ctx.fillRect(PAD, y, maxW, h)
          if (photo) {
            const iw = Number((photo as HTMLImageElement).naturalWidth) || maxW
            const ih = Number((photo as HTMLImageElement).naturalHeight) || h
            const s = Math.max(maxW / iw, h / ih)
            ctx.drawImage(photo, PAD + (maxW - iw * s) / 2, y + (h - ih * s) / 2, iw * s, ih * s)
          }
          ctx.restore()
          // Vote-share badge, tilted like the sticker on the card.
          ctx.save()
          ctx.font = `700 36px ${BODY}`
          const bw = m(b.badge) + 44
          ctx.translate(PAD + 38, y + 38)
          ctx.rotate((-6 * Math.PI) / 180)
          ctx.fillStyle = pal.lime
          roundRectPath(ctx, 0, 0, bw, 64, 32)
          ctx.fill()
          ctx.fillStyle = pal.ink
          ctx.fillText(b.badge, 22, 14)
          ctx.restore()
          // Name on the photo.
          ctx.save()
          ctx.font = `800 50px ${DISPLAY}`
          ctx.fillStyle = pal.white
          ctx.shadowColor = pal.ink
          ctx.shadowBlur = 24
          ctx.fillText(fitText((s) => ctx.measureText(s).width, b.label, maxW - 76), PAD + 38, y + h - 38 - 50)
          ctx.restore()
        },
      }
  }
}

// ---------- Browser side (thin) ----------

function cssColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim()
}

function readPalette(tone: ShareTone): Palette {
  return { bg: cssColor(tone), ink: cssColor('ink'), white: cssColor('white'), lime: cssColor('lime') }
}

async function ensureFonts(): Promise<void> {
  try {
    await document.fonts.ready
    await Promise.all([
      document.fonts.load('800 132px Unbounded'),
      document.fonts.load('800 40px "Plus Jakarta Sans"'),
      document.fonts.load('700 40px "Plus Jakarta Sans"'),
      document.fonts.load('600 30px "Plus Jakarta Sans"'),
    ])
  } catch {
    // Fall back to whatever is available rather than failing the share.
  }
}

function loadPhoto(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    const timer = setTimeout(() => resolve(null), 8000)
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      clearTimeout(timer)
      resolve(img)
    }
    img.onerror = () => {
      clearTimeout(timer)
      resolve(null)
    }
    img.src = url
  })
}

function render(pal: Palette, data: ShareCardData, photo: HTMLImageElement | null): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('no canvas'))
  drawCard(ctx, pal, data, photo)
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
    } catch (e) {
      reject(e)
    }
  })
}

export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

/** Renders the card to a 1080x1920 PNG, then shares it or downloads it. Rejects on real failures. */
export async function shareCardImage(data: ShareCardData, tone: ShareTone): Promise<ShareResult> {
  await ensureFonts()
  const pal = readPalette(tone)
  const photoUrl = data.blocks.find((b) => b.kind === 'photo')?.url
  const photo = photoUrl ? await loadPhoto(photoUrl) : null
  let blob: Blob
  try {
    blob = await render(pal, data, photo)
  } catch (e) {
    // A tainted canvas can't be exported: draw again without the photo.
    if (!photo) throw e
    blob = await render(pal, data, null)
  }

  const file = new File([blob], 'fits-wrapped.png', { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'My Fits Wrapped' })
      return 'shared'
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled'
      throw e
    }
  }

  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = 'fits-wrapped.png'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
  return 'downloaded'
}
