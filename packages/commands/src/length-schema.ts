import { z } from 'zod'
import { parseLength } from './length'

/**
 * A length option. Every value arrives from the command line as a string, so the
 * schema is where `3.6m` becomes 3600 — and where a bad one becomes a readable
 * error instead of a NaN that travels into the document.
 */
export const length = () =>
  z.union([z.string(), z.number()]).transform((value, ctx) => {
    try {
      return parseLength(value)
    } catch (error) {
      ctx.addIssue({ code: 'custom', message: (error as Error).message })
      return z.NEVER
    }
  })
