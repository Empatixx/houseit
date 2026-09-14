import type { HouseObject } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import { type Spot, turnOf } from '@houseit/geometry/standing'
import { type ThreeEvent, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { turnTo } from '../../edit/object-commands'
import { pointOnPlan } from '../drag'

export function useFurnitureSpin(object: HouseObject, spot: Spot, picked: boolean) {
  const controls = useThree((state) => state.controls) as { enabled: boolean } | null
  const grabbed = useRef<number | null>(null)
  const following = useRef(false)
  const presses = useRef(0)
  const opened = useRef(-1)
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<number | null>(null)
  const base = spot.turn - turnOf(object)

  const raw = (point: Point) => Math.atan2(point.y - spot.at.y, point.x - spot.at.x)

  const angleTo = (point: Point, from: number) => {
    const total = spot.turn + (raw(point) - from)
    const degrees = Math.round(((total - base) * 180) / Math.PI / 15) * 15
    return ((degrees % 360) + 360) % 360
  }

  const signed = (degrees: number) => (degrees > 180 ? degrees - 360 : degrees)

  const drop = () => {
    grabbed.current = null
    following.current = false
    setOpen(false)
    setPreview(null)
    if (controls) controls.enabled = true
  }

  useEffect(() => {
    if (!picked) drop()
  }, [picked])

  const settle = (degrees: number | null) => {
    drop()
    if (degrees !== null && signed(degrees) !== (object.rotation ?? 0))
      turnTo(object, signed(degrees))
  }

  const down = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return
    presses.current += 1
    if (following.current) {
      event.stopPropagation()
      return
    }
    const from = pointOnPlan(event.ray)
    if (!from) return
    event.stopPropagation()
    ;(event.target as Element).setPointerCapture(event.pointerId)
    grabbed.current = raw(from)
    setOpen(true)
    if (controls) controls.enabled = false
  }
  const move = (event: ThreeEvent<PointerEvent>) => {
    const from = grabbed.current
    if (from === null) return
    event.stopPropagation()
    const now = pointOnPlan(event.ray)
    if (!now) return
    setPreview(base + (angleTo(now, from) * Math.PI) / 180)
  }
  const up = (event: ThreeEvent<PointerEvent>) => {
    const from = grabbed.current
    if (from === null || following.current) return
    ;(event.target as Element).releasePointerCapture(event.pointerId)
    if (controls) controls.enabled = true
    const now = pointOnPlan(event.ray)
    const degrees = now ? angleTo(now, from) : null
    if (degrees === null || signed(degrees) === (object.rotation ?? 0)) {
      following.current = true
      opened.current = presses.current
      return
    }
    settle(degrees)
  }
  const click = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    if (!following.current || presses.current === opened.current) return
    const from = grabbed.current
    const now = pointOnPlan(event.ray)
    settle(from !== null && now ? angleTo(now, from) : null)
  }

  return { preview, base, open, down, move, up, click }
}
