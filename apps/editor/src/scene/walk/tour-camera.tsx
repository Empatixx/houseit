import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { documentStore } from '../../store/store'
import { tourStore, useTour } from '../../store/tour'
import { EYE, headingOf, walkStore } from '../../store/walk'
import { DOLLY } from './shots'

const LINGER = 4.5
const PAN = 0.09
const FRAMES = 30
const BITRATE = 8_000_000

const ease = (t: number) => t * t * (3 - 2 * t)

export function TourCamera() {
  const gl = useThree((state) => state.gl)
  const touring = useTour((state) => state.shots.length > 0)
  const recording = useTour((state) => state.recording)
  const begun = useRef<{ index: number; at: number } | null>(null)

  useEffect(() => {
    if (!touring) return
    const stop = (event: Event) => {
      if (event instanceof KeyboardEvent && (event.metaKey || event.ctrlKey)) return
      tourStore.getState().stop()
    }
    window.addEventListener('keydown', stop)
    gl.domElement.addEventListener('pointerdown', stop)
    return () => {
      window.removeEventListener('keydown', stop)
      gl.domElement.removeEventListener('pointerdown', stop)
    }
  }, [touring, gl])

  useEffect(() => {
    if (!recording) return
    const stream = gl.domElement.captureStream(FRAMES)
    const type = ['video/webm;codecs=vp9', 'video/webm'].find((kind) =>
      MediaRecorder.isTypeSupported(kind),
    )
    const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: BITRATE })
    const chunks: Blob[] = []
    recorder.ondataavailable = (event) => chunks.push(event.data)
    recorder.onstop = () => {
      const film = new Blob(chunks, { type: recorder.mimeType })
      tourStore.getState().keep(film)
      const link = document.createElement('a')
      link.href = URL.createObjectURL(film)
      link.download = 'tour.webm'
      link.click()
      setTimeout(() => URL.revokeObjectURL(link.href), 10_000)
    }
    recorder.start()
    return () => recorder.stop()
  }, [recording, gl])

  useFrame(({ clock }) => {
    const { shots, index, held } = tourStore.getState()
    const shot = shots[index]
    if (!shot) {
      begun.current = null
      return
    }
    const now = clock.getElapsedTime()
    if (begun.current?.index !== index) begun.current = { index, at: now }
    const progress = held ? 0.5 : Math.min(1, (now - begun.current.at) / LINGER)

    const plan = documentStore.getState()
    if (plan.level !== shot.level) plan.setLevel(shot.level)
    const floor = plan.doc.levels[shot.level]?.elevation ?? 0

    const moved = ease(progress)
    const heading = headingOf(shot.yaw)
    const at = {
      x: shot.at.x + heading.x * DOLLY * moved,
      y: shot.at.y + heading.y * DOLLY * moved,
    }
    const walk = walkStore.getState()
    walk.place(at, shot.yaw)
    walk.step(at, floor + shot.eye - EYE)
    walk.look(shot.yaw + PAN * (moved - 0.5), shot.pitch)

    if (!held && progress >= 1) tourStore.getState().next()
  })

  return null
}
