import { toast } from 'sonner'

export function sayError(message: string): void {
  toast.error(message)
}
