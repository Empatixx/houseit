import { createRoot } from 'react-dom/client'
import { App } from './app'
import { installFloorplanBridge } from './bridge/floorplan-bridge'
import { documentStore } from './store/store'
import './styles.css'

installFloorplanBridge(documentStore)

createRoot(document.getElementById('root')!).render(<App />)
