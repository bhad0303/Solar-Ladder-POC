import { useCallback, useRef, useState } from 'react'
import { allPanels } from '../data/types'
import {
  buildingToMesh,
  neighboursToMeshes,
  roofItemsToMeshes,
  treesToMeshes,
  type PanelSunAccessResult,
} from '../sunAccess/sunAccessLogic'
import type {
  SunAccessWorkerRequest,
  SunAccessWorkerResponse,
} from '../sunAccess/sunAccessWorker'
import { usePreviewStore } from '../state/usePreviewStore'
import { ErrorBanner } from './ErrorBanner'
import { BabylonPreviewCanvas } from './BabylonPreviewCanvas'
import { Sidebar } from './Sidebar'
import SunAccessWorker from '../sunAccess/sunAccessWorker?worker'

export function SolarPreviewPage() {
  const project = usePreviewStore((s) => s.project)
  const settings = usePreviewStore((s) => s.settings)
  const setImageryStatus = usePreviewStore((s) => s.setImageryStatus)
  const imageryMessage = usePreviewStore((s) => s.imageryMessage)

  const [error, setError] = useState<string | null>(null)
  const [capsLabel, setCapsLabel] = useState<string | null>(null)
  const [accessResults, setAccessResults] = useState<PanelSunAccessResult[]>(
    [],
  )
  const [sunAccessBusy, setSunAccessBusy] = useState(false)
  const requestIdRef = useRef(0)

  const runSunAccess = useCallback(() => {
    setSunAccessBusy(true)
    const worker = new SunAccessWorker()
    const requestId = ++requestIdRef.current
    const panels = allPanels(project)
    const occluders = [
      buildingToMesh(project.building.polygon, project.building.height),
      ...treesToMeshes(project.trees),
      ...neighboursToMeshes(project.neighbours),
      ...roofItemsToMeshes(project.roofItems),
    ]
    const msg: SunAccessWorkerRequest = {
      type: 'compute',
      requestId,
      input: {
        panels,
        occluders,
        location: project.location,
        dayOfYear: settings.dayOfYear,
        stepMinutes: 30,
      },
    }
    worker.onmessage = (ev: MessageEvent<SunAccessWorkerResponse>) => {
      if (ev.data.requestId !== requestId) return
      setAccessResults(ev.data.results)
      setSunAccessBusy(false)
      worker.terminate()
    }
    worker.onerror = () => {
      setSunAccessBusy(false)
      setError('Sun access worker failed')
      worker.terminate()
    }
    worker.postMessage(msg)
  }, [project, settings.dayOfYear])

  return (
    <div className="preview-layout flex min-h-screen">
      <Sidebar
        capsLabel={capsLabel}
        onRunSunAccess={runSunAccess}
        sunAccessBusy={sunAccessBusy}
      />
      <div className="preview-main relative flex-1">
        <ErrorBanner
          message={error ?? imageryMessage}
          onDismiss={() => {
            setError(null)
            setImageryStatus(false, null)
          }}
        />
        <BabylonPreviewCanvas
          project={project}
          dayOfYear={settings.dayOfYear}
          minuteOfDay={settings.minuteOfDay}
          panelInfo={settings.panelInfo}
          measurements={settings.measurements}
          sunAccess={settings.sunAccess}
          accessResults={accessResults}
          onImageryStatus={(ok, message) => setImageryStatus(!ok, message)}
          onReady={() =>
            setCapsLabel(
              'Phase 0: local satellite ground + Babylon (no Maps/API keys)',
            )
          }
        />
      </div>
    </div>
  )
}
