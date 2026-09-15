import { addSite } from '@houseit/commands/add-site'
import { quoted } from '@houseit/commands/command-line'
import { applyCommand } from '@houseit/commands/run'
import { createEmptyDocument } from '@houseit/core/document'
import type { Site } from '@houseit/core/parcel-site'
import { centeredSiteForHouse } from '@houseit/geometry/site'
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
import { ParcelPicker } from './site/parcel-picker'
import type { SiteDialogRequest } from './site/site-dialog-store'
import { projectsStore, useProjects } from './store/projects/projects'
import { documentStore } from './store/store'
import { Home } from './ui/home/home'
import { runProjectAction } from './ui/project-notices'
import { SaveNotice } from './ui/save-notice'

export function Screens() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/p/:id" element={<Project />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ParcelWorkflow />
      <SaveNotice />
      <Toaster position="top-right" offset={72} mobileOffset={64} richColors closeButton />
    </BrowserRouter>
  )
}

function ParcelWorkflow() {
  const navigate = useNavigate()

  const confirm = async (site: Site, request: SiteDialogRequest) => {
    if (request.kind === 'create') {
      const initial = applyCommand(createEmptyDocument(), addSite, { json: JSON.stringify(site) })
      const meta = await projectsStore.getState().create(request.name, initial)
      navigate(`/p/${meta.id}`)
      return
    }

    const doc = documentStore.getState().doc
    const hasSite = doc.parcelSite !== undefined
    const placed = centeredSiteForHouse(doc, site)
    const source = [
      hasSite ? 'remove-site' : undefined,
      `add-site --json ${quoted(JSON.stringify(placed))}`,
    ]
      .filter((line) => line !== undefined)
      .join('\n')
    documentStore.getState().exec(source)
  }

  return <ParcelPicker onConfirm={confirm} />
}

function Landing() {
  const [params] = useSearchParams()
  const plan = params.get('plan')
  const navigate = useNavigate()

  useEffect(() => {
    if (!plan) return
    let live = true
    void runProjectAction('Project could not be created', async () => {
      if (!live) return
      const meta = await projectOf(plan)
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
  const [attempt, setAttempt] = useState(0)
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
        else if (plan) void runProjectAction('Plan could not be loaded', () => drawNamedPlan(plan))
      })
      .catch((error: unknown) => {
        if (live) setError(error instanceof Error ? error.message : String(error))
      })
    return () => {
      live = false
      void projectsStore
        .getState()
        .closeProject()
        .catch(() => undefined)
    }
  }, [id, plan, attempt])

  if (error)
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8">
        <h1>Project could not be opened</h1>
        <p>{error}</p>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          Retry
        </button>
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

async function drawNamedPlan(name: string): Promise<void> {
  const response = await fetch(`/plans/${encodeURIComponent(name)}.txt`)
  if (!response.ok) throw new Error(`Could not load plan ${name}: ${response.status}`)
  const script = await response.text()
  documentStore.getState().reset()
  documentStore.getState().exec(script)
}
