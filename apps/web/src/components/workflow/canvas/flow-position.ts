type ScreenToFlowPosition = (position: { x: number; y: number }) => { x: number; y: number }

function getFlowViewportCenterPosition(
  screenToFlowPosition: ScreenToFlowPosition,
  root?: ParentNode | null,
) {
  const flowElement = root?.querySelector?.('.react-flow') ?? document.querySelector('.react-flow')
  const rect = flowElement?.getBoundingClientRect()
  const screenPosition = rect
    ? {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      }
    : {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      }

  return screenToFlowPosition(screenPosition)
}

export { getFlowViewportCenterPosition }
