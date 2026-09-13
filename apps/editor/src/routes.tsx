import { addSite } from '@houseit/commands/add-site'
import { quoted } from '@houseit/commands/command-line'
import { applyCommand } from '@houseit/commands/run'
import type { Site } from '@houseit/core/document'
import { createEmptyDocument } from '@houseit/core/document'
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

export function Screens() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/p/:id" element={<Project />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ParcelWorkflow />
      <Toaster position="bottom-right" />
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

    const hasSite = documentStore.getState().doc.site !== undefined
    const source = [
      hasSite ? 'remove-site' : undefined,
      `add-site --json ${quoted(JSON.stringify(site))}`,
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
