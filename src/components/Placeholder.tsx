export default function Placeholder({ name }: { name: string }) {
  return (
    <div className="screen">
      <h1 className="h-display">{name}</h1>
      <p className="sub">This screen is still being built.</p>
    </div>
  )
}
