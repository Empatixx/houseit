import type { HouseDocument } from '@houseit/core/document'
import { houseFitsSite } from '@houseit/geometry/site'
import type { Draft } from 'immer'
import { CommandError } from './command-error'

export function assertHouseFitsSite(doc: HouseDocument | Draft<HouseDocument>): void {
  if (!houseFitsSite(doc as HouseDocument)) {
    throw new CommandError('The house would stand outside the parcel or its setbacks')
  }
}
