import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  defaultFormValues,
  formValuesToSpec,
  panelSetupFormSchema,
  specToFormValues,
  type PanelSetupFormValues,
} from './energy/panelSpecSchema'
import { DEFAULT_PANEL_SPEC } from './energy/types'
import {
  lengthDisplayToM,
  lengthMToDisplay,
  powerDisplayToW,
  powerWToDisplay,
  roundForDisplay,
  type LengthDisplayUnit,
  type PowerDisplayUnit,
} from './energy/units'
import { RadioGroup } from './RadioGroup'
import { SoftNumberInput } from './SoftNumberInput'
import { useRoofStore } from './store/useRoofStore'

const field =
  'ui-input no-spinner box-border w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm'
const labelCls = 'text-[11px] font-medium uppercase tracking-wide text-slate-500'
const btnPrimary =
  'rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-white shadow-sm shadow-sky-500/25 transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-40'
const btnGhost =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'

function FieldError({ message }: { message?: string }) {
  // Always reserve a line so validation flicker does not jump the sidebar
  return (
    <p className="min-h-[1rem] text-[11px] text-red-600">{message ?? '\u00a0'}</p>
  )
}

export function SolarPanelSetupForm() {
  const [open, setOpen] = useState(true)
  const latitude = useRoofStore((s) => s.latitude)
  const panels = useRoofStore((s) => s.panels)
  const layoutBusy = useRoofStore((s) => s.layoutBusy)
  const layoutCustomized = useRoofStore((s) => s.layoutCustomized)
  const applyPanelSpecification = useRoofStore((s) => s.applyPanelSpecification)
  const getAppliedSpecification = useRoofStore((s) => s.getAppliedSpecification)
  const patchPanelSettings = useRoofStore((s) => s.patchPanelSettings)

  const form = useForm<PanelSetupFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(panelSetupFormSchema) as any,
    defaultValues: defaultFormValues(latitude),
    mode: 'onChange',
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isValid, isSubmitting },
  } = form

  useEffect(() => {
    reset(specToFormValues(getAppliedSpecification()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const draft = watch()

  const setNum =
    (name: keyof PanelSetupFormValues) => (n: number | undefined) => {
      if (n === undefined || !Number.isFinite(n)) return
      setValue(name, n as never, {
        shouldValidate: true,
        shouldDirty: true,
      })
    }

  /** Preserve sidebar scroll while React re-renders after a unit toggle. */
  const withSidebarScrollLocked = (fn: () => void) => {
    const scroller = document.querySelector(
      '.sidebar-scroll',
    ) as HTMLElement | null
    const top = scroller?.scrollTop ?? 0
    fn()
    requestAnimationFrame(() => {
      if (scroller) scroller.scrollTop = top
    })
  }

  /** Keep physical size the same when toggling m ↔ mm. */
  const switchLengthUnit = (
    valueKey: 'width' | 'height',
    unitKey: 'widthUnit' | 'heightUnit',
    next: LengthDisplayUnit,
  ) => {
    withSidebarScrollLocked(() => {
      const curUnit = draft[unitKey]
      if (curUnit === next) return
      const curVal = draft[valueKey]
      if (Number.isFinite(curVal)) {
        const meters = lengthDisplayToM(curVal as number, curUnit)
        const display = roundForDisplay(
          lengthMToDisplay(meters, next),
          next === 'mm' ? 1 : 3,
        )
        setValue(valueKey, display, {
          shouldDirty: true,
          shouldValidate: false,
        })
      }
      setValue(unitKey, next, { shouldDirty: true, shouldValidate: true })
    })
  }

  /** Keep physical watts the same when toggling W ↔ kW. */
  const switchPowerUnit = (next: PowerDisplayUnit) => {
    withSidebarScrollLocked(() => {
      const curUnit = draft.powerUnit
      if (curUnit === next) return
      const curVal = draft.ratedPower
      if (Number.isFinite(curVal)) {
        const watts = powerDisplayToW(curVal as number, curUnit)
        const display = roundForDisplay(
          powerWToDisplay(watts, next),
          next === 'kW' ? 3 : 0,
        )
        setValue('ratedPower', display, {
          shouldDirty: true,
          shouldValidate: false,
        })
      }
      setValue('powerUnit', next, { shouldDirty: true, shouldValidate: true })
    })
  }

  const onApply = handleSubmit(
    (values: PanelSetupFormValues) => {
      const parsed = panelSetupFormSchema.safeParse(values)
      if (!parsed.success) return
      const spec = formValuesToSpec(parsed.data)
      if (layoutCustomized && panels.length > 0) {
        const ok = window.confirm(
          `Update settings on the existing ${panels.length} panel(s)? Positions stay the same. Use Auto-fill to rebuild the whole roof.`,
        )
        if (!ok) return
      }
      applyPanelSpecification(spec)
    },
  )

  return (
    <section className="space-y-3 rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm shadow-slate-900/[0.03]">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-sky-700">
            Solar Panel Setup
          </h2>
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            Edit settings, then Apply Layout. Module type updates look immediately.
          </p>
        </div>
        <span className="text-slate-400">{open ? '▾' : '▸'}</span>
      </button>

      {open ? (
        <form className="space-y-3" onSubmit={onApply} noValidate>
          <RadioGroup
            label="Module type"
            name="moduleType"
            value={draft.moduleType}
            onChange={(moduleType) => {
              setValue('moduleType', moduleType, { shouldValidate: true })
              patchPanelSettings({ moduleType })
            }}
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'premium', label: 'Premium' },
              { value: 'thin-film', label: 'Thin-film' },
            ]}
          />

          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="panel-gap" className={labelCls}>
              Gap between panels (m)
            </label>
            <SoftNumberInput
              id="panel-gap"
              className={field}
              value={
                Number.isFinite(draft.panelGapM) ? draft.panelGapM : undefined
              }
              onCommit={setNum('panelGapM')}
            />
            <FieldError message={errors.panelGapM?.message} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="panel-model-name" className={labelCls}>
              Panel model name (optional)
            </label>
            <input
              id="panel-model-name"
              className={field}
              maxLength={80}
              {...register('modelName')}
            />
            <FieldError message={errors.modelName?.message} />
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="panel-width" className={labelCls}>
              Panel width
            </label>
            <SoftNumberInput
              id="panel-width"
              className={field}
              value={Number.isFinite(draft.width) ? draft.width : undefined}
              onCommit={setNum('width')}
              aria-label="Panel width"
            />
            <RadioGroup
              label="Width unit"
              name="widthUnit"
              compact
              hideLabel
              value={draft.widthUnit}
              onChange={(widthUnit) =>
                switchLengthUnit('width', 'widthUnit', widthUnit)
              }
              options={[
                { value: 'm', label: 'm' },
                { value: 'mm', label: 'mm' },
              ]}
            />
            <FieldError message={errors.width?.message} />
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="panel-height" className={labelCls}>
              Panel height
            </label>
            <SoftNumberInput
              id="panel-height"
              className={field}
              value={Number.isFinite(draft.height) ? draft.height : undefined}
              onCommit={setNum('height')}
              aria-label="Panel height"
            />
            <RadioGroup
              label="Height unit"
              name="heightUnit"
              compact
              hideLabel
              value={draft.heightUnit}
              onChange={(heightUnit) =>
                switchLengthUnit('height', 'heightUnit', heightUnit)
              }
              options={[
                { value: 'm', label: 'm' },
                { value: 'mm', label: 'mm' },
              ]}
            />
            <FieldError message={errors.height?.message} />
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="panel-rated-power" className={labelCls}>
              Rated power per panel
            </label>
            <SoftNumberInput
              id="panel-rated-power"
              className={field}
              value={
                Number.isFinite(draft.ratedPower) ? draft.ratedPower : undefined
              }
              onCommit={setNum('ratedPower')}
              aria-label="Rated power per panel"
            />
            <RadioGroup
              label="Power unit"
              name="powerUnit"
              compact
              hideLabel
              value={draft.powerUnit}
              onChange={switchPowerUnit}
              options={[
                { value: 'W', label: 'W' },
                { value: 'kW', label: 'kW' },
              ]}
            />
            <FieldError message={errors.ratedPower?.message} />
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="panel-losses" className={labelCls}>
              System losses (%)
            </label>
            <SoftNumberInput
              id="panel-losses"
              className={field}
              value={
                Number.isFinite(draft.systemLossPercent)
                  ? draft.systemLossPercent
                  : undefined
              }
              onCommit={setNum('systemLossPercent')}
            />
            <p className="text-[10px] leading-snug text-slate-500">
              Inverter, wiring, soiling, mismatch and other losses.
            </p>
            <FieldError message={errors.systemLossPercent?.message} />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className={btnPrimary}
              disabled={!isValid || layoutBusy || isSubmitting}
            >
              {layoutBusy ? 'Applying…' : 'Apply Layout'}
            </button>
            <button
              type="button"
              className={btnGhost}
              onClick={() =>
                reset({
                  ...defaultFormValues(latitude),
                  tiltDeg: DEFAULT_PANEL_SPEC.tiltDeg,
                  azimuthDeg: DEFAULT_PANEL_SPEC.azimuthDeg,
                  setbackM: DEFAULT_PANEL_SPEC.setbackM,
                  rowSpacingM: DEFAULT_PANEL_SPEC.rowSpacingM,
                })
              }
            >
              Reset Defaults
            </button>
            <button
              type="button"
              className={btnGhost}
              onClick={() => reset(specToFormValues(getAppliedSpecification()))}
            >
              Cancel Changes
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}
