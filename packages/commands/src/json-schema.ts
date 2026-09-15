import { z } from 'zod'

export const json = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value, ctx) => {
    if (typeof value !== 'string') return value
    try {
      return JSON.parse(value)
    } catch {
      ctx.addIssue({ code: 'custom', message: 'expected valid JSON' })
      return z.NEVER
    }
  }, schema)
