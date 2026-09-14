import type { HouseObject } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import type { Spot } from '@houseit/geometry/standing'
import { type ThreeEvent, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { moveTo } from '../../edit/object-commands'
import { activeTools } from '../../engine/native-tools'
import { pointOnPlan, pointUnder } from '../drag'

type Carried = { from: Point; shift: Point }

export function useFurnitureDrag(object: HouseObject, spot: Spot) {
  const controls = useThree((state) => state.controls) as { enabled: boolean } | null
  const camera = useThree((state) => state.camera)
  const canvas = useThree((state) => state.gl.domElement)
  const held = useRef<Carried | null>(null)
  const [shift, setShift] = useState<Point>({ x: 0, y: 0 })
  const release = useRef<(() => void) | null>(null)
  useEffect(() => () => release.current?.(), [])

  const down = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return
    const from = pointOnPlan(event.ray)
    if (!from) return
    event.stopPropagation()
    ;(event.target as Element).setPointerCapture(event.pointerId)
    held.current = { from, shift: { x: 0, y: 0 } }
    if (controls) controls.enabled = false

    let sequence = 0
    let pending = Promise.resolve()
    const follow = (native: PointerEvent) => {
      const request = ++sequence
      const carried = held.current
      if (!carried) return
      const now = pointUnder(native, canvas, camera)
      if (!now) return
      carried.shift = { x: now.x - carried.from.x, y: now.y - carried.from.y }
      setShift(carried.shift)
      pending = (async () => {
        const snap = await activeTools?.snapPoint(now, { kind: 'object', id: object.id })
        if (request !== sequence || !held.current) return
        const point = snap ?? now
        carried.shift = { x: point.x - carried.from.x, y: point.y - carried.from.y }
        setShift(carried.shift)
      })()
    }
    const forget = () => {
      window.removeEventListener('pointermove', follow)
      window.removeEventListener('pointerup', done)
      window.removeEventListener('pointercancel', done)
      release.current = null
      if (controls) controls.enabled = true
    }
    const done = async (native: PointerEvent) => {
      forget()
      await pending
      const carried = held.current
      held.current = null
      setShift({ x: 0, y: 0 })
      if (controls) controls.enabled = true
      if (
        native.type === 'pointercancel' ||
        !carried ||
        Math.hypot(carried.shift.x, carried.shift.y) < 30
      )
        return
      moveTo(object, { x: spot.at.x + carried.shift.x, y: spot.at.y + carried.shift.y })
    }
    release.current = forget
    window.addEventListener('pointermove', follow)
    window.addEventListener('pointerup', done)
    window.addEventListener('pointercancel', done)
  }

  return { shift, live: held.current !== null, down }
}
