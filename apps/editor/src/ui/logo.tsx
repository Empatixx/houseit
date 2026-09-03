/**
 * The mark: a house with a room and its door drawn into it the way the plan
 * draws them, in the blue the plan picks things out in. One file,
 * `public/logo.svg`, which is the tab's icon too.
 */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <img
      src="/logo.svg"
      alt=""
      width={size}
      height={size}
      draggable={false}
      className="shrink-0 select-none"
    />
  )
}
