import { useMemo } from 'react'
import { DoubleSide, ShaderMaterial } from 'three'
import { aimAt, finishDrawing, putDown } from '../edit/draw-commands'
import { toolStore, useTool } from '../store/tool'
import { MM } from './plan-coordinates'

const CELL = 0.5

export function DotGrid() {
  const drawing = useTool((state) => state.armed?.kind === 'wall')
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        uniforms: {
          cell: { value: CELL },
          ink: { value: [0.62, 0.62, 0.67] },
        },
        vertexShader: `
          varying vec2 vPlan;
          void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            vPlan = world.xz;
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `,
        fragmentShader: `
          uniform float cell;
          uniform vec3 ink;
          varying vec2 vPlan;
          void main() {
            vec2 cellPos = vPlan / cell;
            vec2 nearest = floor(cellPos + 0.5);
            float pixel = fwidth(vPlan.x);
            float radius = 2.0 * pixel;
            float distance = length((cellPos - nearest) * cell);
            float alpha = 1.0 - smoothstep(radius - pixel, radius + pixel, distance);
            if (alpha < 0.01) discard;
            gl_FragColor = vec4(ink, alpha);
          }
        `,
      }),
    [],
  )

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.05, 0]}
      material={material}
      onPointerMove={
        drawing ? (event) => aimAt({ x: event.point.x / MM, y: -event.point.z / MM }) : undefined
      }
      onClick={
        drawing
          ? (event) => {
              if (event.delta > 4 || toolStore.getState().armed?.kind !== 'wall') return
              event.stopPropagation()
              putDown({ x: event.point.x / MM, y: -event.point.z / MM })
            }
          : undefined
      }
      onDoubleClick={drawing ? () => finishDrawing() : undefined}
    >
      <planeGeometry args={[400, 400]} />
    </mesh>
  )
}
