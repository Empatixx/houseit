import { createRoot } from 'react-dom/client'
import { installFloorplanBridge } from './bridge/floorplan-bridge'
import { Screens } from './routes'
import { modeStore } from './store/mode'
import { projectsStore } from './store/projects/projects'
import { selectionStore } from './store/selection'
import { documentStore } from './store/store'
import { walkStore } from './store/walk'
import './styles.css'

installFloorplanBridge(documentStore)

if (import.meta.env.DEV) {
  Object.assign(window, {
    __houseit: { modeStore, walkStore, projectsStore, documentStore, selectionStore },
  })
}

createRoot(document.getElementById('root')!).render(<Screens />)
