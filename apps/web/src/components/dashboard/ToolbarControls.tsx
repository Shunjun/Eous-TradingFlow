import { useCallback, useContext, useRef, useState } from 'react'
import { MosaicContext, MosaicWindowContext } from 'react-mosaic-component'
import type { MosaicNode } from 'react-mosaic-component'
import { Button } from '@eous/ui'
import { SplitSquareVertical, Maximize2, Minimize2, X } from 'lucide-react'

interface ToolbarControlsProps {
  tileId: string
  currentLayout: MosaicNode<string> | null
  onLayoutChange: (node: MosaicNode<string> | null) => void
}

export default function ToolbarControls({
  tileId,
  currentLayout,
  onLayoutChange,
}: ToolbarControlsProps) {
  const { mosaicWindowActions } = useContext(MosaicWindowContext)
  const { mosaicActions } = useContext(MosaicContext)
  const savedLayout = useRef<MosaicNode<string> | null>(null)
  const [expanded, setExpanded] = useState(false)

  const handleExpand = useCallback(() => {
    if (!expanded) {
      savedLayout.current = currentLayout
      onLayoutChange(tileId)
    } else if (savedLayout.current) {
      onLayoutChange(savedLayout.current)
      savedLayout.current = null
    }
    setExpanded(!expanded)
  }, [expanded, currentLayout, onLayoutChange, tileId])

  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost-icon"
        size="icon"
        className="h-7 w-7"
        onClick={() => mosaicWindowActions.split('row')}
        title="Split right"
      >
        <SplitSquareVertical className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost-icon"
        size="icon"
        className="h-7 w-7"
        onClick={handleExpand}
        title={expanded ? 'Restore' : 'Expand'}
      >
        {expanded ? (
          <Minimize2 className="h-3.5 w-3.5" />
        ) : (
          <Maximize2 className="h-3.5 w-3.5" />
        )}
      </Button>
      <Button
        variant="ghost-icon"
        size="icon"
        className="h-7 w-7"
        onClick={() => mosaicActions.remove(mosaicWindowActions.getPath())}
        title="Close"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
