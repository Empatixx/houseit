import { addLevel, removeLevel, updateLevel } from './add-level'
import { addObject } from './add-object'
import { addOpening } from './add-opening'
import { addRoom } from './add-room'
import { addSite } from './add-site'
import { addColumn, removeColumn, updateColumn } from './column'
import type { CommandModule } from './command-module'
import { addRamp, addShaft, removeRamp, removeShaft } from './connections'
import { addDevice, removeDevice, updateDevice } from './device'
import { removeObject, removeOpening } from './remove'
import { removeRoom } from './remove-room'
import { removeSite } from './remove-site'
import { addStair, removeStair } from './stair-run'
import { updateObject } from './update-object'
import { updateOpening } from './update-opening'
import { updateRoom } from './update-room'
import { updateSite } from './update-site'
import { addWall, removeWall, updateWall } from './wall'

export const COMMAND_MODULES: readonly CommandModule[] = [
  { discipline: 'electrical', commands: [addDevice, updateDevice, removeDevice] },
  {
    discipline: 'architecture',
    commands: [
      addWall,
      updateWall,
      removeWall,
      addSite,
      updateSite,
      removeSite,
      addStair,
      removeStair,
      addShaft,
      removeShaft,
      addRamp,
      removeRamp,
      addColumn,
      updateColumn,
      removeColumn,
      addLevel,
      updateLevel,
      removeLevel,
      addRoom,
      updateRoom,
      removeRoom,
      addOpening,
      updateOpening,
      removeOpening,
      addObject,
      updateObject,
      removeObject,
    ],
  },
]
