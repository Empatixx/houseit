/**
 * What sort of room a room is, and what that asks of it.
 *
 * A plan does not store this yet; it is read off the name, in English or
 * Czech, the way a person reads "ložnice 2" as a bedroom. It is what the
 * checker needs to say that a bedroom without a window is a problem and a
 * hall without one is not — so the guess is kept here, in one place, for the
 * day the document carries the kind itself.
 */

export type RoomKind = {
  id: string
  label: string
  /** Below this, in square metres, the room is too small to be what it says. */
  minArea: number
  /** Somebody lives in it, so it wants daylight. */
  needsWindow: boolean
  /** A room the household passes through: what a bedroom must not open straight onto. */
  public: boolean
  /** A passage: allowed to be long and thin. */
  passage: boolean
  /** Words in a name that mean this kind, lower case, English and Czech. */
  words: string[]
}

const kind = (
  id: string,
  label: string,
  minArea: number,
  flags: Partial<Pick<RoomKind, 'needsWindow' | 'public' | 'passage'>>,
  words: string[],
): RoomKind => ({
  id,
  label,
  minArea,
  needsWindow: flags.needsWindow ?? false,
  public: flags.public ?? false,
  passage: flags.passage ?? false,
  words,
})

/** The kinds, most specific first: "half bath" is found before "bath". */
export const ROOM_KINDS: RoomKind[] = [
  kind('half-bath', 'Half bath', 1.8, {}, ['half bath', 'powder', 'wc', 'toilet', 'záchod']),
  kind('walk-in', 'Walk-in closet', 2, {}, ['walk-in', 'walk in', 'closet', 'šatna', 'satna']),
  kind('pantry', 'Pantry', 1.5, {}, ['pantry', 'spíž', 'spiz', 'špajz']),
  kind('laundry', 'Laundry', 3, {}, ['laundry', 'prádelna', 'pradelna', 'utility', 'technická']),
  kind('bathroom', 'Bathroom', 3.5, {}, ['bath', 'koupelna', 'ensuite', 'en-suite']),
  kind('bedroom', 'Bedroom', 9, { needsWindow: true }, [
    'bedroom',
    'master',
    'ložnice',
    'loznice',
    'pokoj',
    'nursery',
    'dětský',
    'detsky',
  ]),
  kind('kitchen', 'Kitchen', 6, { needsWindow: true, public: true }, [
    'kitchen',
    'kuchyň',
    'kuchyn',
    'kuchyně',
  ]),
  kind('dining', 'Dining room', 7, { needsWindow: true, public: true }, [
    'dining',
    'jídelna',
    'jidelna',
  ]),
  kind('living', 'Living room', 12, { needsWindow: true, public: true }, [
    'living',
    'lounge',
    'family',
    'obývák',
    'obyvak',
    'obývací',
    'obyvaci',
  ]),
  kind('office', 'Office', 6, { needsWindow: true }, [
    'office',
    'study',
    'pracovna',
    'kancelář',
    'kancelar',
  ]),
  kind('garage', 'Garage', 15, {}, ['garage', 'garáž', 'garaz', 'carport']),
  kind('entry', 'Entry', 2, { passage: true }, [
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
  kind('hall', 'Hall', 2, { passage: true }, ['hall', 'corridor', 'chodba', 'landing']),
  kind('storage', 'Storage', 1, {}, ['storage', 'store', 'sklad', 'komora']),
  kind('gym', 'Gym', 6, {}, ['gym', 'fitness', 'posilovna']),
  kind('terrace', 'Terrace', 4, {}, ['terrace', 'patio', 'balcony', 'deck', 'terasa', 'balkon']),
]

/** The kind a name says, or nothing if it says none of them. */
export function kindOf(name: string | undefined): RoomKind | undefined {
  if (!name) return undefined
  const lower = name.toLowerCase()
  return ROOM_KINDS.find((candidate) => candidate.words.some((word) => lower.includes(word)))
}

export const roomKind = (id: string) => ROOM_KINDS.find((candidate) => candidate.id === id)
