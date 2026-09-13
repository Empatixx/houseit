import { type ThreeElements, type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'
import { type BufferGeometry, type Material, Matrix4 } from 'three'
import { useGeometryEngine } from './provider'
import { WallDisplay } from './wall-display'

const Context = createContext<WallDisplay | null>(null)
type Events = Pick<
  ThreeElements['group'],
  'onClick' | 'onPointerDown' | 'onPointerMove' | 'onPointerOver' | 'onPointerOut'
>
const handlers = new WeakMap<WallDisplay, Map<string, Events>>()
const eventNames = [
  'onClick',
  'onPointerDown',
  'onPointerMove',
  'onPointerOver',
  'onPointerOut',
] as const

export function WallDisplayLayer({ children }: { children: ReactNode }) {
  const get = useThree((state) => state.get)
  const engine = useGeometryEngine()
  const [, update] = useReducer((n) => n + 1, 0)
  const [display, setDisplay] = useState<WallDisplay | null>(null)
  useEffect(() => {
    let alive = true
    const instance = new WallDisplay(
      () => get().camera,
      () => {
        if (alive) update()
      },
      (error) => {
        if (alive) toast.error(String(error), { id: 'wall-display' })
      },
    )
    handlers.set(instance, new Map())
    setDisplay(instance)
    return () => {
      alive = false
      delete get().gl.domElement.dataset.houseitRender
      void instance.dispose().then(() => instance.components.dispose())
    }
  }, [get])
  useFrame(() => {
    display?.frame()
    get().gl.domElement.dataset.houseitRender = display?.error
      ? 'error'
      : !display || display.busy || engine.status.pending > 0
        ? 'pending'
        : 'ready'
  })
  const events = useMemo(
    () =>
      Object.fromEntries(
        eventNames.map((name) => [
          name,
          (event: ThreeEvent<PointerEvent>) => {
            const id = display?.owner(event.object, event.face?.a)
            if (display && id) {
              const callback = handlers.get(display)?.get(id)?.[name]
              if (typeof callback === 'function') callback(event)
            }
          },
        ]),
      ),
    [display],
  )
  if (!display) return null
  return (
    <Context value={display}>
      {children}
      <group {...events}>
        {[...display.roots].map((root) => (
          <primitive key={root.uuid} object={root} dispose={null} />
        ))}
      </group>
    </Context>
  )
}

export function useWallDisplay() {
  const display = useContext(Context)
  if (!display) throw new Error('Walls need a WallDisplayLayer')
  return display
}

type Props = Events & {
  id: string
  geometry: BufferGeometry
  materials: Material[]
  position: [number, number, number]
  angle: number
  length: number
  height: number
}

export function NativeWallSurface({
  id,
  geometry,
  materials,
  position,
  angle,
  length,
  height,
  ...events
}: Props) {
  const display = useWallDisplay()
  const current = useRef(events)
  current.current = events
  useEffect(() => {
    const forwarded = Object.fromEntries(
      eventNames.map((name) => [
        name,
        (event: ThreeEvent<PointerEvent>) => {
          const callback = current.current[name]
          if (typeof callback === 'function') callback(event)
        },
      ]),
    )
    handlers.get(display)!.set(id, forwarded)
    return () => {
      handlers.get(display)?.delete(id)
      display.remove(id)
    }
  }, [display, id])
  useEffect(() => {
    const transform = new Matrix4().makeRotationY(angle)
    transform.setPosition(...position)
    display.set({ id, geometry, materials, transform, length, height })
  }, [display, id, geometry, materials, position, angle, length, height])
  return null
}
