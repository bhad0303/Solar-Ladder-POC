import { useEffect, useRef } from 'react'
import { EstimateController } from './energy/estimateController'
import type { EnergyEstimateInput } from './energy/types'
import { useRoofStore } from './store/useRoofStore'

/** Debounced energy estimate when capacity / site / losses change. */
export function useEnergyEstimate(): void {
  const panels = useRoofStore((s) => s.panels)
  const panelSettings = useRoofStore((s) => s.panelSettings)
  const latitude = useRoofStore((s) => s.latitude)
  const longitude = useRoofStore((s) => s.longitude)
  const selectedMonth = useRoofStore((s) => s.selectedMonth)
  const peakSunHoursPerDay = useRoofStore((s) => s.peakSunHoursPerDay)
  const setEnergyEstimate = useRoofStore((s) => s.setEnergyEstimate)
  const setEstimateStatus = useRoofStore((s) => s.setEstimateStatus)
  const setEstimateError = useRoofStore((s) => s.setEstimateError)

  const ctrlRef = useRef<EstimateController | null>(null)

  useEffect(() => {
    const ctrl = new EstimateController({
      onStatus: setEstimateStatus,
      onResult: setEnergyEstimate,
      onError: setEstimateError,
    })
    ctrlRef.current = ctrl
    return () => {
      ctrl.dispose()
      ctrlRef.current = null
    }
  }, [setEnergyEstimate, setEstimateError, setEstimateStatus])

  useEffect(() => {
    const capacityKw = (panels.length * panelSettings.watt) / 1000
    const input: EnergyEstimateInput = {
      latitude,
      longitude,
      installedCapacityKw: capacityKw,
      panelTiltDeg: panelSettings.tiltDeg,
      panelAzimuthDeg: panelSettings.azimuthDeg ?? 180,
      systemLossPercent: panelSettings.systemLossPercent ?? 14,
      moduleType: panelSettings.moduleType ?? 'standard',
      selectedMonth,
      peakSunHoursPerDay,
      year: new Date().getFullYear(),
    }
    ctrlRef.current?.request(input)
  }, [
    panels.length,
    panelSettings.watt,
    panelSettings.tiltDeg,
    panelSettings.azimuthDeg,
    panelSettings.systemLossPercent,
    panelSettings.moduleType,
    latitude,
    longitude,
    selectedMonth,
    peakSunHoursPerDay,
  ])
}
