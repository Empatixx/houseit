import { floorMaterial } from '@houseit/core/floor-materials'
import { surfaceOf } from '@houseit/core/surfaces'
import {
  BathIcon,
  BedDoubleIcon,
  BriefcaseIcon,
  CarIcon,
  CookingPotIcon,
  DoorClosedIcon,
  DoorOpenIcon,
  DumbbellIcon,
  FootprintsIcon,
  type LucideIcon,
  PackageIcon,
  ShirtIcon,
  ShoppingBasketIcon,
  SofaIcon,
  SunIcon,
  ToiletIcon,
  UtensilsCrossedIcon,
  WashingMachineIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function FloorSwatch({ id }: { id: string | undefined }) {
  const material = id ? floorMaterial(id) : undefined
  return (
    <span
      aria-hidden="true"
      className="inline-block size-4 shrink-0 rounded-full border border-black/10 bg-muted bg-cover bg-center"
      style={
        material
          ? {
              backgroundImage: `url(textures/${material.texture})`,
              backgroundColor: material.colour,
            }
          : undefined
      }
    />
  )
}

export function SurfaceSwatch({ id }: { id: string }) {
  const surface = surfaceOf(id)
  return (
    <span
      aria-hidden="true"
      className="inline-block size-4 shrink-0 rounded-full"
      style={{
        backgroundColor: surface?.fill ?? '#ffffff',
        boxShadow: `inset 0 0 0 1px ${surface?.line ?? '#9d9d99'}`,
      }}
    />
  )
}

const KIND_ICONS: Record<string, LucideIcon> = {
  'half-bath': ToiletIcon,
  'walk-in': ShirtIcon,
  pantry: ShoppingBasketIcon,
  laundry: WashingMachineIcon,
  bathroom: BathIcon,
  bedroom: BedDoubleIcon,
  kitchen: CookingPotIcon,
  dining: UtensilsCrossedIcon,
  living: SofaIcon,
  office: BriefcaseIcon,
  garage: CarIcon,
  entry: DoorOpenIcon,
  hall: FootprintsIcon,
  storage: PackageIcon,
  gym: DumbbellIcon,
  terrace: SunIcon,
}

export function KindIcon({ id, className }: { id: string | undefined; className?: string }) {
  const Icon = (id && KIND_ICONS[id]) || DoorClosedIcon
  return (
    <Icon aria-hidden="true" className={cn('size-4 shrink-0 text-muted-foreground', className)} />
  )
}
