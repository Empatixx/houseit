import { architecturePieces } from './architecture-pieces'
import { fixturePieces } from './fixtures'
import type { SceneModule } from './scene-module'

export const SCENE_MODULES: readonly SceneModule[] = [
  { discipline: 'architecture', pieces: architecturePieces },
  { discipline: 'electrical', pieces: fixturePieces },
]
