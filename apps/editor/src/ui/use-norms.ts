import { useEffect, useState } from 'react'
import type { NormCheck } from '../engine/ids-check'
import { useNativeTools } from '../engine/native-tools'
import { useDocument } from '../store/store'

const SETTLE = 300

export function useNorms(): NormCheck[] | undefined {
  const doc = useDocument((state) => state.doc)
  const tools = useNativeTools()
  const [checks, setChecks] = useState<NormCheck[]>()
  useEffect(() => {
    if (!tools) return
    let alive = true
    const timer = setTimeout(() => {
      void import('../engine/ids-check')
        .then(({ checkNorms }) => checkNorms(tools.components, doc))
        .then((found) => {
          if (alive) setChecks(found)
        })
        .catch(() => {
          if (alive) setChecks(undefined)
        })
    }, SETTLE)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [doc, tools])
  return checks
}

export function normLine(check: NormCheck): string {
  const required = check.required as { parameter?: { min?: number } } | undefined
  const min = required?.parameter?.min
  const found = typeof check.found === 'number' ? check.found : undefined
  return `${check.rule}: ${check.thing.name}${found === undefined ? '' : ` has ${found}`}${min === undefined ? '' : `, needs at least ${min}`}`
}
