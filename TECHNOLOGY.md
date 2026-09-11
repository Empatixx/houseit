# Technology

What each part is built with, and why it is that and not something else.

Most of this is lifted from `cdx-daemon/frontend`, which already has a tuned toolchain.
Reusing it means the linter rules, tsconfig and test setup are proven rather than
guessed. Where houseit diverges, the reason is stated.

## At a glance

| Area | Choice |
| --- | --- |
| Runtime, package manager | Bun |
| Monorepo | Turborepo with boundary tags |
| Language | TypeScript, `strict` + `noUncheckedIndexedAccess` |
| Lint and format | Biome |
| Dead code, dependency rules | knip, dependency-cruiser |
| Tests | Vitest, Playwright for end-to-end |
| UI | React, Tailwind, shadcn/ui, react-router |
| Rendering | three.js via react-three-fiber |
| Annotations | drei `Html`, in the scene graph |
| Geometry | ours: shoelace, ray casting, planar subdivision |
| State | Zustand + Immer |
| Schemas | Zod |
| Agent interface | `@modelcontextprotocol/sdk` |
| Browser bridge | `playwright-core` over CDP |

## Foundation

**Bun** as runtime, package manager and test runner. **Turborepo** on top, with the
`boundaries` tags from cdx-daemon — `app`, `lib`, `config` — so `apps/editor` cannot
import from `apps/mcp`, and library packages cannot reach into applications. The layering
in the README is enforced by the build, not by discipline.

**TypeScript** from `@workspace/typescript-config`: `strict`, `noUncheckedIndexedAccess`,
`isolatedModules`, NodeNext resolution. `noUncheckedIndexedAccess` matters more here than
in a typical app — this code indexes into arrays of nodes and walls constantly, and it
turns a class of runtime crashes into compile errors.

**Biome** for both linting and formatting, config copied from cdx-daemon: single quotes,
semicolons as needed, 100 columns, kebab-case filenames, `noBarrelFile` as an error. No
ESLint, no Prettier.

**knip** and **dependency-cruiser** run in the `prebuild` task. A geometry package that
grows an accidental import of three.js should fail the build, not get noticed in review
six weeks later.

## Rendering

**three.js with react-three-fiber.** The plan view is an orthographic camera looking
straight down; the 3D view is the same scene with the camera moved. Walls, openings and
later the electrical and plumbing layers are authored once and appear in both.

The alternative was a hand-written Canvas 2D renderer for the plan and three.js for 3D
later. Rejected: that means writing selection, highlighting, layer filtering and drawing
twice, then keeping two implementations in agreement. Since 3D with building services is
the destination and not a maybe, the second renderer would be built and then thrown away.

React-three-fiber specifically, rather than three.js directly, because it reconciles the
scene declaratively from state. The usual objection to retained-mode renderers — that you
end up hand-syncing a node tree against your store — does not apply when the reconciler
does it, exactly as React does for the DOM.

`@react-three/drei` supplies `OrthographicCamera`, `Line` (wrapping `Line2`, since
`THREE.Line` ignores `linewidth`), `Html` and `CameraControls`. `LineMaterial` runs with
`worldUnits: false` so walls keep a constant on-screen width at any zoom.

**Annotations are DOM, positioned by the scene.** Room names, areas and dimension strings
are screen-space work that a shader does badly, so they are HTML — drei's `Html`, given a
world position and left to the reconciler. A 2D canvas overlay projecting world coordinates
to screen was the plan and was never built: `Html` already does the projection, and text
that is text can be selected, styled by Tailwind and read by a screen reader. The split it
was meant to keep still holds — geometry in three.js because it exists in 3D, annotations
outside it because they never will.

`three-mesh-bvh` for raycast acceleration and `three-bvh-csg` for boolean openings are
both deferred. Rectangular openings triangulate by hand and current scenes are small;
adding either before there is a measured problem is speculative.

### Hit-testing does not belong to the renderer

Clicking does not ask *what did I hit on screen*. It asks *what is near this point in the
model* — the closest node, a wall midpoint, a perpendicular foot, the intersection of two
extended walls. Most of those snap targets are not drawn at all, so a raycaster cannot
find them.

So the pipeline is: pointer → unproject a ray onto the level plane → query
`packages/geometry` → ranked snap candidates. Raycasting is barely used.

The consequence is that `packages/geometry` never imports three.js, is testable in Vitest
with no browser, and the renderer choice stays cheap to revisit.

## Geometry

