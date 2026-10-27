import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'textures', 'roof')
mkdirSync(out, { recursive: true })

function rolls(seed) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

const shade = (hex, by) => {
  const value = Number.parseInt(hex.slice(1), 16)
  const channel = (shift) =>
    Math.max(0, Math.min(255, Math.round(((value >> shift) & 255) * (1 + by))))
  return `#${[16, 8, 0].map((s) => channel(s).toString(16).padStart(2, '0')).join('')}`
}

const SIZE = 1000

function tiles(colour, seed) {
  const random = rolls(seed)
  const row = 250
  const width = 250
  let body = `<rect width="${SIZE}" height="${SIZE}" fill="${shade(colour, -0.35)}"/>`
  for (let y = -row; y < SIZE + row; y += row) {
    const offset = (y / row) % 2 === 0 ? 0 : width / 2
    for (let x = -width; x < SIZE + width; x += width) {
      const left = x + offset
      const tone = shade(colour, (random() - 0.5) * 0.16)
      body += `<path d="M ${left + 6} ${y} L ${left + width - 6} ${y} L ${left + width - 6} ${y + row - 40} Q ${left + width / 2} ${y + row + 18} ${left + 6} ${y + row - 40} Z" fill="${tone}"/>`
      body += `<path d="M ${left + width * 0.62} ${y + 10} L ${left + width * 0.62} ${y + row - 30}" stroke="${shade(tone, -0.18)}" stroke-width="14" stroke-linecap="round"/>`
      body += `<path d="M ${left + 14} ${y + 12} L ${left + width * 0.45} ${y + 12}" stroke="${shade(tone, 0.18)}" stroke-width="10" stroke-linecap="round" stroke-opacity="0.6"/>`
    }
  }
  return body
}

function seam(colour) {
  let body = `<rect width="${SIZE}" height="${SIZE}" fill="${colour}"/>`
  for (let x = 0; x < SIZE; x += 500) {
    body += `<rect x="${x}" width="250" height="${SIZE}" fill="${shade(colour, 0.04)}"/>`
    body += `<rect x="${x + 489}" width="10" height="${SIZE}" fill="${shade(colour, 0.32)}"/>`
    body += `<rect x="${x + 499}" width="14" height="${SIZE}" fill="${shade(colour, -0.28)}"/>`
  }
  return body
}

function slate(colour, seed) {
  const random = rolls(seed)
  const row = 200
  const width = 250
  let body = `<rect width="${SIZE}" height="${SIZE}" fill="${shade(colour, -0.45)}"/>`
  for (let y = 0; y < SIZE; y += row) {
    const offset = (y / row) % 2 === 0 ? 0 : width / 2
    for (let x = -width; x < SIZE + width; x += width) {
      const tone = shade(colour, (random() - 0.5) * 0.22)
      body += `<rect x="${x + offset + 7}" y="${y + 5}" width="${width - 14}" height="${row - 12}" rx="10" fill="${tone}"/>`
      body += `<rect x="${x + offset + 7}" y="${y + row - 30}" width="${width - 14}" height="18" fill="${shade(tone, -0.22)}"/>`
    }
  }
  return body
}

function shingles(colour, seed) {
  const random = rolls(seed)
  const row = 200
  let body = `<rect width="${SIZE}" height="${SIZE}" fill="${shade(colour, -0.4)}"/>`
  for (let y = 0; y < SIZE; y += row) {
    let x = -random() * 150
    while (x < SIZE) {
      const width = 110 + random() * 150
      const tone = shade(colour, (random() - 0.5) * 0.3)
      body += `<rect x="${x + 6}" y="${y + 4}" width="${width - 12}" height="${row - 10}" fill="${tone}"/>`
      for (let g = 0; g < 3; g++) {
        const gx = x + 20 + random() * (width - 40)
        body += `<path d="M ${gx} ${y + 10} L ${gx + (random() - 0.5) * 12} ${y + row - 14}" stroke="${shade(tone, -0.15)}" stroke-width="4"/>`
      }
      x += width
    }
  }
  return body
}

const svg = (body, turned) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">${
    turned ? `<g transform="rotate(90 ${SIZE / 2} ${SIZE / 2})">${body}</g>` : body
  }</svg>\n`

const coverings = {
  tiles: tiles('#b0603f', 7),
  'tiles-anthracite': tiles('#45494d', 11),
  'standing-seam': seam('#5f666c'),
  slate: slate('#50575e', 5),
  shingles: shingles('#7d6149', 3),
}

for (const [name, body] of Object.entries(coverings)) {
  writeFileSync(join(out, `${name}.svg`), svg(body, false))
  writeFileSync(join(out, `${name}-90.svg`), svg(body, true))
}
console.log(`wrote ${Object.keys(coverings).length * 2} textures to ${out}`)
