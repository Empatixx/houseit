import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Input } from '@/components/ui/input'
import { projectsStore } from '@/store/projects/projects'
import { runProjectAction } from '../project-notices'

export function NewProjectCard() {
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const navigate = useNavigate()

  const frame =
    'flex h-full min-h-[13rem] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-transparent p-4 text-muted-foreground'

  if (!naming) {
    return (
      <button
        type="button"
        onClick={() => setNaming(true)}
        className={`${frame} transition-colors hover:border-primary/50 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none`}
      >
        <PlusIcon className="size-5" />
        <span className="text-sm font-medium">New project</span>
      </button>
    )
  }

  const make = async () => {
    await runProjectAction('Could not create project', async () => {
      const meta = await projectsStore.getState().create(name)
      navigate(`/p/${meta.id}`)
    })
  }

  return (
    <div className={frame}>
      <Input
        autoFocus
        value={name}
        placeholder="Name it"
        aria-label="Name the project"
        className="bg-background"
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void make()
          if (event.key === 'Escape') {
            setName('')
            setNaming(false)
          }
        }}
        onBlur={() => {
          if (!name.trim()) setNaming(false)
        }}
      />
      <span className="text-xs">Enter to make it</span>
    </div>
  )
}
