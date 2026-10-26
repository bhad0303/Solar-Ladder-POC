import { useEffect, useRef } from 'react'
import { RoofScene } from './babylon/RoofScene'
import { useRoofStore } from './store/useRoofStore'

export function BabylonRoofCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<RoofScene | null>(null)

  const house = useRoofStore((s) => s.house)
  const footprint = useRoofStore((s) => s.footprint)
  const panels = useRoofStore((s) => s.panels)
  const obstacles = useRoofStore((s) => s.obstacles)
  const selectedPanelId = useRoofStore((s) => s.selectedPanelId)
  const selectedObstacleId = useRoofStore((s) => s.selectedObstacleId)
  const panelSettings = useRoofStore((s) => s.panelSettings)
  const showMeasurements = useRoofStore((s) => s.showMeasurements)
  const unit = useRoofStore((s) => s.unit)
  const sunMinuteOfDay = useRoofStore((s) => s.sunMinuteOfDay)
  const sunDayOfYear = useRoofStore((s) => s.sunDayOfYear)
  const latitude = useRoofStore((s) => s.latitude)
  const longitude = useRoofStore((s) => s.longitude)
  const selectPanel = useRoofStore((s) => s.selectPanel)
  const updatePanel = useRoofStore((s) => s.updatePanel)
  const selectObstacle = useRoofStore((s) => s.selectObstacle)
  const updateObstacle = useRoofStore((s) => s.updateObstacle)
  const validationMessage = useRoofStore((s) => s.validationMessage)
  const trimUndo = useRoofStore((s) => s.trimUndo)
  const undoTrim = useRoofStore((s) => s.undoTrim)
  const dismissValidation = useRoofStore((s) => s.dismissValidation)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const scene = new RoofScene(canvas, {
      onSelectPanel: (id) => selectPanel(id),
      onMovePanel: (id, x, z) =>
        updatePanel(id, { position: { x, y: 0, z } }),
      onSelectObstacle: (id) => {
        console.log('[ObstacleDrag] canvas onSelectObstacle', id)
        selectObstacle(id)
      },
      onMoveObstacle: (id, x, z) => {
        console.log('[ObstacleDrag] canvas onMoveObstacle', id, { x, z })
        updateObstacle(id, { position: { x, y: 0, z } })
      },
      onInvalidDrop: (_id, reason) => {
        console.log('[ObstacleDrag] canvas onInvalidDrop', _id, reason)
        useRoofStore.setState({ validationMessage: reason })
      },
    })
    sceneRef.current = scene
    const s = useRoofStore.getState()
    scene.sync({
      house: s.house,
      footprint: s.footprint,
      panels: s.panels,
      obstacles: s.obstacles,
      selectedPanelId: s.selectedPanelId,
      selectedObstacleId: s.selectedObstacleId,
      panelSettings: s.panelSettings,
      showMeasurements: s.showMeasurements,
      unit: s.unit,
      sunMinuteOfDay: s.sunMinuteOfDay,
      sunDayOfYear: s.sunDayOfYear,
      latitude: s.latitude,
      longitude: s.longitude,
    })
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    sceneRef.current?.sync({
      house,
      footprint,
      panels,
      obstacles,
      selectedPanelId,
      selectedObstacleId,
      panelSettings,
      showMeasurements,
      unit,
      sunMinuteOfDay,
      sunDayOfYear,
      latitude,
      longitude,
    })
  }, [
    house,
    footprint,
    panels,
    obstacles,
    selectedPanelId,
    selectedObstacleId,
    panelSettings,
    showMeasurements,
    unit,
    latitude,
    longitude,
  ])

  useEffect(() => {
    sceneRef.current?.updateSun({
      sunMinuteOfDay,
      sunDayOfYear,
      latitude,
      longitude,
    })
  }, [sunMinuteOfDay, sunDayOfYear, latitude, longitude])

  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-900">
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none outline-none"
        style={{ width: '100%', height: '100%' }}
      />
      <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs text-slate-200">
        Drag to orbit · Scroll to zoom · Drag panels / obstacles on roof
      </div>
      {validationMessage && (
        <div className="absolute right-3 top-3 max-w-xs rounded border border-amber-500/50 bg-slate-950/90 px-3 py-2 text-xs text-amber-100 shadow-lg">
          <p>{validationMessage}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {trimUndo ? (
              <button
                type="button"
                className="pointer-events-auto rounded bg-amber-500 px-2 py-1 text-[11px] font-medium text-slate-950 hover:bg-amber-400"
                onClick={() => undoTrim()}
              >
                Undo / Discard
              </button>
            ) : null}
            <button
              type="button"
              className="pointer-events-auto rounded border border-slate-500 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
              onClick={() => dismissValidation()}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
