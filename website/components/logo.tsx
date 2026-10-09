export const BASE_PATH = '/houseit'

export function Logo({ className = 'size-6' }: { className?: string }) {
  return (
    <svg
      viewBox="226 205 800 800"
      fill="none"
      className={className}
      role="img"
      aria-label="houseit: a roof over a floor plan with a door swinging open"
    >
      <path
        d="M308 462 627 245 945 462"
        stroke="var(--color-fd-primary)"
        strokeWidth="64"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M598 968H375V540h504v170M879 765v203h-84"
        stroke="currentColor"
        strokeWidth="66"
        strokeLinejoin="round"
      />
      <path d="M773 1001V848a153 153 0 0 0-153 153Z" fill="var(--color-fd-primary)" />
    </svg>
  )
}
