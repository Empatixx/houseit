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
