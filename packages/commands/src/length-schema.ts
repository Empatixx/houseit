import { z } from 'zod'
import { parseLength } from './length'

export const length = () =>
  z.union([z.string(), z.number()]).transform((value, ctx) => {
    try {
      return parseLength(value)
    } catch (error) {
      ctx.addIssue({ code: 'custom', message: (error as Error).message })
      return z.NEVER
    }
  })