**The geometry is ours, and `@flatten-js/core` never arrived.** It was pencilled in for
segment intersections, offsets and booleans once snapping landed, and it is still in no
package.json. What was written instead held: area and centroid are shoelace arithmetic,
point-in-room is ray casting written out by hand, and unions and cuts are in
`packages/geometry`. The reason the library was not reached for is the reason it would not
have helped — a face may repeat a vertex where a wall dangles into a room, so it is not a
simple polygon, and a general library refuses it.

Face detection — recovering rooms from the wall graph — is ours: sort edges by angle at
each node, then walk consistently leftmost turns. It is a standard planar-subdivision
algorithm and lives in `packages/geometry` with heavy unit tests, because everything
downstream trusts it.

**Integer millimetres everywhere.** Floating point coordinates drift, drifted nodes stop
coinciding, and face detection produces garbage when they do not. Rounding happens once,
at input.

## State

**Zustand** for the store, **Immer** for updates. Undo and redo are built on
`produceWithPatches` — each command produces a patch pair, which is a far smaller and more
reliable history than snapshotting documents.

Zustand is not used in cdx-daemon; that project runs on TanStack Query because it talks to
a server. houseit fetches nothing, so Query, Router and i18next are all left out.

## Schemas and the command CLI

**Zod** validates the document and every command's arguments. The document carries a
`version` field and a chain of migration functions, tested against stored fixtures. The
model will change; in-progress plans should survive that.

**Command parsing** is `shell-quote` to split the incoming string into argv, then a
hand-written strict parser, then Zod for validation. `node:util.parseArgs` was the first
choice and is wrong: commands execute inside the browser tab, where bundlers stub Node
built-ins out silently and the failure only appears at runtime. A dependency-cruiser rule
now forbids Node built-ins in the library packages. Knowing every option up front — the
schema already said so — makes the parser a couple of dozen lines with better messages
than a general-purpose one. No commander, no yargs.

A command is declared once:

```ts
export const addOpening = defineCommand({
  name: 'add-opening',
  summary: 'Put a door or a window in a room, on a side',
  args: z.object({
    room: z.string().min(1),
    kind: z.enum(['door', 'window']),
    side: z.enum(SIDE_NAMES).optional(),
    width: length().optional(),
  }),
  run: (draft, args, open) => { /* mutates the Immer draft */ },
})
```

That declaration drives four consumers: the CLI parser, the generated MCP tool
description the agent reads, `--help`, and runtime validation. There is no second place
to update when a command changes.

## Agent interface

**`@modelcontextprotocol/sdk`** over stdio, exposing exactly one tool — `floorplan`,
taking a command string. One tool rather than one per action, so adding a command does not
change the tool surface, and so the agent can batch several commands into a single
transaction.

**`playwright-core` connecting over CDP** to Chrome started with
`--remote-debugging-port`. The MCP server calls `page.evaluate` against
`window.floorplan.exec`. It carries no state of its own; the tab is the source of truth,
so what the agent reads is what is on screen.

Chrome and CDP are a hard requirement of this design. **Tauri is not an option**, despite
cdx-daemon shipping one — it runs on WKWebView on macOS, which offers no CDP endpoint,
and the bridge would have nothing to attach to.

The alternatives considered were a shared JSON file watched by the app, and manual
copy-paste of exported JSON. Both work without CDP, but neither lets the agent read live
editor state, which is the point.

## Conventions

- Integer millimetres for every length. Degrees for angles, at boundaries only.
- kebab-case filenames, enforced by Biome.
- No barrel files. Import from the module that defines the thing.
- `packages/core`, `packages/geometry` and `packages/commands` import no DOM, no React and
  no three.js. Enforced by dependency-cruiser.
- Vitest for `packages/*`, Playwright for editor interaction and the MCP bridge.

## Deliberately not used

| Not used | Why |
| --- | --- |
| Next.js | No server, no SSR, no routing. Pure cost. |
| Tauri | WKWebView has no CDP, which breaks the agent bridge. |
| Konva, Fabric, PixiJS, tldraw | A second renderer that cannot become the 3D view. |
| TanStack Query | Nothing is fetched. TanStack Router was rejected too, until plans became projects: `react-router` now carries the home screen and `/p/<id>`. |
| ESLint, Prettier | Biome covers both. |
| commander, yargs, `node:util.parseArgs` | The first two are heavy; the third is unavailable in the browser, where commands run. |
| Stored room polygons | Rooms are derived. Storing them invites desynchronisation. |
