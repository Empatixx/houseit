import { EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

export function Shading() {
  return (
    <EffectComposer enableNormalPass multisampling={4}>
      <N8AO aoRadius={0.9} distanceFalloff={0.6} intensity={2.4} halfRes />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
