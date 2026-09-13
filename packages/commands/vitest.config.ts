import { nodePackageConfig } from '@houseit/vitest-config/node-package'
import { mergeConfig } from 'vitest/config'

export default mergeConfig(nodePackageConfig, { test: { maxWorkers: 2 } })
