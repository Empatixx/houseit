export type OptionSpec = {
  name: string
  flag: string
  kind: 'boolean' | 'value'
  required: boolean
}

export const flagOf = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
