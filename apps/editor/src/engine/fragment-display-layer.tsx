import { type ThreeElements, type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'
import { type BufferGeometry, type Material, Matrix4 } from 'three'
import { usePreview } from '../store/preview'
import type { DisplaySurface } from './display-surface'
import { FragmentDisplay } from './fragment-display'
import { useGeometryEngine } from './provider'

const Context = createContext<{ display: FragmentDisplay } | null>(null)
type Events = Pick<
  ThreeElements['group'],
  'onDoubleClick' | 'onClick' | 'onPointerDown' | 'onPointerMove' | 'onPointerOver' | 'onPointerOut'
>
const handlers = new WeakMap<FragmentDisplay, Map<string, Events>>()
const eventNames = [
  'onDoubleClick',
  'onClick',
  'onPointerDown',
  'onPointerMove',
  'onPointerOver',
  'onPointerOut',
] as const

export function FragmentDisplayLayer({ children }: { children: ReactNode }) {
  const get = useThree((state) => state.get)
  const engine = useGeometryEngine()
  const documentPreview = usePreview((state) => state.doc !== null)
  const [, update] = useReducer((n) => n + 1, 0)
  const [display, setDisplay] = useState<FragmentDisplay | null>(null)
  useEffect(() => {
    let alive = true
    const instance = new FragmentDisplay(
      () => get().camera,
      () => {
        if (alive) update()
      },
      (error) => {
        if (alive) toast.error(String(error), { id: 'fragment-display' })
      },
    )
    const canvas = get().gl.domElement
    const down = () => {
      instance.pointerDown = true
    }
    const up = () => {
      instance.pointerDown = false
    }
    canvas.addEventListener('pointerdown', down, true)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', up, true)
    handlers.set(instance, new Map())
    setDisplay(instance)
    return () => {
      alive = false
      canvas.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', up, true)
      delete get().gl.domElement.dataset.houseitRender
      void instance.dispose().then(() => instance.components.dispose())
    }
  }, [get])
  useFrame(() => {
    display?.frame(documentPreview || display.pointerDown || display.gestures.size > 0)
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
    <Context value={{ display }}>
      {children}
      <group {...events}>
        {[...display.roots].map((root) => (
          <primitive key={root.uuid} object={root} dispose={null} />
        ))}
      </group>
    </Context>
  )
}

export function useFragmentDisplay() {
  const display = useContext(Context)
  if (!display) throw new Error('Native surfaces need a FragmentDisplayLayer')
  return display.display
}

type Props = Events & { surface: DisplaySurface; gesture?: boolean }

export function NativeSurface({ surface, gesture = false, ...events }: Props) {
  const display = useFragmentDisplay()
  const { id } = surface
  useLayoutEffect(() => {
    if (gesture) display.gestures.add(id)
    else display.gestures.delete(id)
    return () => {
      display.gestures.delete(id)
    }
  }, [display, id, gesture])
  const current = useRef(events)
  current.current = events
  useLayoutEffect(() => {
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
  useLayoutEffect(() => {
    display.set(surface)
  }, [display, surface])
  return null
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
}: Events & {
  id: string
  geometry: BufferGeometry
  materials: Material[]
  position: [number, number, number]
  angle: number
  length: number
  height: number
}) {
  const transform = new Matrix4().makeRotationY(angle).setPosition(...position)
  return (
    <NativeSurface
      surface={{
        id: `wall:${id}`,
        owner: { kind: 'wall', id },
        category: 'HOUSEITWALLSEGMENT',
        geometry,
        materials,
        transform,
        mapping: { kind: 'wall', length, height },
        casts: true,
      }}
      {...events}
    />
  )
}
