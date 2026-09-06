import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { PerspectiveCamera } from 'three'
import { useDocument } from '../../store/store'
import { EYE, headingOf, walkStore } from '../../store/walk'
import { MM } from '../plan-coordinates'
import { startOf } from './start'

const WALK = 1.6
const RUN = 4
const TURN = 1.8
const DRAG = 0.0045

const AHEAD: Record<string, number> = { w: 1, arrowup: 1, s: -1, arrowdown: -1 }
const ASIDE: Record<string, number> = { d: 1, a: -1 }
const AROUND: Record<string, number> = { arrowright: 1, arrowleft: -1 }

export function Walker() {
  const camera = useThree((state) => state.camera) as PerspectiveCamera
  const gl = useThree((state) => state.gl)
  const size = useThree((state) => state.size)
  const doc = useDocument((state) => state.doc)
  const level = useDocument((state) => state.level)
  const pressed = useRef(new Set<string>())
  const floor = useDocument((state) => state.doc.levels[state.level]?.elevation ?? 0)
  const started = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (walkStore.getState().walker && started.current === level) return
    const start = startOf(doc, level)
    if (!start) return
    started.current = level
    walkStore.getState().place(start.at, start.yaw)
  }, [doc, level])

  useEffect(() => {
    const vertical = (camera.fov * Math.PI) / 360
    const horizontal = 2 * Math.atan(Math.tan(vertical) * (size.width / size.height))
    walkStore.getState().setFov((horizontal * 180) / Math.PI)
  }, [camera, size])

  useEffect(() => {
    const typing = (target: EventTarget | null) => {
      const element = target as HTMLElement | null
      return (
        !!element &&
        (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable)
      )
    }
    const down = (event: KeyboardEvent) => {
      if (typing(event.target) || event.metaKey || event.ctrlKey || event.altKey) return
      const key = event.key.toLowerCase()
      if (key in AHEAD || key in ASIDE || key in AROUND || key === 'shift') {
        if (key.startsWith('arrow')) event.preventDefault()
        pressed.current.add(key)
      }
    }
    const up = (event: KeyboardEvent) => pressed.current.delete(event.key.toLowerCase())
    const letGo = () => pressed.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', letGo)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', letGo)
      pressed.current.clear()
    }
  }, [])

  useEffect(() => {
    const view = gl.domElement
    let last: { x: number; y: number } | null = null
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return
      view.setPointerCapture(event.pointerId)
      last = { x: event.clientX, y: event.clientY }
      view.style.cursor = 'grabbing'
    }
    const move = (event: PointerEvent) => {
      if (!last) return
      const walker = walkStore.getState().walker
      if (!walker) return
      const dx = event.clientX - last.x
      const dy = event.clientY - last.y
      last = { x: event.clientX, y: event.clientY }
      walkStore.getState().look(walker.yaw + dx * DRAG, walker.pitch - dy * DRAG)
    }
    const up = (event: PointerEvent) => {
      if (!last) return
      last = null
      view.releasePointerCapture(event.pointerId)
      view.style.cursor = 'grab'
    }
    view.style.cursor = 'grab'
    view.addEventListener('pointerdown', down)
    view.addEventListener('pointermove', move)
    view.addEventListener('pointerup', up)
    view.addEventListener('pointercancel', up)
    return () => {
      view.removeEventListener('pointerdown', down)
      view.removeEventListener('pointermove', move)
      view.removeEventListener('pointerup', up)
      view.removeEventListener('pointercancel', up)
      view.style.cursor = ''
    }
  }, [gl])

  useFrame((_, dt) => {
    const state = walkStore.getState()
    const walker = state.walker
    if (!walker) return
    const keys = pressed.current
    let ahead = 0
    let aside = 0
    let around = 0
    for (const key of keys) {
      ahead += AHEAD[key] ?? 0
      aside += ASIDE[key] ?? 0
      around += AROUND[key] ?? 0
    }
    const step = Math.min(dt, 0.1)
    if (around !== 0) state.look(walker.yaw + around * TURN * step, walker.pitch)
    if (ahead !== 0 || aside !== 0) {
      const pace = (keys.has('shift') ? RUN : WALK) * 1000 * step
      const heading = headingOf(walker.yaw)
      const right = { x: heading.y, y: -heading.x }
      state.step({
        x: walker.at.x + (heading.x * ahead + right.x * aside) * pace,
        y: walker.at.y + (heading.y * ahead + right.y * aside) * pace,
      })
    }

    const now = walkStore.getState().walker ?? walker
    camera.position.set(now.at.x * MM, (floor + EYE) * MM, -now.at.y * MM)
    camera.rotation.order = 'YXZ'
    camera.rotation.set(now.pitch, -now.yaw, 0)
  })

  return null
}
