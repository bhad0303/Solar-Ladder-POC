import { useEffect, useRef, useState } from 'react'
import type { SolarProject } from '../data/types'
import { BabylonGroundPreview } from '../babylon/babylonGroundPreview'
import type { PanelSunAccessResult } from '../sunAccess/sunAccessLogic'
import { Compass } from './Compass'

type Props = {
  project: SolarProject
  dayOfYear: number
  minuteOfDay: number
  panelInfo: boolean
  measurements: boolean
  sunAccess: boolean
  accessResults: PanelSunAccessResult[]
  onReady?: () => void
  onImageryStatus?: (ok: boolean, message: string | null) => void
}

export function BabylonPreviewCanvas({
  project,
  dayOfYear,
  minuteOfDay,
  panelInfo,
  measurements,
  sunAccess,
  accessResults,
  onReady,
  onImageryStatus,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<BabylonGroundPreview | null>(null)
  const [heading, setHeading] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const preview = new BabylonGroundPreview(project)
    preview.onStatus = (s) => {
      onImageryStatus?.(s.imageryOk, s.message)
    }
    preview.attach(canvas)
    preview.setTime(dayOfYear, minuteOfDay)
    preview.setToggles({ panelInfo, measurements, sunAccess })
    previewRef.current = preview
    onReady?.()

    // Low-rate compass update (avoid React churn while orbiting/zooming)
    const id = window.setInterval(() => {
      setHeading((prev) => {
        const next = preview.getHeadingDeg()
        return Math.abs(next - prev) > 0.8 ? next : prev
      })
    }, 400)

    return () => {
      window.clearInterval(id)
      preview.dispose()
      previewRef.current = null
    }
    // mount once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const skipFirstProject = useRef(true)
  useEffect(() => {
    // attach() already built with the initial project — skip duplicate ground (z-fight cross)
    if (skipFirstProject.current) {
      skipFirstProject.current = false
      return
    }
    previewRef.current?.setProject(project)
  }, [project])

  useEffect(() => {
    previewRef.current?.setTime(dayOfYear, minuteOfDay)
  }, [dayOfYear, minuteOfDay])

  useEffect(() => {
    previewRef.current?.setToggles({ panelInfo, measurements, sunAccess })
  }, [panelInfo, measurements, sunAccess])

  useEffect(() => {
    previewRef.current?.setAccessResults(accessResults)
  }, [accessResults])

  return (
    <div className="map-shell babylon-shell">
      <canvas ref={canvasRef} className="babylon-canvas" />
      <div className="view-hint">
        Drag to orbit · Scroll to zoom · Local satellite + 3D
      </div>
      <Compass headingDeg={heading} />
    </div>
  )
}
