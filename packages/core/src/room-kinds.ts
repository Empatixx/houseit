export type RoomKind = {
  id: string
  label: string
  minArea: number
  /** Clear width the standard wants, in mm, where it asks for one. */
  minWidth?: number
  needsWindow: boolean
  public: boolean
  passage: boolean
  words: string[]
}

const kind = (
  id: string,
  label: string,
  minArea: number,
  flags: Partial<Pick<RoomKind, 'needsWindow' | 'public' | 'passage' | 'minWidth'>>,
  words: string[],
): RoomKind => ({
  id,
  label,
  minArea,
  ...(flags.minWidth === undefined ? {} : { minWidth: flags.minWidth }),
  needsWindow: flags.needsWindow ?? false,
  public: flags.public ?? false,
  passage: flags.passage ?? false,
  words,
})

export const ROOM_KINDS: RoomKind[] = [
  kind('half-bath', 'Half bath', 1.8, { minWidth: 900 }, [
    'half bath',
    'powder',
    'wc',
    'toilet',
    'záchod',
  ]),
  kind('walk-in', 'Walk-in closet', 2, {}, ['walk-in', 'walk in', 'closet', 'šatna', 'satna']),
  kind('pantry', 'Pantry', 1.5, {}, ['pantry', 'spíž', 'spiz', 'špajz']),
  kind('laundry', 'Laundry', 3, {}, ['laundry', 'prádelna', 'pradelna', 'utility', 'technická']),
  kind('bathroom', 'Bathroom', 3.5, { minWidth: 1500 }, [
    'bath',
    'koupelna',
    'ensuite',
    'en-suite',
  ]),
  kind('bedroom', 'Bedroom', 9, { needsWindow: true, minWidth: 2400 }, [
    'bedroom',
    'master',
    'ložnice',
    'loznice',
    'pokoj',
    'nursery',
    'dětský',
    'detsky',
  ]),
  kind('kitchen', 'Kitchen', 6, { needsWindow: true, public: true, minWidth: 1800 }, [
    'kitchen',
    'kuchyň',
    'kuchyn',
    'kuchyně',
  ]),
  kind('dining', 'Dining room', 7, { needsWindow: true, public: true, minWidth: 2400 }, [
    'dining',
    'jídelna',
    'jidelna',
  ]),
  kind('living', 'Living room', 12, { needsWindow: true, public: true, minWidth: 3500 }, [
    'living',
    'lounge',
    'family',
    'obývák',
    'obyvak',
    'obývací',
    'obyvaci',
  ]),
  kind('office', 'Office', 6, { needsWindow: true, minWidth: 2100 }, [
    'office',
    'study',
    'pracovna',
    'kancelář',
    'kancelar',
  ]),
  kind('garage', 'Garage', 15, {}, ['garage', 'garáž', 'garaz', 'carport']),
  kind('entry', 'Entry', 2, { passage: true, minWidth: 1000 }, [
    'entry',
    'entrance',
    'foyer',
    'mudroom',
    'vstup',
    'zádveří',
    'zadveri',
    'předsíň',
    'predsin',
  ]),
  kind('hall', 'Hall', 2, { passage: true, minWidth: 1000 }, [
    'hall',
    'corridor',
    'chodba',
    'landing',
  ]),
  kind('storage', 'Storage', 1, {}, ['storage', 'store', 'sklad', 'komora']),
  kind('gym', 'Gym', 6, {}, ['gym', 'fitness', 'posilovna']),
  kind('terrace', 'Terrace', 4, {}, ['terrace', 'patio', 'balcony', 'deck', 'terasa', 'balkon']),
]

export const ROOM_KIND_IDS = ROOM_KINDS.map((kind) => kind.id)

export function roomKindOf(room: { name?: string; kind?: string }): RoomKind | undefined {
  return (room.kind !== undefined ? roomKind(room.kind) : undefined) ?? kindOf(room.name)
}

export function kindOf(name: string | undefined): RoomKind | undefined {
  if (!name) return undefined
  const lower = name.toLowerCase()
  return ROOM_KINDS.find((candidate) => candidate.words.some((word) => lower.includes(word)))
}

export const roomKind = (id: string) => ROOM_KINDS.find((candidate) => candidate.id === id)
