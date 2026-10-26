import { useEffect, useState, type ReactNode } from 'react'
import { MAX_FLOORS, useRoofStore } from './store/useRoofStore'
import {
  DEFAULT_OBSTACLE_PRESETS,
  OBSTACLE_SIZE_LIMITS,
  OBSTACLE_TYPE_LABELS,
  type ObstacleType,
} from './geometry/obstacleTypes'
import {
  displayToM,
  FT_PER_M,
  mToDisplay,
  supportedRoofTypes,
  type CutoutCorner,
  type HouseShape,
  type LengthUnit,
  type RoofType,
} from './types'
import { UiSelect } from './UiSelect'

const field =
  'ui-input no-spinner w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm'
const labelCls = 'text-[11px] font-medium uppercase tracking-wide text-slate-500'
const sectionTitle =
  'text-xs font-semibold uppercase tracking-wider text-sky-700'
const btnPrimary =
  'rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-white shadow-sm shadow-sky-500/25 transition hover:bg-sky-600'
const btnGhost =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white'

function NumField({
  label,
  meters,
  unit,
  onMeters,
  min,
  max,
  step = 0.1,
}: {
  label: string
  meters: number
  unit: LengthUnit
  onMeters: (m: number) => void
  min?: number
  max?: number
  step?: number
}) {
  const display = mToDisplay(meters, unit)
  const suffix = unit === 'ft' ? 'ft' : 'm'
  // Step in the active display unit (0.1 m ≈ 0.5 ft)
  const displayStep = unit === 'ft' ? step * FT_PER_M : step
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelCls}>
        {label} ({suffix})
      </span>
      <div className="relative">
        <input
          type="number"
          className={`${field} pr-9`}
          value={Number(display.toFixed(unit === 'ft' ? 2 : 3))}
          min={min !== undefined ? mToDisplay(min, unit) : undefined}
          max={max !== undefined ? mToDisplay(max, unit) : undefined}
          step={displayStep}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (!Number.isFinite(v)) return
            onMeters(displayToM(v, unit))
          }}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500">
          {suffix}
        </span>
      </div>
    </label>
  )
}

/** Integer 1…MAX_FLOORS — draft while typing so 2/3/4 commit cleanly. */
function FloorsField({
  value,
  onCommit,
}: {
  value: number
  onCommit: (floors: number) => void
}) {
  const clamp = (n: number) =>
    Math.min(MAX_FLOORS, Math.max(1, Math.round(n)))
  const [draft, setDraft] = useState(String(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(String(value))
  }, [value, focused])

  const commit = (raw: string) => {
    const n = Number(raw)
    const next = Number.isFinite(n) ? clamp(n) : clamp(value)
    setDraft(String(next))
    if (next !== value) onCommit(next)
  }

  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelCls}>Floors (1–{MAX_FLOORS})</span>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={MAX_FLOORS}
        step={1}
        className={field}
        value={draft}
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          const raw = e.target.value
          setDraft(raw)
          // Spinner / immediate valid int (1–4) applies right away
          if (raw === '' || raw === '-' || raw === '.') return
          const n = Number(raw)
          if (!Number.isFinite(n) || !Number.isInteger(n)) return
          if (n < 1 || n > MAX_FLOORS) return
          onCommit(n)
        }}
        onBlur={() => {
          setFocused(false)
          commit(draft)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur()
          }
        }}
      />
    </label>
  )
}

