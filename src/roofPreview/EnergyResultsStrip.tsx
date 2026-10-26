import {
  formatAreaM2,
  formatEnergyKwh,
  formatKw,
  formatPanelCount,
} from './energy/format'
import { useRoofStore } from './store/useRoofStore'

function Card({
  label,
  value,
  title,
  refreshing,
}: {
  label: string
  value: string
  title?: string
  refreshing?: boolean
}) {
  return (
    <div
      className="min-w-[9.5rem] shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
      title={title}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        {refreshing ? (
          <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-medium text-sky-700">
            Refreshing
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="min-w-[9.5rem] shrink-0 animate-pulse rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <div className="h-2.5 w-16 rounded bg-slate-200" />
      <div className="mt-2 h-4 w-24 rounded bg-slate-200" />
    </div>
  )
}

export function EnergyResultsStrip() {
  const summary = useRoofStore((s) => s.systemSummary)
  const estimate = useRoofStore((s) => s.energyEstimate)
  const status = useRoofStore((s) => s.estimateStatus)
  const estimateError = useRoofStore((s) => s.estimateError)

  const refreshing = status === 'loading' && estimate !== null
  const showSkeleton = status === 'loading' && estimate === null

  const daily = estimate
    ? formatEnergyKwh(estimate.averageDailyEnergyKwh)
    : null
  const month = estimate
    ? formatEnergyKwh(estimate.selectedMonthEnergyKwh)
    : null
  const annual = estimate ? formatEnergyKwh(estimate.annualEnergyKwh) : null

  return (
    <div className="bg-slate-50/95 px-3 py-2.5" aria-live="polite">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-700">
          System summary
        </p>
        {estimate?.source === 'fallback' ? (
          <span className="text-[10px] text-amber-700">
            Approximate energy (fallback)
          </span>
        ) : estimate?.source === 'pvgis' ? (
          <span className="text-[10px] text-emerald-700">PVGIS estimate</span>
        ) : estimate?.source === 'nasa-power' ? (
          <span className="text-[10px] text-emerald-700">
            NASA POWER estimate
          </span>
        ) : null}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Card label="Panels" value={formatPanelCount(summary.panelCount)} />
        <Card
          label="Installed capacity"
          value={formatKw(summary.installedCapacityKw)}
        />
        <Card
          label="Panel-covered roof area"
          value={formatAreaM2(summary.panelAreaM2)}
          title={`Coverage ${summary.roofCoveragePercent.toFixed(1)}% of usable roof`}
        />
        {showSkeleton ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <Card
              label="Average daily generation"
              value={daily?.label ?? '—'}
              title={daily?.kwhTooltip}
              refreshing={refreshing}
            />
            <Card
              label="Selected month generation"
              value={month?.label ?? '—'}
              title={month?.kwhTooltip}
              refreshing={refreshing}
            />
            <Card
              label="Annual generation"
              value={annual?.label ?? '—'}
              title={annual?.kwhTooltip}
              refreshing={refreshing}
            />
          </>
        )}
      </div>
      {/* Skip estimate skipped / soft warnings in the summary strip */}
      {estimateError &&
      !/zero capacity|energy estimate skipped/i.test(estimateError) ? (
        <p className="mt-1.5 text-[11px] text-red-600" role="alert">
          {estimateError}
        </p>
      ) : null}
    </div>
  )
}
