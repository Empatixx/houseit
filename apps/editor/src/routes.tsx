import { useEffect, useState } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router'
import { App } from './app'
import { Toaster } from './components/ui/sonner'
import { projectsStore, useProjects } from './store/projects/projects'
import { documentStore } from './store/store'
import { Home } from './ui/home/home'

/**
 * The two screens there are: the projects, and one of them open.
 *
 * A project has an address of its own, so a plan can be handed to somebody and
 * come back to where it was left. Nothing else is routed — what is picked, what
 * is folded away and where the camera is looking are matters of the sitting.
 */
export function Screens() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/p/:id" element={<Project />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="bottom-right" />
    </BrowserRouter>
  )
}

/** The home screen, and the one thing that can arrive at it and not stay: `?plan=`. */
function Landing() {
  const [params] = useSearchParams()
  const plan = params.get('plan')
  const navigate = useNavigate()

  useEffect(() => {
    if (!plan) return
    let live = true
    void projectOf(plan).then((meta) => {
      if (live) navigate(`/p/${meta.id}?plan=${encodeURIComponent(plan)}`, { replace: true })
    })
    return () => {
      live = false
    }
  }, [plan, navigate])

  return <Home />
}

/**
 * A project, open. Its plan is read out of the database into the document store
 * on the way in and written back on the way out; everything between is the
 * editor, which knows nothing about any of this.
 */
function Project() {
  const { id } = useParams()
  const open = useProjects((state) => state.open)
  const [missing, setMissing] = useState(false)
  const [params] = useSearchParams()
  const plan = params.get('plan')

  useEffect(() => {
    if (!id) return
    let live = true
    void projectsStore
      .getState()
      .openProject(id)
      .then((meta) => {
        if (!live) return
        if (!meta) setMissing(true)
        else if (plan) drawNamedPlan(plan)
      })
    return () => {
      live = false
      void projectsStore.getState().closeProject()
    }
  }, [id, plan])

  if (missing) return <Navigate to="/" replace />
  if (!open || open.id !== id) return null
  return <App />
}

/** The project of that name, made if there is not one. */
async function projectOf(name: string) {
  const { list, refresh, create } = projectsStore.getState()
  if (!list) await refresh()
  const found = projectsStore.getState().list?.find((project) => project.name === name)
  return found ?? (await create(name))
}

/**
 * A plan named in the address is drawn in place of whatever the project held.
 *
 * `?plan=house` fetches `plans/house.txt` — a command script, the same lines the
 * agent would send — wipes the plan and runs it. That is what makes a plan a
 * thing with an address that can be handed to somebody.
 */
function drawNamedPlan(name: string): void {
  fetch(`plans/${encodeURIComponent(name)}.txt`)
    .then((response) => (response.ok ? response.text() : Promise.reject(response.status)))
    .then((script) => {
      documentStore.getState().reset()
      documentStore.getState().exec(script)
    })
    .catch((reason) => console.error(`could not load plan ${name}:`, reason))
}
