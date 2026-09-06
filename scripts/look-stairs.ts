#!/usr/bin/env bun
import { writeFileSync } from 'node:fs'
import { STAIR_KINDS, stairShape, stairSymbol } from '../packages/core/src/stairs'

const out = process.argv[2] ?? '/tmp/stairs.png'
const height = Number(process.argv[3] ?? 2800)

const cards = STAIR_KINDS.map((kind) => {
  const shape = stairShape(kind, height)
  const scale = 260 / Math.max(shape.size.width, shape.size.depth)
  return `<figure>
    <div style="width:${shape.size.width * scale}px;height:${shape.size.depth * scale}px">
      ${stairSymbol(shape).replace('<svg ', '<svg style="width:100%;height:100%" ')}
    </div>
    <figcaption>${kind}<br>${shape.size.width} × ${shape.size.depth} mm<br>${shape.risers} risers of ${shape.riser}, going ${shape.going}</figcaption>
  </figure>`
}).join('')

writeFileSync(
  out.replace(/\.png$/, '.html'),
  `<!doctype html><meta charset="utf-8"><style>
    body { font: 12px system-ui; background: #f4f4f5; margin: 0; padding: 24px;
           display: flex; gap: 24px; align-items: flex-end; }
    figure { margin: 0; text-align: center }
    figcaption { margin-top: 8px; color: #52525b; line-height: 1.5 }
  </style><body>${cards}</body>`,
)
console.log(`${out.replace(/\.png$/, '.html')} — ${height} mm storey`)
