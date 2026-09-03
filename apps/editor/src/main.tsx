import { createRoot } from 'react-dom/client'
import { App } from './app'
import { installFloorplanBridge } from './bridge/floorplan-bridge'
import { modeStore } from './store/mode'
import { documentStore } from './store/store'
import { walkStore } from './store/walk'
import './styles.css'

installFloorplanBridge(documentStore)

// While developing, the walk can be placed from a script — the way a thing is
// looked at in 3D from a couple of metres off, one at a time. Nothing of the
// document goes through here; that door is the bridge.
if (import.meta.env.DEV) Object.assign(window, { __houseit: { modeStore, walkStore } })

createRoot(document.getElementById('root')!).render(<App />)

/**
 * A plan named in the address is drawn in place of whatever was here.
 *
 * `?plan=house` fetches `plans/house.txt` — a command script, the same lines the
 * agent would send — wipes the document and runs it. That is what makes a plan a
 * thing with an address that can be handed to somebody, rather than a thing that
 * lives in one browser's storage.
 */
const named = new URLSearchParams(window.location.search).get('plan')
if (named) {
  fetch(`plans/${encodeURIComponent(named)}.txt`)
    .then((response) => (response.ok ? response.text() : Promise.reject(response.status)))
    .then((script) => {
      documentStore.getState().reset()
      documentStore.getState().exec(script)
    })
    .catch((reason) => console.error(`could not load plan ${named}:`, reason))
}
