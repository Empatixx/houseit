import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'textures', 'facade')
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

const svg = (width, height, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${body}</svg>\n`

function render(seed) {
  const random = rolls(seed)
  let body = `<rect width="1000" height="1000" fill="#ffffff"/>`
  for (let i = 0; i < 1400; i++) {
    const tone = random() < 0.5 ? '#000000' : '#ffffff'
    body += `<circle cx="${(random() * 1000).toFixed(1)}" cy="${(random() * 1000).toFixed(1)}" r="${(2 + random() * 5).toFixed(1)}" fill="${tone}" fill-opacity="${(0.025 + random() * 0.05).toFixed(3)}"/>`
  }
  return svg(1000, 1000, body)
}

function boards(colour, seed, vertical) {
  const random = rolls(seed)
  const width = 125
  let body = `<rect width="1000" height="1000" fill="${shade(colour, -0.55)}"/>`
  for (let at = 0; at < 1000; at += width) {
    const tone = shade(colour, (random() - 0.5) * 0.22)
    const board = vertical
      ? `<rect x="${at + 4}" y="0" width="${width - 10}" height="1000" fill="${tone}"/>`
      : `<rect x="0" y="${at + 4}" width="1000" height="${width - 10}" fill="${tone}"/>`
    body += board
    for (let g = 0; g < 7; g++) {
      const offset = at + 12 + random() * (width - 28)
      const grain = shade(tone, -0.12 - random() * 0.1)
      body += vertical
        ? `<path d="M ${offset} 0 Q ${offset + (random() - 0.5) * 18} 500 ${offset + (random() - 0.5) * 8} 1000" stroke="${grain}" stroke-width="${(1.5 + random() * 2.5).toFixed(1)}" fill="none" stroke-opacity="0.7"/>`
        : `<path d="M 0 ${offset} Q 500 ${offset + (random() - 0.5) * 18} 1000 ${offset + (random() - 0.5) * 8}" stroke="${grain}" stroke-width="${(1.5 + random() * 2.5).toFixed(1)}" fill="none" stroke-opacity="0.7"/>`
    }
  }
  return svg(1000, 1000, body)
}

function brick(colour, mortar, seed) {
  const random = rolls(seed)
  const [length, height, joint] = [225, 75, 10]
  let body = `<rect width="900" height="750" fill="${mortar}"/>`
  for (let row = 0; row < 10; row++) {
    const offset = row % 2 === 0 ? 0 : -length / 2
    for (let x = offset; x < 900; x += length) {
      const tone = shade(colour, (random() - 0.5) * 0.26)
      body += `<rect x="${x + joint / 2}" y="${row * height + joint / 2}" width="${length - joint}" height="${height - joint}" fill="${tone}"/>`
      if (x < 0)
        body += `<rect x="${x + 900 + joint / 2}" y="${row * height + joint / 2}" width="${length - joint}" height="${height - joint}" fill="${tone}"/>`
    }
  }
  return svg(900, 750, body)
}

function stone(seed) {
  const random = rolls(seed)
  let body = `<rect width="1200" height="1000" fill="#7d776d"/>`
  let y = 0
  while (y < 1000) {
    const row = Math.min(1000 - y, 120 + random() * 140)
    let x = 0
    while (x < 1200) {
      const width = Math.min(1200 - x, 180 + random() * 320)
      const tone = shade('#b3aa9b', (random() - 0.5) * 0.3)
      body += `<rect x="${(x + 9).toFixed(1)}" y="${(y + 9).toFixed(1)}" width="${(width - 18).toFixed(1)}" height="${(row - 18).toFixed(1)}" rx="18" fill="${tone}"/>`
      x += width
    }
    y += row
  }
  return svg(1200, 1000, body)
}

function panels(colour, seed, joints) {
  const random = rolls(seed)
  let body = `<rect width="2400" height="1200" fill="${colour}"/>`
  for (let i = 0; i < 900; i++)
    body += `<circle cx="${(random() * 2400).toFixed(0)}" cy="${(random() * 1200).toFixed(0)}" r="${(2 + random() * 6).toFixed(1)}" fill="#000000" fill-opacity="${(0.03 + random() * 0.05).toFixed(3)}"/>`
  body += `<rect x="0" y="0" width="2400" height="${joints}" fill="${shade(colour, -0.4)}"/><rect x="0" y="0" width="${joints}" height="1200" fill="${shade(colour, -0.4)}"/><rect x="1200" y="0" width="${joints}" height="1200" fill="${shade(colour, -0.4)}"/>`
  return svg(2400, 1200, body)
}

const textures = {
  'render.svg': render(3),
  'larch-horizontal.svg': boards('#b98a5c', 5, false),
  'larch-vertical.svg': boards('#b98a5c', 9, true),
  'charred-wood.svg': boards('#3a3532', 13, true),
  'brick-red.svg': brick('#9c4a35', '#cfc6bb', 17),
  'brick-white.svg': brick('#e6e1d6', '#bdb6aa', 19),
  'stone.svg': stone(23),
  'cement-panels.svg': panels('#a9aba8', 29, 8),
  'concrete.svg': panels('#bdbcb7', 31, 3),
}

for (const [name, body] of Object.entries(textures)) writeFileSync(join(out, name), body)
console.log(`wrote ${Object.keys(textures).length} textures to ${out}`)
