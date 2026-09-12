import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BackSide, Color, type Mesh, ShaderMaterial, Vector3 } from 'three'
import { OVERHEAD } from './lighting'

const DOME = 280
const ZENITH = '#5f8fd0'
const HORIZON = '#dfe9f4'
const EARTH = '#c8cdd2'

const VERTEX = `
varying vec3 vDirection;
void main() {
  vDirection = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAGMENT = `
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 earth;
uniform vec3 sun;
varying vec3 vDirection;

void main() {
  vec3 look = normalize(vDirection);
  float up = look.y;
  vec3 above = mix(horizon, zenith, pow(clamp(up, 0.0, 1.0), 0.55));
  vec3 below = mix(horizon, earth, pow(clamp(-up, 0.0, 1.0), 0.35));
  vec3 colour = up >= 0.0 ? above : below;

  float towards = max(dot(look, sun), 0.0);
  colour += vec3(1.0, 0.90, 0.74) * pow(towards, 8.0) * 0.20;
  colour += vec3(1.0, 0.94, 0.82) * smoothstep(0.9993, 0.9997, towards) * 6.0;

  gl_FragColor = vec4(colour, 1.0);
}
`

const linear = (hex: string) => new Color(hex).convertSRGBToLinear()

export function Sky() {
  const dome = useRef<Mesh>(null)
  const camera = useThree((state) => state.camera)

  const material = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          zenith: { value: linear(ZENITH) },
          horizon: { value: linear(HORIZON) },
          earth: { value: linear(EARTH) },
          sun: { value: new Vector3(OVERHEAD.x, OVERHEAD.y, OVERHEAD.z).normalize() },
        },
      }),
    [],
  )

  useFrame(() => {
    dome.current?.position.copy(camera.position)
  })

  return (
    <mesh ref={dome} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[DOME, 32, 24]} />
    </mesh>
  )
}
