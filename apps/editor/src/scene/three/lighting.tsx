export function Lighting() {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#c9ccd2', 2.2]} />
      <directionalLight position={[8, 20, 6]} intensity={1.3} />
      <directionalLight position={[-10, 12, -8]} intensity={0.6} />
    </>
  )
}

export const SKY = '#e9edf2'
const GROUND = '#dfe3e8'

export function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
      <planeGeometry args={[400, 400]} />
      <meshBasicMaterial color={GROUND} />
    </mesh>
  )
}
