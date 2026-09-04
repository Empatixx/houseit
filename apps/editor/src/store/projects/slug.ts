/** How long an id may be. Long enough to read, short enough to be an address. */
const MAX = 48

/**
 * A project's id, made from its name: `Byt Praha` becomes `byt-praha`, and that
 * is what stands in the address bar.
 *
 * It is made once, when the project is, and never again — renaming a project
 * leaves its id alone, so a link handed to somebody goes on working. Which is
 * also why two projects of the same name have to be told apart here rather than
 * later: the second one is `byt-2`.
 */
export function slugOf(name: string, taken: readonly string[]): string {
  const base =
    name
      .normalize('NFD')
      // Combining marks, left behind by the decomposition: á is now a + ́.
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, MAX)
      .replace(/^-+|-+$/g, '') || 'project'

  if (!taken.includes(base)) return base
  let n = 2
  while (taken.includes(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}
