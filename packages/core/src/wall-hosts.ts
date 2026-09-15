import type { HouseDocument } from './document'
import type { WallHost } from './host'

export function wallHosts(doc: HouseDocument): { id: string; host: WallHost }[] {
  const hosts: { id: string; host: WallHost }[] = []
  for (const device of Object.values(doc.devices)) {
    if (device.host.kind === 'wall') hosts.push({ id: device.id, host: device.host })
  }
  for (const circuit of Object.values(doc.circuits)) {
    circuit.route?.forEach((host, i) => {
      if (host.kind === 'wall') hosts.push({ id: `${circuit.id} route ${i + 1}`, host })
    })
  }
  return hosts
}
