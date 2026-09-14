import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h2>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

export function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      {rows.map(([term, detail]) => (
        <div key={term} className="contents">
          <dt className="text-muted-foreground">{term}</dt>
          <dd className="text-foreground">{detail}</dd>
        </div>
      ))}
    </dl>
  )
}

export function NumberField({
  value,
  onCommit,
}: {
  value: number
  onCommit: (value: number) => boolean
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const commit = () => {
    const parsed = Number(draft)
    if (!Number.isFinite(parsed) || parsed === value) {
      setDraft(String(value))
      return
    }
    if (!onCommit(Math.round(parsed))) setDraft(String(value))
  }
  return (
    <Input
      inputMode="numeric"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
        if (event.key === 'Escape') setDraft(String(value))
      }}
    />
  )
}
