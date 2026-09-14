import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import type { GeometryData, GeometryInput } from './geometry-protocol'
import { useNativeGeometry } from './use-wall-geometry'

const { engine } = vi.hoisted(() => ({ engine: { geometry: vi.fn() } }))
vi.mock('./provider', () => ({ useGeometryEngine: () => engine }))

test('an asynchronous resize keeps the geometry and sharing key together and ignores obsolete results', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const pending: ((data: GeometryData) => void)[] = []
  engine.geometry.mockImplementation(() => new Promise((resolve) => pending.push(resolve)))
  const input = (size: number): GeometryInput => ({
    kind: 'profile',
    body: {
      kind: 'sheet',
      outline: [
        { x: 0, z: 0 },
        { x: size, z: 0 },
        { x: 0, z: size },
      ],
      holes: [],
    },
  })
  const data = (size: number): GeometryData => ({
    positions: new Float32Array([0, 0, 0, size, 0, 0, 0, size, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    uv: new Float32Array([0, 0, size, 0, 0, size]),
    groups: [],
  })
  let current: ReturnType<typeof useNativeGeometry> | undefined
  function Probe({ size }: { size: number | null }) {
    current = useNativeGeometry(size === null ? null : input(size))
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(() => root.render(createElement(Probe, { size: null })))
    expect(pending).toHaveLength(0)
    expect(current!.geometry).toBeNull()
    await act(() => root.render(createElement(Probe, { size: 1 })))
    await act(() => pending[0]!(data(1)))
    const first = current!.geometry!
    const dispose = vi.spyOn(first, 'dispose')
    await act(() => root.render(createElement(Probe, { size: 2 })))
    expect(current!.geometry).toBe(first)
    expect(current!.key).toBe(JSON.stringify(input(1)))
    await act(() => root.render(createElement(Probe, { size: 3 })))
    await act(() => pending[1]!(data(2)))
    expect(current!.geometry).toBe(first)
    expect(current!.key).toBe(JSON.stringify(input(1)))
    await act(() => pending[2]!(data(3)))
    expect(current!.key).toBe(JSON.stringify(input(3)))
    expect(current!.geometry!.getAttribute('position').getX(1)).toBe(3)
    expect(dispose).toHaveBeenCalledOnce()
    const lastDispose = vi.spyOn(current!.geometry!, 'dispose')
    await act(() => root.render(createElement(Probe, { size: 4 })))
    await act(() => root.render(createElement(Probe, { size: null })))
    await act(() => pending[3]!(data(4)))
    expect(current!.geometry).toBeNull()
    await act(() => root.unmount())
    expect(lastDispose).toHaveBeenCalledOnce()
  } finally {
    vi.unstubAllGlobals()
  }
})
