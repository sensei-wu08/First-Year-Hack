export default function Avatar({ emoji, size = 40 }: { emoji: string; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.55) }}
      aria-hidden="true"
    >
      {emoji}
    </span>
  )
}