function Section({
  title,
  children,
  hint,
}: {
  title: string
  children: ReactNode
  hint?: string
}) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm shadow-slate-900/[0.03]">
      <div>
        <h2 className={sectionTitle}>{title}</h2>
        {hint ? (
          <p className="mt-1 text-[11px] leading-snug text-slate-500">{hint}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

export function HouseForm() {
  const unit = useRoofStore((s) => s.unit)
  const house = useRoofStore((s) => s.house)
  const validationMessage = useRoofStore((s) => s.validationMessage)
  const trimUndo = useRoofStore((s) => s.trimUndo)
  const undoTrim = useRoofStore((s) => s.undoTrim)
  const dismissValidation = useRoofStore((s) => s.dismissValidation)
  const setUnit = useRoofStore((s) => s.setUnit)
  const patchHouse = useRoofStore((s) => s.patchHouse)
  const setShape = useRoofStore((s) => s.setShape)
  const setRoofType = useRoofStore((s) => s.setRoofType)
  const panelSettings = useRoofStore((s) => s.panelSettings)
  const patchPanelSettings = useRoofStore((s) => s.patchPanelSettings)
  const panels = useRoofStore((s) => s.panels)
  const obstacles = useRoofStore((s) => s.obstacles)
  const selectedObstacleId = useRoofStore((s) => s.selectedObstacleId)
  const addObstacle = useRoofStore((s) => s.addObstacle)
  const updateObstacle = useRoofStore((s) => s.updateObstacle)
  const deleteSelectedObstacle = useRoofStore((s) => s.deleteSelectedObstacle)
  const clearObstacles = useRoofStore((s) => s.clearObstacles)
  const removePanelsOverlappingObstacles = useRoofStore(
    (s) => s.removePanelsOverlappingObstacles,
  )
  const autoFill = useRoofStore((s) => s.autoFill)
  const addPanel = useRoofStore((s) => s.addPanel)
  const deleteSelected = useRoofStore((s) => s.deleteSelected)
  const clearPanels = useRoofStore((s) => s.clearPanels)
  const setPanelCount = useRoofStore((s) => s.setPanelCount)
  const totalKw = useRoofStore((s) => s.totalKw)
  const selectedObstacle = obstacles.find((o) => o.id === selectedObstacleId)
  const conflictCount = panels.filter((p) => p.conflict).length
  const showMeasurements = useRoofStore((s) => s.showMeasurements)
  const setShowMeasurements = useRoofStore((s) => s.setShowMeasurements)
  const sunMinuteOfDay = useRoofStore((s) => s.sunMinuteOfDay)
  const setSunMinuteOfDay = useRoofStore((s) => s.setSunMinuteOfDay)
  const sunDayOfYear = useRoofStore((s) => s.sunDayOfYear)
  const setSunDayOfYear = useRoofStore((s) => s.setSunDayOfYear)

  const roofAllowed = supportedRoofTypes(house.shape)
  const sunH = Math.floor(sunMinuteOfDay / 60)
  const sunM = String(sunMinuteOfDay % 60).padStart(2, '0')

  return (
    <div className="sidebar-scroll flex h-full flex-col gap-3 overflow-y-auto px-4 py-4 text-slate-800">
      <header className="shrink-0 pb-1">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">
          Solar Roof Preview
        </h1>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
          3D house on the aerial plan. Control shape, panels, and the sun path
          from here.
        </p>
      </header>

      {validationMessage && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
        >
          <p>{validationMessage}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {trimUndo ? (
              <button
                type="button"
                className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700"
                onClick={() => undoTrim()}
              >
                Undo / Discard change
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
              onClick={() => dismissValidation()}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <Section title="Units" hint="Form + measurement overlay follow this. Internal 3D stays meters.">
        <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {(['m', 'ft'] as const).map((u) => (
            <button
              key={u}
              type="button"
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                unit === u
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              onClick={() => setUnit(u)}
            >
              {u === 'm' ? 'Meters' : 'Feet'}
            </button>
          ))}
        </div>
      </Section>

      <Section title="House shape">
        <UiSelect<HouseShape>
          label="Footprint"
          value={house.shape}
          onChange={setShape}
          options={[
            { value: 'rectangle', label: 'Rectangle' },
            { value: 'l', label: 'L-shape' },
            { value: 'u', label: 'U-shape' },
            { value: 't', label: 'T-shape' },
          ]}
        />

        {house.shape === 'rectangle' && (
          <div className="grid grid-cols-2 gap-2.5">
            <NumField
              label="Length"
              meters={house.rectangle.lengthM}
              unit={unit}
              onMeters={(lengthM) => patchHouse({ rectangle: { lengthM } })}
            />
            <NumField
              label="Width"
              meters={house.rectangle.widthM}
              unit={unit}
              onMeters={(widthM) => patchHouse({ rectangle: { widthM } })}
            />
          </div>
        )}

        {house.shape === 'l' && (
          <div className="grid grid-cols-2 gap-2.5">
            <NumField
              label="Total length"
              meters={house.l.totalLengthM}
              unit={unit}
              onMeters={(totalLengthM) => patchHouse({ l: { totalLengthM } })}
            />
            <NumField
              label="Total width"
              meters={house.l.totalWidthM}
              unit={unit}
              onMeters={(totalWidthM) => patchHouse({ l: { totalWidthM } })}
            />
            <NumField
              label="Cut-out length"
              meters={house.l.cutoutLengthM}
              unit={unit}
              onMeters={(cutoutLengthM) => patchHouse({ l: { cutoutLengthM } })}
            />
            <NumField
              label="Cut-out width"
              meters={house.l.cutoutWidthM}
              unit={unit}
              onMeters={(cutoutWidthM) => patchHouse({ l: { cutoutWidthM } })}
            />
            <div className="col-span-2">
              <UiSelect<CutoutCorner>
                label="Cut-out corner"
                value={house.l.cutoutCorner}
                onChange={(cutoutCorner) => patchHouse({ l: { cutoutCorner } })}
                options={[
                  { value: 'NE', label: 'NE' },
                  { value: 'NW', label: 'NW' },
                  { value: 'SE', label: 'SE' },
                  { value: 'SW', label: 'SW' },
                ]}
              />
            </div>
          </div>
        )}

        {house.shape === 'u' && (
          <div className="grid grid-cols-2 gap-2.5">
            <NumField
              label="Total length"
              meters={house.u.totalLengthM}
              unit={unit}
              onMeters={(totalLengthM) => patchHouse({ u: { totalLengthM } })}
            />
            <NumField
              label="Total width"
              meters={house.u.totalWidthM}
              unit={unit}
              onMeters={(totalWidthM) => patchHouse({ u: { totalWidthM } })}
            />
            <NumField
              label="Cut-out length"
              meters={house.u.cutoutLengthM}
              unit={unit}
              onMeters={(cutoutLengthM) => patchHouse({ u: { cutoutLengthM } })}
            />
            <NumField
              label="Cut-out width"
              meters={house.u.cutoutWidthM}
              unit={unit}
              onMeters={(cutoutWidthM) => patchHouse({ u: { cutoutWidthM } })}
            />
          </div>
        )}

        {house.shape === 't' && (
          <div className="grid grid-cols-2 gap-2.5">
            <NumField
              label="Total length"
              meters={house.t.totalLengthM}
              unit={unit}
              onMeters={(totalLengthM) => patchHouse({ t: { totalLengthM } })}
            />
            <NumField
              label="Total width"
              meters={house.t.totalWidthM}
              unit={unit}
              onMeters={(totalWidthM) => patchHouse({ t: { totalWidthM } })}
            />
            <NumField
              label="Stem width"
              meters={house.t.stemWidthM}
              unit={unit}
              onMeters={(stemWidthM) => patchHouse({ t: { stemWidthM } })}
            />
            <NumField
              label="Crossbar depth"
              meters={house.t.crossbarDepthM}
              unit={unit}
              onMeters={(crossbarDepthM) =>
                patchHouse({ t: { crossbarDepthM } })
              }
            />
          </div>
        )}
      </Section>

      <Section title="Massing">
        <div className="grid grid-cols-2 gap-2.5">
          <FloorsField
            value={house.floors}
            onCommit={(floors) => patchHouse({ floors })}
          />
          <NumField
            label="Floor height"
            meters={house.floorHeightM}
            unit={unit}
            min={2.7}
            max={3.6}
            step={0.05}
            onMeters={(floorHeightM) => patchHouse({ floorHeightM })}
          />
        </div>
        <UiSelect<RoofType>
          label="Roof type"
          value={house.roofType}
          onChange={setRoofType}
          options={[
            { value: 'flat', label: 'flat' },
            {
              value: 'gable',
              label: roofAllowed.includes('gable') ? 'gable' : 'gable (unsupported)',
              disabled: !roofAllowed.includes('gable'),
            },
          ]}
        />
        <NumField
          label="Roof overhang"
          meters={house.overhangM}
          unit={unit}
          min={0}
          onMeters={(overhangM) => patchHouse({ overhangM })}
        />
      </Section>

      <Section
        title="Roof obstacles"
        hint={`${obstacles.length} obstacle(s)${
          conflictCount > 0 ? ` · ${conflictCount} panel conflict(s)` : ''
        }`}
      >
        <p className="text-[11px] text-slate-500">
          Add menu uses size presets labeled <em>default</em>. Drag on the roof;
          invalid drops revert.
          {house.roofType === 'gable'
            ? ' Gable: water tank & stair room disabled (chimney / AC only).'
            : ''}
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              'water_tank',
              'stair_room',
              'chimney',
              'ac_unit',
            ] as ObstacleType[]
          ).map((t) => {
            const gableBlocked =
              house.roofType === 'gable' &&
              (t === 'water_tank' || t === 'stair_room')
            return (
              <button
                key={t}
                type="button"
                className={btnGhost}
                title={
                  gableBlocked
                    ? 'Not available on gable roofs'
                    : DEFAULT_OBSTACLE_PRESETS[t].label
                }
                disabled={gableBlocked}
                onClick={() => addObstacle(t)}
              >
                + {OBSTACLE_TYPE_LABELS[t]}
              </button>
            )
          })}
        </div>
        <NumField
          label="Obstacle clearance (default 0.3)"
          meters={panelSettings.obstacleClearanceM}
          unit={unit}
          min={0}
          onMeters={(obstacleClearanceM) =>
            patchPanelSettings({ obstacleClearanceM })
          }
        />
        {selectedObstacle ? (
          <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5">
            <p className="col-span-2 text-[11px] font-medium text-amber-900">
              Selected: {OBSTACLE_TYPE_LABELS[selectedObstacle.type]}
            </p>
            {(() => {
              const lim = OBSTACLE_SIZE_LIMITS[selectedObstacle.type]
              const isTank = selectedObstacle.type === 'water_tank'
              return (
                <>
                  <NumField
                    label={
                      isTank
                        ? `Diameter (max ${lim.maxW} m)`
                        : `Width (max ${lim.maxW} m)`
                    }
                    meters={selectedObstacle.widthM}
                    unit={unit}
                    min={lim.minW}
                    max={lim.maxW}
                    onMeters={(widthM) =>
                      updateObstacle(selectedObstacle.id, {
                        widthM,
                        depthM: isTank ? widthM : selectedObstacle.depthM,
                      })
                    }
                  />
                  {!isTank ? (
                    <NumField
                      label={`Depth (max ${lim.maxD} m)`}
                      meters={selectedObstacle.depthM}
                      unit={unit}
                      min={lim.minD}
                      max={lim.maxD}
                      onMeters={(depthM) =>
                        updateObstacle(selectedObstacle.id, { depthM })
                      }
                    />
                  ) : (
                    <p className="text-[10px] leading-snug text-amber-800/80">
                      Tank Ø limit {lim.minW}–{lim.maxW} m (default 1.2).
                    </p>
                  )}
                  <NumField
                    label={`Height (max ${lim.maxH} m)`}
                    meters={selectedObstacle.heightM}
                    unit={unit}
                    min={lim.minH}
                    max={lim.maxH}
                    onMeters={(heightM) =>
                      updateObstacle(selectedObstacle.id, { heightM })
                    }
                  />
                </>
              )
            })()}
          </div>
        ) : (
          <p className="text-[11px] text-slate-400">
            Click an obstacle in the 3D view to edit size / height.
          </p>
        )}
        {obstacles.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnGhost}
              onClick={() => deleteSelectedObstacle()}
              disabled={!selectedObstacleId}
            >
              Delete obstacle
            </button>
            <button
              type="button"
              className={btnGhost}
              onClick={() => clearObstacles()}
            >
              Clear obstacles
            </button>
          </div>
        ) : null}
        {conflictCount > 0 ? (
          <div className="space-y-2 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
            <p>
              {conflictCount} panel(s) overlap obstacles (red edges). Flat canopy
              modules must stay clear of tanks.
            </p>
            <button
              type="button"
              className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
              onClick={() => removePanelsOverlappingObstacles()}
            >
              Remove overlapping panels
            </button>
          </div>
        ) : null}
      </Section>

      <Section
        title="Solar panels"
        hint={`${panels.length} panels · ${totalKw().toFixed(2)} kW`}
      >
        <div className="grid grid-cols-2 gap-2.5">
          <NumField
            label="Panel W"
            meters={panelSettings.widthM}
            unit={unit}
            onMeters={(widthM) => patchPanelSettings({ widthM })}
          />
          <NumField
            label="Panel H"
            meters={panelSettings.heightM}
            unit={unit}
            onMeters={(heightM) => patchPanelSettings({ heightM })}
          />
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Watt</span>
            <input
              type="number"
              className={field}
              value={panelSettings.watt}
              onChange={(e) =>
                patchPanelSettings({ watt: Number(e.target.value) })
              }
            />
          </label>
          <NumField
            label="Setback"
            meters={panelSettings.setbackM}
            unit={unit}
            min={0}
            onMeters={(setbackM) => patchPanelSettings({ setbackM })}
          />
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Tilt °</span>
            <input
              type="number"
              min={0}
              max={30}
              className={field}
              value={panelSettings.tiltDeg}
              onChange={(e) =>
                patchPanelSettings({ tiltDeg: Number(e.target.value) })
              }
            />
          </label>
          <UiSelect<'portrait' | 'landscape'>
            label="Orientation"
            value={panelSettings.orientation}
            onChange={(orientation) => patchPanelSettings({ orientation })}
            options={[
              { value: 'portrait', label: 'Portrait' },
              { value: 'landscape', label: 'Landscape' },
            ]}
          />
          <NumField
            label="Row spacing"
            meters={panelSettings.rowSpacingM}
            unit={unit}
            min={0}
            onMeters={(rowSpacingM) => patchPanelSettings({ rowSpacingM })}
          />
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Panel count</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className={field}
              value={panels.length}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '')
                // Empty while typing — don't wipe panels until a number is committed
                if (raw === '') return
                setPanelCount(Math.min(500, Number(raw)))
              }}
              onBlur={(e) => {
                const raw = e.target.value.replace(/\D/g, '')
                if (raw === '') setPanelCount(panels.length)
              }}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} onClick={() => autoFill()}>
            Auto-fill
          </button>
          <button type="button" className={btnGhost} onClick={() => addPanel()}>
            + Panel
          </button>
          <button
            type="button"
            className={btnGhost}
            onClick={() => deleteSelected()}
          >
            Delete
          </button>
          <button
            type="button"
            className={btnGhost}
            onClick={() => clearPanels()}
          >
            Clear
          </button>
        </div>
      </Section>

      <Section title="Preview">
        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            className="size-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500/30"
            checked={showMeasurements}
            onChange={(e) => setShowMeasurements(e.target.checked)}
          />
          Measurements overlay
        </label>
        <label className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className={labelCls}>Sun time</span>
            <span className="font-mono text-xs text-sky-700">
              {sunH}:{sunM}
            </span>
          </div>
          <input
            type="range"
            className="ui-range w-full"
            min={0}
            max={1439}
            value={sunMinuteOfDay}
            onChange={(e) => setSunMinuteOfDay(Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className={labelCls}>Day of year</span>
            <span className="font-mono text-xs text-sky-700">{sunDayOfYear}</span>
          </div>
          <input
            type="range"
            className="ui-range w-full"
            min={1}
            max={365}
            value={sunDayOfYear}
            onChange={(e) => setSunDayOfYear(Number(e.target.value))}
          />
        </label>
      </Section>
    </div>
  )
}
