export default function ZeroState() {
  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="text-center space-y-3 max-w-xs">
        <p className="text-lg font-medium text-foreground">No panels yet</p>
        <p className="text-sm text-muted-foreground">
          Your workspace is empty. Click &quot;Add Panel&quot; to get started.
        </p>
      </div>
    </div>
  )
}
