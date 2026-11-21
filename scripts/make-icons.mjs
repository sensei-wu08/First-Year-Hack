// Placeholder icon generator for Fits. Built-ins only (fs, zlib), no dependencies.
// Run: node scripts/make-icons.mjs
// Draws a lime "F" (rounded rectangles) on a violet square with a small pink/sky slanted seam,
// writes public/icons/icon.svg and the PNGs. Replace the shapes (or just the PNGs) once the
// team's real icon arrives.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'icons')

const VIOLET = [0x5b, 0x34, 0xf2]
const LIME = [0xd6, 0xff, 0x4f]
const PINK = [0xff, 0x4f, 0xa0]
const SKY = [0x47, 0xc6, 0xff]
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')

// Shapes on a 512 grid. Rounded rects: centre (cx, cy), size (w, h), corner radius r, rotation in degrees.
const rr = (x, y, w, h, r, rot = 0, color) => ({ cx: x + w / 2, cy: y + h / 2, w, h, r, rot, color })
const SHAPES = [
  rr(132, 112, 82, 272, 41, 0, LIME), // stem
  rr(132, 112, 188, 82, 41, 0, LIME), // top bar
  rr(132, 222, 158, 74, 37, 0, LIME), // middle bar
  rr(323, 238, 26, 150, 13, 10, PINK), // seam, home side
  rr(355, 238, 26, 150, 13, 10, SKY), // seam, away side
]

// Signed distance from (px, py) to a rotated rounded rect (negative inside).
function sdf(s, px, py) {
  const a = (-s.rot * Math.PI) / 180
  const dx = px - s.cx
  const dy = py - s.cy
  const x = dx * Math.cos(a) - dy * Math.sin(a)
  const y = dx * Math.sin(a) + dy * Math.cos(a)
  const qx = Math.abs(x) - (s.w / 2 - s.r)
  const qy = Math.abs(y) - (s.h / 2 - s.r)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - s.r
}

// Render at `size` px; `scale` shrinks the artwork about the centre (maskable safe zone).
function render(size, scale) {
  const SS = 4
  const buf = Buffer.alloc(size * size * 3)
  const k = 512 / size
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const acc = [0, 0, 0]
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const gx = (px + (sx + 0.5) / SS) * k
          const gy = (py + (sy + 0.5) / SS) * k
          const ux = (gx - 256) / scale + 256
          const uy = (gy - 256) / scale + 256
          let c = VIOLET
          for (const s of SHAPES) if (sdf(s, ux, uy) <= 0) c = s.color
          acc[0] += c[0]
          acc[1] += c[1]
          acc[2] += c[2]
        }
      }
      const o = (py * size + px) * 3
      buf[o] = Math.round(acc[0] / (SS * SS))
      buf[o + 1] = Math.round(acc[1] / (SS * SS))
      buf[o + 2] = Math.round(acc[2] / (SS * SS))
    }
  }
  return buf
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (b) => {
  let c = 0xffffffff
  for (const v of b) c = crcTable[(c ^ v) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}
function png(size, rgb) {
  const raw = Buffer.alloc((size * 3 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0
    rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // truecolour RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function svg() {
  const els = SHAPES.map(
    (s) =>
      `  <rect x="${s.cx - s.w / 2}" y="${s.cy - s.h / 2}" width="${s.w}" height="${s.h}" rx="${s.r}" fill="${hex(s.color)}"` +
      (s.rot ? ` transform="rotate(${s.rot} ${s.cx} ${s.cy})"` : '') +
      '/>',
  ).join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">\n  <rect width="512" height="512" fill="${hex(VIOLET)}"/>\n${els}\n</svg>\n`
}

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'icon.svg'), svg())
const targets = [
  [join(outDir, 'icon-192.png'), 192, 1],
  [join(outDir, 'icon-512.png'), 512, 1],
  [join(outDir, 'icon-maskable-512.png'), 512, 0.8], // artwork inside the 80% safe zone
  [join(root, 'public', 'apple-touch-icon.png'), 180, 1],
]
for (const [file, size, scale] of targets) {
  writeFileSync(file, png(size, render(size, scale)))
  console.log('wrote', file)
}
