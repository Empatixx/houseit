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
