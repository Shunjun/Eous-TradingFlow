import { Button } from '@eous/ui'
import { VIEW_REGISTRY, type ViewRegistryEntry, type ViewType } from '../views/index.js'

interface ComponentGridProps {
  onSelect: (type: ViewType) => void
  selectedType?: ViewType
}

export default function ComponentGrid({ onSelect, selectedType }: ComponentGridProps) {
  return (
    <div className="grid min-w-48 gap-2">
      {VIEW_REGISTRY.map((entry) => (
        <ComponentButton
          key={entry.type}
          entry={entry}
          selected={entry.type === selectedType}
          onClick={() => onSelect(entry.type)}
        />
      ))}
    </div>
  )
}

function ComponentButton({
  entry,
  selected,
  onClick,
}: {
  entry: ViewRegistryEntry
  selected?: boolean
  onClick: () => void
}) {
  const Icon = entry.icon
  return (
    <Button
      variant={selected ? 'accent-outline' : 'outline'}
      className="h-10 min-w-40 justify-start gap-2 rounded-md bg-card px-3 text-left hover:border-primary/40 hover:bg-accent/50"
      onClick={onClick}
    >
      <Icon className="h-4 w-4 text-primary" />
      <span className="text-xs font-medium">{entry.label}</span>
    </Button>
  )
}
