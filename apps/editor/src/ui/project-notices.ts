import { toast } from 'sonner'

export async function runProjectAction(
  title: string,
  action: () => Promise<unknown>,
): Promise<void> {
  const id = `project-${title}`
  try {
    await action()
    toast.dismiss(id)
  } catch (error) {
    toast.error(title, {
      id,
      description: error instanceof Error ? error.message : String(error),
      duration: Infinity,
      action: {
        label: 'Retry',
        onClick: (event) => {
          event.preventDefault()
          void runProjectAction(title, action)
        },
      },
    })
  }
}
