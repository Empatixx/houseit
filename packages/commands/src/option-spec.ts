export type OptionSpec = {
  /** The field in the command's schema. */
  name: string
  /** How the option is written on the command line: `notchWidth` reads `--notch-width`. */
  flag: string
  /** How the option is tokenised: a flag takes no value, everything else does. */
  kind: 'boolean' | 'value'
  required: boolean
}

export const flagOf = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
