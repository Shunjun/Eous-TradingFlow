export default function WelcomeContent() {
  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-xs">
        <p className="text-lg font-medium text-foreground">Welcome</p>
        <p className="text-sm text-muted-foreground">
          Your workspace is ready. Add panels to get started.
        </p>
        <div className="space-y-1.5 text-left mx-auto max-w-[220px]">
          <p className="font-mono text-xs text-muted-foreground">
            Drag the title bar to split windows
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            Right-click title bar for more actions
          </p>
        </div>
      </div>
    </div>
  )
}
