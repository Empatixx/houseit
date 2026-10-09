export const BASE_PATH = '/houseit'

export function Logo({ className = 'size-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label="houseit: a house with a door swinging open"
    >
      <path d="M5 26V14L16 5l11 9v12M5 26h22" stroke="currentColor" />
      <path d="M16 26v-8a8 8 0 0 1 8 8" stroke="var(--color-fd-primary)" />
    </svg>
  )
}
