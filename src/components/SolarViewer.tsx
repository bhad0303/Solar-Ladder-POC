import { useEffect, useRef } from 'react'
import { SolarRoofScene } from '../babylon/solarRoofScene'
import { useProjectStore } from '../store/useProjectStore'

/**
 * Babylon 3D panel: satellite ground + house + panels + sun path.
 */
export function SolarViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<SolarRoofScene | null>(null)
  const footprint = useProjectStore((s) => s.footprint)
  const scenePhase = useProjectStore((s) => s.scenePhase)
  const sceneError = useProjectStore((s) => s.sceneError)
  const buildRequestId = useProjectStore((s) => s.buildRequestId)
  const startBuild3D = useProjectStore((s) => s.startBuild3D)
  const setScenePhase = useProjectStore((s) => s.setScenePhase)

  // Mount engine once
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const scene = new SolarRoofScene()
    scene.attach(canvas)
    sceneRef.current = scene
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  // Rebuild when user clicks Build (buildRequestId bumps)
  useEffect(() => {
    if (buildRequestId === 0) return
    const scene = sceneRef.current
    const state = useProjectStore.getState()
    const fp = state.footprint
    if (!scene || !fp) {
      setScenePhase('error', 'Footprint missing')
      return
    }

    let cancelled = false
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          if (cancelled) return
          const { panelCount } = await scene.buildScene({
            footprint: fp,
            origin: {
              lat: state.location.lat,
              lng: state.location.lng,
            },
            timeZone: state.location.timeZone ?? 'Asia/Kolkata',
          })
          if (!cancelled) {
            setScenePhase('ready')
            useProjectStore.setState({
              statusMessage: `3D ready — satellite ground + ${panelCount} panels + sun path (21 Jun noon).`,
            })
          }
        } catch (err) {
          if (!cancelled) {
            setScenePhase(
              'error',
              err instanceof Error ? err.message : '3D build failed',
            )
          }
        }
      })()
    }, 50)

    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [buildRequestId, setScenePhase])

  // Resize when layout changes / footprint overlay
  useEffect(() => {
    sceneRef.current?.resize()
  }, [scenePhase, footprint])

  const canBuild = Boolean(footprint) && scenePhase !== 'building'
  const showCanvas = scenePhase === 'ready' || scenePhase === 'building'

  return (
    <div className="relative flex h-full min-h-[280px] w-full flex-col overflow-hidden rounded-lg bg-slate-800 text-slate-300">
      <canvas
        ref={canvasRef}
        className={`h-full w-full touch-none outline-none ${
          showCanvas ? 'block' : 'invisible absolute inset-0'
        }`}
      />

      {scenePhase === 'idle' || scenePhase === 'error' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
          <p className="text-sm font-medium text-slate-200">3D Solar Viewer</p>
          <p className="max-w-sm text-xs text-slate-500">
            {footprint
              ? `Footprint ready (${footprint.areaM2.toFixed(0)} m²). Build dabao — satellite ground + panels + sun path banega.`
              : 'Pehle map pe Find house se OSM outline lo, phir yahan 3D banega.'}
          </p>
          {sceneError ? (
            <p className="max-w-sm text-xs text-rose-300">{sceneError}</p>
          ) : null}
          <button
            type="button"
            disabled={!canBuild}
            onClick={() => startBuild3D()}
            className="rounded bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Build 3D house
          </button>
        </div>
      ) : null}

      {scenePhase === 'building' ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-900/75">
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent"
            aria-hidden
          />
          <p className="text-sm font-medium text-emerald-200">
            3D ban raha hai…
          </p>
          <p className="text-xs text-slate-400">
            Satellite ground · house · panels · sun path
          </p>
        </div>
      ) : null}

      {scenePhase === 'ready' ? (
        <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/65 px-2 py-1 text-[10px] text-emerald-200">
          3D ready · drag to orbit · scroll zoom
        </div>
      ) : null}

      {scenePhase === 'ready' ? (
        <button
          type="button"
          onClick={() => startBuild3D()}
          className="absolute right-2 top-2 rounded bg-slate-900/80 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
        >
          Rebuild
        </button>
      ) : null}

      <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/65 px-2 py-1 text-[10px] text-slate-200">
        <a
          className="pointer-events-auto underline hover:text-white"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap contributors
        </a>
      </div>
    </div>
  )
}
