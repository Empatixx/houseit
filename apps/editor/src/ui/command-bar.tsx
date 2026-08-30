import { type FormEvent, useState } from 'react'
import { documentStore } from '../store/store'

/**
 * The same commands the agent sends, typed by hand. Useful on its own, and it
 * keeps the bridge honest — anything the agent can do is reachable here too.
 */
export function CommandBar() {
  const [source, setSource] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!source.trim()) return
    try {
      documentStore.getState().exec(source)
      setSource('')
      setError(null)
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown))
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1">
      <input
        value={source}
        onChange={(event) => setSource(event.target.value)}
        spellCheck={false}
        placeholder="add-room --name kuchyň --from dům --side west --width 3.6m"
        className="w-[36rem] max-w-[50vw] rounded border border-neutral-300 bg-white px-3 py-1.5 font-mono text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-500"
      />
      {error ? <span className="font-mono text-xs text-red-600">{error}</span> : null}
    </form>
  )
}
