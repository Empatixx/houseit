import { useMemo } from 'react'
import { DoubleSide, ShaderMaterial } from 'three'

/** How far apart the dots are, in metres, and how much darker every fifth one is. */
const CELL = 1

/**
 * The paper the plan is drawn on: a dot at every metre, a little heavier at
 * every five. Drawn in a shader so a dot is a dot at any zoom — a couple of
 * pixels across, not a metre across.
 */
export function DotGrid() {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        uniforms: {
          cell: { value: CELL },
          faint: { value: [0.86, 0.86, 0.88] },
          strong: { value: [0.72, 0.72, 0.76] },
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
          uniform vec3 faint;
          uniform vec3 strong;
          varying vec2 vPlan;
          void main() {
            vec2 cellPos = vPlan / cell;
            vec2 nearest = floor(cellPos + 0.5);
            // How big a pixel is in metres here, so the dot can be sized in pixels.
            float pixel = fwidth(vPlan.x);
            float radius = 1.6 * pixel;
            float distance = length((cellPos - nearest) * cell);
            float dot = 1.0 - smoothstep(radius - pixel, radius + pixel, distance);
            bool fifth = mod(nearest.x, 5.0) == 0.0 && mod(nearest.y, 5.0) == 0.0;
            vec3 colour = fifth ? strong : faint;
            float radiusBig = 2.2 * pixel;
            float dotBig = 1.0 - smoothstep(radiusBig - pixel, radiusBig + pixel, distance);
            float alpha = fifth ? dotBig : dot;
            if (alpha < 0.01) discard;
            gl_FragColor = vec4(colour, alpha);
          }
        `,
      }),
    [],
  )

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} material={material}>
      <planeGeometry args={[400, 400]} />
    </mesh>
  )
}
