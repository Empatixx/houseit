import type { Topic } from '@houseit/core/document'
import { DownloadIcon, EyeIcon, Trash2Icon, UploadIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  author,
  comment,
  dropTopic,
  exportTopics,
  goTo,
  importTopics,
  pinTopic,
  saveView,
  setAuthor,
  setStatus,
} from '../edit/topic-commands'
import { selectionStore } from '../store/selection'
import { useDocument } from '../store/store'

const STATUSES: [Topic['status'], string][] = [
  ['open', 'Open'],
  ['in-progress', 'In progress'],
  ['resolved', 'Resolved'],
  ['closed', 'Closed'],
]

const DOT: Record<Topic['status'], string> = {
  open: 'bg-destructive',
  'in-progress': 'bg-amber-500',
  resolved: 'bg-emerald-500',
  closed: 'bg-muted-foreground/50',
}

export function Topics() {
  const topicsById = useDocument((state) => state.doc.topics)
  const viewpointsById = useDocument((state) => state.doc.viewpoints)
  const topics = Object.values(topicsById ?? {})
  const viewpoints = viewpointsById ?? {}
  const pinned = new Set(topics.flatMap((topic) => (topic.viewpoint ? [topic.viewpoint] : [])))
  const views = Object.values(viewpoints).filter((view) => !pinned.has(view.id))
  const names = useDocument((state) => state.doc.rooms)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [who, setWho] = useState(author)
  const file = useRef<HTMLInputElement>(null)

  const download = async () => {
    try {
      const blob = await exportTopics()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = 'topics.bcfzip'
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }
  const upload = async (picked: File | undefined) => {
    if (!picked) return
    try {
      const added = await importTopics(new Uint8Array(await picked.arrayBuffer()))
      toast.success(`${added} topic${added === 1 ? '' : 's'} brought in`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <>
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (!title.trim()) return
          if (pinTopic(title.trim(), text.trim())) {
            setTitle('')
            setText('')
          }
        }}
      >
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What needs doing here"
          aria-label="Topic title"
        />
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Comment (optional)"
          aria-label="First comment"
        />
        <div className="flex items-center gap-2">
          <Input
            value={who}
            onChange={(event) => {
              setWho(event.target.value)
              setAuthor(event.target.value)
            }}
            className="h-8 flex-1 text-xs"
            aria-label="Your name"
          />
          <Button type="submit" size="sm" disabled={!title.trim()}>
            Pin here
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Pins to what is selected and keeps the current view.
        </p>
      </form>

      <ul className="-mx-1.5 flex flex-col gap-1">
        {topics.map((topic) => (
          <TopicRow
            key={topic.id}
            topic={topic}
            about={topic.about.map((id) => names[id]?.name ?? id).join(', ')}
            onShow={() => {
              const view = topic.viewpoint ? viewpoints[topic.viewpoint] : undefined
              if (view) goTo(view)
              const first = topic.about[0]
              if (first && names[first])
                selectionStore.getState().select({ kind: 'room', id: first })
            }}
          />
        ))}
      </ul>

      {views.length ? (
        <>
          <p className="pt-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Saved views
          </p>
          <ul className="-mx-1.5 flex flex-col">
            {views.map((view) => (
              <li key={view.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-accent"
                  onClick={() => goTo(view)}
                >
                  <EyeIcon className="size-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate">{view.name}</span>
                  <span className="text-muted-foreground">{view.mode}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={() => saveView(`View ${views.length + 1}`)}>
          <EyeIcon />
          Save view
        </Button>
        <Button variant="outline" size="sm" disabled={!topics.length} onClick={download}>
          <DownloadIcon />
          BCF
        </Button>
        <Button variant="outline" size="sm" onClick={() => file.current?.click()}>
          <UploadIcon />
          BCF
        </Button>
        <input
          ref={file}
          type="file"
          accept=".bcf,.bcfzip,application/zip"
          className="hidden"
          onChange={(event) => {
            void upload(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </div>
    </>
  )
}

function TopicRow({ topic, about, onShow }: { topic: Topic; about: string; onShow: () => void }) {
  const [open, setOpen] = useState(false)
  const [reply, setReply] = useState('')
  return (
    <li className="rounded-md px-1.5 py-1 hover:bg-accent/60">
      <button
        type="button"
        className="flex w-full items-start gap-2 text-left"
        onClick={() => {
          setOpen(!open)
          onShow()
        }}
      >
        <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', DOT[topic.status])} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{topic.title}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {[about, `${topic.comments.length} comment${topic.comments.length === 1 ? '' : 's'}`]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
      </button>
      {open ? (
        <div className="mt-2 flex flex-col gap-2 pl-4">
          {topic.comments.map((remark) => (
            <p key={`${remark.date}-${remark.author}`} className="text-xs leading-5">
              <span className="font-medium">{remark.author}</span>{' '}
              <span className="text-muted-foreground">
                {new Date(remark.date).toLocaleDateString()}
              </span>
              <br />
              {remark.text}
            </p>
          ))}
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (reply.trim() && comment(topic, reply.trim())) setReply('')
            }}
          >
            <Input
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Reply"
              className="h-8 text-xs"
              aria-label="Reply"
            />
          </form>
          <div className="flex items-center gap-2">
            <Select
              value={topic.status}
              onValueChange={(status) => setStatus(topic, status as Topic['status'])}
            >
              <SelectTrigger className="h-8 flex-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map(([id, label]) => (
                  <SelectItem key={id} value={id}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Remove topic"
              onClick={() => dropTopic(topic)}
            >
              <Trash2Icon />
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  )
}
