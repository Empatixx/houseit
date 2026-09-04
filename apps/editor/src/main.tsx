import { createRoot } from 'react-dom/client'
import { installFloorplanBridge } from './bridge/floorplan-bridge'
import { Screens } from './routes'
import { modeStore } from './store/mode'
import { projectsStore } from './store/projects/projects'
import { documentStore } from './store/store'
import { walkStore } from './store/walk'
import './styles.css'

installFloorplanBridge(documentStore)

// While developing, the walk can be placed from a script — the way a thing is
// looked at in 3D from a couple of metres off, one at a time — and a project of
// its own can be made for it to stand in. Nothing of the document goes through
// here; that door is the bridge.
if (import.meta.env.DEV) {
  Object.assign(window, { __houseit: { modeStore, walkStore, projectsStore } })
}

createRoot(document.getElementById('root')!).render(<Screens />)
