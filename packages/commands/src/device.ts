import { DeviceSchema } from '@houseit/core/document'
import { wallElement } from '@houseit/geometry/wall-elements'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { along, fractionOf } from './along-schema'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { validateWalls } from './validate-walls'

export const addDevice = defineCommand({
  name: 'add-device',
  summary:
    'Mount an electrical device on an independent wall. --along is measured from its start, --height from its base, --side a|b selects its face. The host follows wall movement and junction splitting.',
  args: z.object({
    kind: DeviceSchema.shape.kind,
    wall: z.string().min(1),
    along: along(),
    height: length().pipe(z.number().nonnegative()),
    side: z.enum(['a', 'b']).default('a'),
  }),
  run: (draft, args) => {
    const wall = wallElement(draft, args.wall)
    const at = fractionOf(args.along, wall, 'add-device') * wall.length
    const segment = wall.segments.find((s) => at >= s.from && at <= s.to)!
    const id = allocateId(draft.devices, 'd')
    draft.devices[id] = {
      id,
      kind: args.kind,
      discipline: 'electrical',
      host: {
        kind: 'wall',
        wall: segment.wall.id,
        t: (at - segment.from) / (segment.to - segment.from),
        z: args.height,
        side: args.side,
      },
    }
    validateWalls(draft, wall.level)
    return { changed: [id, wall.id], at: wall.level }
  },
})

export const updateDevice = defineCommand({
  name: 'update-device',
  summary:
    'Change a wall-mounted electrical device or rehost it on another independent wall. Omitted position preserves its distance from the wall start.',
  args: z.object({
    id: z.string().min(1),
    wall: z.string().min(1).optional(),
    along: along().optional(),
    height: length().pipe(z.number().nonnegative()).optional(),
    side: z.enum(['a', 'b']).optional(),
  }),
  run: (draft, args) => {
    const device = draft.devices[args.id]
    if (device?.host.kind !== 'wall')
      throw new CommandError(`update-device: ${args.id} is not a wall-mounted device`)
    if ([args.wall, args.along, args.height, args.side].every((v) => v === undefined))
      throw new CommandError('update-device: say what to change')
    const host = device.host
    const old = wallElement(draft, host.wall)
    const prior = old.segments.find((s) => s.wall.id === host.wall)!
    const wall = wallElement(draft, args.wall ?? old.id)
    const at = args.along
      ? fractionOf(args.along, wall, 'update-device') * wall.length
      : prior.from + device.host.t * (prior.to - prior.from)
    const segment = wall.segments.find((s) => at >= s.from && at <= s.to)
    if (!segment) throw new CommandError('update-device: the host no longer fits the wall')
    device.host.wall = segment.wall.id
    device.host.t = (at - segment.from) / (segment.to - segment.from)
    if (args.height !== undefined) device.host.z = args.height
    if (args.side !== undefined) device.host.side = args.side
    validateWalls(draft, wall.level)
    return { changed: [device.id, old.id, wall.id], at: wall.level }
  },
})

export const removeDevice = defineCommand({
  name: 'remove-device',
  summary:
    'Remove a device and its circuit membership. A panel with circuits must stay until its circuits are removed.',
  args: z.object({ id: z.string().min(1) }),
  run: (draft, args) => {
    const device = draft.devices[args.id]
    if (!device) throw new CommandError(`remove-device: no device called ${args.id}`)
    if (Object.values(draft.circuits).some((c) => c.panel === device.id))
      throw new CommandError('remove-device: this panel still supplies circuits')
    for (const circuit of Object.values(draft.circuits))
      circuit.devices = circuit.devices.filter((id) => id !== device.id)
    delete draft.devices[device.id]
    const level =
      device.host.kind === 'wall' ? draft.walls[device.host.wall]!.level : device.host.level
    return { changed: [device.id], at: level }
  },
})
