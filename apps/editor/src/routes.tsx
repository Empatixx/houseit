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
import { toast } from 'sonner'
import { App } from './app'
import { Toaster } from './components/ui/sonner'
import { projectsStore, useProjects } from './store/projects/projects'
import { documentStore } from './store/store'
import { Home } from './ui/home/home'

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

function Project() {
  const { id } = useParams()
  const open = useProjects((state) => state.open)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [params] = useSearchParams()
  const plan = params.get('plan')

  useEffect(() => {
    if (!id) return
    setError(null)
    setMissing(false)
    let live = true
    void projectsStore
      .getState()
      .openProject(id)
      .then((meta) => {
        if (!live) return
        if (!meta) setMissing(true)
        else if (plan) drawNamedPlan(plan)
      })
      .catch((error: unknown) => {
        if (live) setError(error instanceof Error ? error.message : String(error))
      })
    return () => {
      live = false
      void projectsStore
        .getState()
        .closeProject()
        .catch((error: unknown) => {
          toast.error(error instanceof Error ? error.message : String(error))
        })
    }
  }, [id, plan])

  if (error)
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8">
        <h1>Project could not be opened</h1>
        <p>{error}</p>
        <a href="/">Back to projects</a>
      </main>
    )
  if (missing) return <Navigate to="/" replace />
  if (!open || open.id !== id) return null
  return <App />
}

async function projectOf(name: string) {
  const { list, refresh, create } = projectsStore.getState()
  if (!list) await refresh()
  const found = projectsStore.getState().list?.find((project) => project.name === name)
  return found ?? (await create(name))
}

function drawNamedPlan(name: string): void {
  fetch(`/plans/${encodeURIComponent(name)}.txt`)
    .then((response) => (response.ok ? response.text() : Promise.reject(response.status)))
    .then((script) => {
      documentStore.getState().reset()
      documentStore.getState().exec(script)
    })
    .catch((reason) => console.error(`could not load plan ${name}:`, reason))
}
