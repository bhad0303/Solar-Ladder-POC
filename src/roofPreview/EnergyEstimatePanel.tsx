import { useState } from 'react'
import { MONTH_LABELS } from './energy/calendar'
import { formatEnergyKwh, formatPercent } from './energy/format'
import { SoftNumberInput } from './SoftNumberInput'
import { useRoofStore } from './store/useRoofStore'

export function EnergyEstimatePanel() {
  const [open, setOpen] = useState(true)
  const estimate = useRoofStore((s) => s.energyEstimate)
  const selectedMonth = useRoofStore((s) => s.selectedMonth)
  const setSelectedMonth = useRoofStore((s) => s.setSelectedMonth)
  const peakSunHoursPerDay = useRoofStore((s) => s.peakSunHoursPerDay)
  const setPeakSunHoursPerDay = useRoofStore((s) => s.setPeakSunHoursPerDay)
  const latitude = useRoofStore((s) => s.latitude)
  const longitude = useRoofStore((s) => s.longitude)
  const setLatitude = useRoofStore((s) => s.setLatitude)
  const setLongitude = useRoofStore((s) => s.setLongitude)

  const monthly = estimate?.monthlyEnergyKwh ?? []
  const showChart =
    estimate?.source === 'pvgis' &&
    monthly.length === 12 &&
    monthly.some((v) => v > 0)

  return (
    <div className="border-t border-slate-100 bg-white">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-700">
          Energy Estimate
        </span>
        <span className="text-slate-400">{open ? '▾' : '▸'}</span>
      </button>

      {open ? (
        <div className="space-y-3 px-3 pb-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="flex flex-col gap-1 text-[11px]">
              <span className="font-medium text-slate-500">Latitude</span>
              <SoftNumberInput
                className="ui-input rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                value={latitude}
                onCommit={(n) => {
                  if (n !== undefined && Number.isFinite(n)) setLatitude(n)
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px]">
              <span className="font-medium text-slate-500">Longitude</span>
              <SoftNumberInput
                className="ui-input rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                value={longitude}
                onCommit={(n) => {
                  if (n !== undefined && Number.isFinite(n)) setLongitude(n)
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px]">
              <span className="font-medium text-slate-500">Selected month</span>
              <select
                className="ui-input rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
              >
                {MONTH_LABELS.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px]">
              <span className="font-medium text-slate-500">
                Peak sun hours / day
              </span>
              <SoftNumberInput
                className="ui-input rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                value={peakSunHoursPerDay}
                onCommit={(n) => {
                  if (n !== undefined && Number.isFinite(n)) {
                    setPeakSunHoursPerDay(n)
                  }
                }}
              />
              <span className="text-[10px] text-slate-400">
                Advanced assumption (fallback)
              </span>
            </label>
          </div>

          {showChart ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-1 pr-2 font-medium">Month</th>
                    <th className="py-1 font-medium">Estimate</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((kwh, i) => (
                    <tr
                      key={MONTH_LABELS[i]}
                      className={
                        i === selectedMonth ? 'bg-sky-50 text-sky-900' : ''
                      }
                    >
                      <td className="py-0.5 pr-2">{MONTH_LABELS[i]}</td>
                      <td className="py-0.5">
                        {formatEnergyKwh(kwh).label}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {estimate ? (
            <>
              <div>
                <p className="text-[11px] font-medium text-slate-600">
                  Assumptions
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-slate-600">
                  {estimate.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
              {estimate.warnings.length > 0 ? (
                <div>
                  <p className="text-[11px] font-medium text-amber-800">
                    Warnings
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-amber-800">
                    {estimate.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="text-[11px] text-slate-500">
                Data source:{' '}
                <strong>
                  {estimate.source === 'pvgis' ? 'PVGIS 5.3' : 'Fallback'}
                </strong>
                {estimate.capacityFactorPercent !== undefined
                  ? ` · Capacity factor ~${formatPercent(estimate.capacityFactorPercent)}`
                  : ''}
                <br />
                Calculated at: {new Date(estimate.calculatedAt).toLocaleString()}
              </p>
              <p className="rounded-md bg-slate-100 px-2 py-1.5 text-[11px] font-medium text-slate-700">
                Estimated, not guaranteed.
              </p>
            </>
          ) : (
            <p className="text-[11px] text-slate-500">
              Apply a panel layout with capacity greater than zero to estimate
              energy.
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
