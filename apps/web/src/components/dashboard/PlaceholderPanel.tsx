export default function PlaceholderPanel({ title }: { title: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-background text-muted-foreground">
      <div className="text-center space-y-2">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground/60">Panel content coming soon</p>
      </div>
    </div>
  )
}
