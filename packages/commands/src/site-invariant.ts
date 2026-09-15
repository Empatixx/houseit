import type { HouseDocument } from '@houseit/core/document'
import { houseFitsSite, surfacesFitParcel } from '@houseit/geometry/site'
import type { Draft } from 'immer'
import { CommandError } from './command-error'

export function assertHouseFitsSite(doc: HouseDocument | Draft<HouseDocument>): void {
  if (!houseFitsSite(doc as HouseDocument)) {
    throw new CommandError('The house would stand outside the parcel or its setbacks')
  }
  if (!surfacesFitParcel(doc as HouseDocument)) {
    throw new CommandError('A terrace, path or paving would reach outside the parcel')
  }
}
