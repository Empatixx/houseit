import type { Room } from '@houseit/geometry/rooms'

export const roomRef = (room: Room): string | undefined => room.id ?? room.name
