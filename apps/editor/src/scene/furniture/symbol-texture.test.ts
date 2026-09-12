import { describe, expect, it } from 'vitest'
import { hatched } from './symbol-texture'

const SOURCE =
  '<svg width="20" height="10" viewBox="0 0 20 10" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="c"><rect width="1" height="1"/></clipPath></defs><g id="body"><rect width="20" height="10" fill="#ffffff" stroke="#212121" transform="matrix(1 0 0 -1 0 10)"/><path d="M0 0" stroke="#212121"/><rect width="2" height="2" fill="#212121" clip-path="url(#c)"/></g></svg>'

describe('hatched', () => {
  const out = hatched(
    SOURCE.replace(/#ffffff/g, '#abcdef'),
    SOURCE,
    { width: 2000, depth: 1000 },
    { colour: '#5a35a8', spacing: 100, width: 10 },
  )

  it('lays a hatch at 45 degrees over the drawing, spaced in the drawing’s own units', () => {
    expect(out).toContain('patternTransform="rotate(45)"')
    expect(out).toMatch(/<pattern[^>]*width="1" height="1"/)
    expect(out).toContain('<rect width="0.1" height="1" fill="#5a35a8"/>')
    expect(out).toMatch(
      /<rect x="0" y="0" width="20" height="10" fill="url\(#picked-hatch\)" mask="url\(#picked-mask\)"\/><\/svg>$/,
    )
  })

  it('masks the hatch to the body of the thing and keeps its lines clear', () => {
    const mask = /<mask id="picked-mask">([\s\S]*?)<\/mask>/.exec(out)?.[1] ?? ''
    expect(mask.startsWith('<g fill="none">')).toBe(true)
    expect(mask).toContain('fill="#fff" stroke="#000" transform="matrix(1 0 0 -1 0 10)"')
    expect(mask).toContain('<rect width="2" height="2" fill="#000"/>')
    expect(mask).not.toContain('id=')
    expect(mask).not.toContain('<defs')
  })

  it('leaves the drawing itself as it was tinted', () => {
    expect(out).toContain('fill="#abcdef" stroke="#212121"')
    expect(out.match(/<defs>/g)).toHaveLength(2)
  })
})
