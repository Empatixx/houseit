import { toast } from 'sonner'

/** What went wrong with the last thing done on the plan, said once, where the eye is. */
export function sayError(message: string): void {
  toast.error(message)
}
