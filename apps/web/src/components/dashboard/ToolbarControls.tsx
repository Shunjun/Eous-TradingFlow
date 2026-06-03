import { useContext } from 'react'
import { MosaicContext, MosaicWindowContext } from 'react-mosaic-component'
import { Button } from '@eous/ui'
import { SplitSquareVertical, Maximize2, X } from 'lucide-react'

export default function ToolbarControls() {
  const { mosaicWindowActions } = useContext(MosaicWindowContext)
  const { mosaicActions } = useContext(MosaicContext)

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
        onClick={() => mosaicActions.expand(mosaicWindowActions.getPath())}
        title="Expand"
      >
        <Maximize2 className="h-3.5 w-3.5" />
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
