import { existsSync } from 'node:fs'
import { join } from 'node:path'
import Link from 'next/link'
import { HomeLayout } from 'fumadocs-ui/layouts/home'
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock'
import { baseOptions } from '@/lib/layout.shared'
import { GithubStars, REPO_NAME, REPO_OWNER } from '@/components/github-stars'
import { BASE_PATH, Logo } from '@/components/logo'

type Entry = { name: string; text: string; slug: string }

const groups: { title: string; entries: Entry[] }[] = [
  {
    title: 'The dwelling',
    entries: [
      { name: 'level', text: 'Add a storey above or a cellar below, rename it, restack it.', slug: 'commands/level' },
      { name: 'room', text: 'Draw a floor outline or cut a room out of a room. Move its walls by side.', slug: 'commands/room' },
      { name: 'opening', text: 'Hang a door or a window in a side of a room. It lands centred on free wall.', slug: 'commands/opening' },
      { name: 'object', text: 'Stand a thing against a wall or out in the room. Clashes are refused.', slug: 'commands/object' },
      { name: 'get-plan', text: 'Read back the rooms a command did not touch.', slug: 'commands/get-plan' },
    ],
  },
  {
    title: 'The building',
    entries: [
      { name: 'wall', text: 'Independent walls by id. Closed loops become rooms.', slug: 'commands/wall' },
      { name: 'stair, ramp, shaft', text: 'Measured flights, ramps and lift or service shafts between storeys.', slug: 'commands/building' },
      { name: 'column', text: 'Structural columns on a storey grid.', slug: 'commands/building' },
      { name: 'site', text: 'A cadastral parcel, setbacks and the ground around the house.', slug: 'commands/site' },
      { name: 'device', text: 'Electrical devices hosted on a wall face.', slug: 'commands/device' },
    ],
  },
]

const features = [
  {
    title: 'One door for everyone',
    text: 'The agent, the terminal and the mouse all run the same typed commands. A drag on the plan ends in one update-object, refused with the same words a script would get.',
  },
  {
    title: 'Answers that say what is next',
    text: 'Every command returns the rooms it touched in full — each wall, what opens and stands on it, the stretches still free — and everything now wrong with the plan.',
  },
  {
    title: 'Plans, not coordinates',
    text: 'Rooms are cut from rooms and named by compass side. Walls form a graph, rooms are derived from it, so two rooms always share the wall between them.',
  },
]

const example = `add-room --name house --shape l --width 12m --depth 9m \\
  --notch-width 4m --notch-depth 3m --material natural-oak
add-room --name kitchen --from house --side west --width 3.6m \\
  --kind kitchen --material tile-white
add-opening --room kitchen --kind door --side east
add-opening --room kitchen --kind window --side north --width 1.2m
add-object --room kitchen --type kitchen-l --against north
add-object --room house --type sofa-3 --against south --surface linen`

function Badge({ src, alt, href }: { src: string; alt: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener">
      <img src={src} alt={alt} className="h-5" />
    </a>
  )
}

const shots = [
  { file: 'plan.jpg', caption: 'The plan, drawn by commands' },
  { file: 'walk-living.jpg', caption: 'The same house, walked through' },
].filter((shot) => existsSync(join(process.cwd(), 'public', 'images', shot.file)))

export default function Home() {
  const repo = `https://github.com/${REPO_OWNER}/${REPO_NAME}`
  return (
    <HomeLayout {...baseOptions()}>
      <div className="hero-glow">
        <section className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 pb-16 pt-20 text-center">
          <Logo className="size-32 drop-shadow-sm" />
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">houseit</h1>
          <p className="max-w-2xl text-lg text-fd-muted-foreground">
            A floor plan editor you drive by talking to a coding agent. Describe the house in
            plain language; Claude Code or Codex turns it into commands over MCP, and the plan
            redraws in front of you — in 2D, and walked through in 3D.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Badge href={`${repo}/actions/workflows/ci.yml`} alt="CI" src={`https://img.shields.io/github/actions/workflow/status/${REPO_OWNER}/${REPO_NAME}/ci.yml?branch=main`} />
            <Badge href={`${repo}/blob/main/LICENSE`} alt="License" src="https://img.shields.io/badge/license-Apache--2.0-714cb6" />
            <Badge href="https://modelcontextprotocol.io" alt="MCP" src="https://img.shields.io/badge/MCP-server-714cb6" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/docs/getting-started"
              className="rounded-md bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              Getting started
            </Link>
            <Link href="/docs" className="rounded-md border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent">
              Documentation
            </Link>
            <GithubStars className="py-2.5" />
          </div>
          <code className="rounded-md border bg-fd-card px-4 py-2 font-mono text-sm">
            <span className="text-fd-muted-foreground">$ </span>bun install && bun run dev
          </code>
        </section>
      </div>

      {shots.length > 0 && (
        <section className={`mx-auto grid max-w-5xl gap-4 px-4 pb-14 ${shots.length > 1 ? 'sm:grid-cols-2' : ''}`}>
          {shots.map((shot) => (
            <figure key={shot.file} className="overflow-hidden rounded-lg border bg-fd-card">
              <img src={`${BASE_PATH}/images/${shot.file}`} alt={shot.caption} className="w-full" />
              <figcaption className="px-4 py-2 text-sm text-fd-muted-foreground">{shot.caption}</figcaption>
            </figure>
          ))}
        </section>
      )}

      <section className="mx-auto max-w-4xl px-4 pb-14">
        <p className="mb-3 text-center text-sm text-fd-muted-foreground">
          What the agent sends. One script, one transaction — every line lands, or none does.
        </p>
        <DynamicCodeBlock lang="bash" code={example} />
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-16 sm:grid-cols-3">
        {features.map((feature) => (
          <div key={feature.title} className="rounded-lg border bg-fd-card p-5">
            <h2 className="font-semibold text-fd-primary">{feature.title}</h2>
            <p className="mt-2 text-sm text-fd-muted-foreground">{feature.text}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto flex max-w-5xl flex-col gap-10 px-4 pb-20">
        {groups.map((group) => (
          <div key={group.title}>
            <h2 className="mb-3 border-b pb-2 text-sm font-semibold uppercase tracking-wider text-fd-primary">
              {group.title}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.entries.map((entry) => (
                <Link
                  key={entry.name}
                  href={`/docs/${entry.slug}`}
                  className="group rounded-lg border bg-fd-card p-4 transition-colors hover:border-fd-primary/50 hover:bg-fd-accent"
                >
                  <h3 className="font-mono font-semibold group-hover:text-fd-primary">{entry.name}</h3>
                  <p className="mt-1 text-sm text-fd-muted-foreground">{entry.text}</p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      <footer className="border-t py-8 text-center text-sm text-fd-muted-foreground">
        <p>
          Apache-2.0 · <a className="underline" href={repo}>GitHub</a> ·{' '}
          <a className="underline" href="/houseit/llms.txt">llms.txt</a>
        </p>
      </footer>
    </HomeLayout>
  )
}
