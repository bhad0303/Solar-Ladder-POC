import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  defaultFormValues,
  formValuesToSpec,
  panelSetupFormSchema,
  powerDensityWarning,
  specToFormValues,
  tiltRowSpacingWarning,
  type PanelSetupFormValues,
} from './energy/panelSpecSchema'
import { RadioGroup } from './RadioGroup'
import { SoftNumberInput } from './SoftNumberInput'
import { useRoofStore } from './store/useRoofStore'

const field =
  'ui-input no-spinner w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm'
const fieldInRow =
  'ui-input no-spinner min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm'
const labelCls = 'text-[11px] font-medium uppercase tracking-wide text-slate-500'
const btnPrimary =
  'rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-white shadow-sm shadow-sky-500/25 transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-40'
const btnGhost =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-[11px] text-red-600">{message}</p>
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
    setFocus,
    formState: { errors, isValid, isSubmitting },
  } = form

  useEffect(() => {
    reset(specToFormValues(getAppliedSpecification()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const draft = watch()
  const draftSpec = useMemo(() => {
    const parsed = panelSetupFormSchema.safeParse(draft)
    if (!parsed.success) return null
    return formValuesToSpec(parsed.data)
  }, [draft])

  const softWarnings = useMemo(() => {
    if (!draftSpec) return [] as string[]
    return [powerDensityWarning(draftSpec), tiltRowSpacingWarning(draftSpec)].filter(
      Boolean,
    ) as string[]
  }, [draftSpec])

  const setNum =
    (name: keyof PanelSetupFormValues) => (n: number | undefined) => {
      if (n === undefined || !Number.isFinite(n)) return
      setValue(name, n as never, {
        shouldValidate: true,
        shouldDirty: true,
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
    (errs) => {
      const first = Object.keys(errs)[0] as keyof PanelSetupFormValues | undefined
      if (first) setFocus(first)
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
            Common settings first. Apply keeps your current panel count.
          </p>
        </div>
        <span className="text-slate-400">{open ? '▾' : '▸'}</span>
      </button>

      {open ? (
        <form className="space-y-3" onSubmit={onApply} noValidate>
          {/* —— Frequent —— */}
          <RadioGroup
            label="Module type"
            name="moduleType"
            value={draft.moduleType}
            onChange={(moduleType) => {
              setValue('moduleType', moduleType, { shouldValidate: true })
              // Look only — does not add/remove panels
              patchPanelSettings({ moduleType })
            }}
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'premium', label: 'Premium' },
              { value: 'thin-film', label: 'Thin-film' },
            ]}
          />
          <p className="text-[10px] leading-snug text-slate-500">
            Updates look on the {panels.length} placed panel
            {panels.length === 1 ? '' : 's'} (same count as System Summary).
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="panel-tilt" className={labelCls}>
                Panel tilt (°)
              </label>
              <SoftNumberInput
                id="panel-tilt"
                className={field}
                value={Number.isFinite(draft.tiltDeg) ? draft.tiltDeg : undefined}
                onCommit={setNum('tiltDeg')}
                aria-label="Panel tilt"
              />
              <FieldError message={errors.tiltDeg?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="panel-azimuth" className={labelCls}>
                Panel azimuth (°)
              </label>
              <SoftNumberInput
                id="panel-azimuth"
                className={field}
                value={
                  Number.isFinite(draft.azimuthDeg)
                    ? draft.azimuthDeg
                    : undefined
                }
                onCommit={setNum('azimuthDeg')}
                aria-label="Panel azimuth"
              />
              <FieldError message={errors.azimuthDeg?.message} />
            </div>
          </div>
          <p className="text-[10px] text-slate-500">
            Azimuth: 0° North, 90° East, 180° South, 270° West
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="panel-setback" className={labelCls}>
                Roof edge setback (m)
              </label>
              <SoftNumberInput
                id="panel-setback"
                className={field}
                value={
                  Number.isFinite(draft.setbackM) ? draft.setbackM : undefined
                }
                onCommit={setNum('setbackM')}
              />
              <FieldError message={errors.setbackM?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
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
              <label htmlFor="panel-row-spacing" className={labelCls}>
                Row spacing (m)
              </label>
              <SoftNumberInput
                id="panel-row-spacing"
                className={field}
                value={
                  Number.isFinite(draft.rowSpacingM)
                    ? draft.rowSpacingM
                    : undefined
                }
                onCommit={setNum('rowSpacingM')}
              />
              <FieldError message={errors.rowSpacingM?.message} />
            </div>
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
              onClick={() => reset(defaultFormValues(latitude))}
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

          {/* —— Rarely used —— */}
          <details className="rounded-lg border border-slate-200 bg-slate-50/80 open:bg-white">
            <summary className="cursor-pointer px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Advanced (size, power, losses)
            </summary>
            <div className="space-y-3 border-t border-slate-100 px-3 py-3">
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

              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label htmlFor="panel-width" className={labelCls}>
                    Panel width
                  </label>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <SoftNumberInput
                      id="panel-width"
                      className={fieldInRow}
                      value={
                        Number.isFinite(draft.width) ? draft.width : undefined
                      }
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
                        setValue('widthUnit', widthUnit, {
                          shouldValidate: true,
                        })
                      }
                      options={[
                        { value: 'm', label: 'm' },
                        { value: 'mm', label: 'mm' },
                      ]}
                    />
                  </div>
                  <FieldError message={errors.width?.message} />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label htmlFor="panel-height" className={labelCls}>
                    Panel height
                  </label>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <SoftNumberInput
                      id="panel-height"
                      className={fieldInRow}
                      value={
                        Number.isFinite(draft.height) ? draft.height : undefined
                      }
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
                        setValue('heightUnit', heightUnit, {
                          shouldValidate: true,
                        })
                      }
                      options={[
                        { value: 'm', label: 'm' },
                        { value: 'mm', label: 'mm' },
                      ]}
                    />
                  </div>
                  <FieldError message={errors.height?.message} />
                </div>
              </div>

              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="panel-rated-power" className={labelCls}>
                  Rated power per panel
                </label>
                <div className="flex min-w-0 items-center gap-1.5">
                  <SoftNumberInput
                    id="panel-rated-power"
                    className={fieldInRow}
                    value={
                      Number.isFinite(draft.ratedPower)
                        ? draft.ratedPower
                        : undefined
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
                    onChange={(powerUnit) =>
                      setValue('powerUnit', powerUnit, { shouldValidate: true })
                    }
                    options={[
                      { value: 'W', label: 'W' },
                      { value: 'kW', label: 'kW' },
                    ]}
                  />
                </div>
                <FieldError message={errors.ratedPower?.message} />
              </div>

              <div className="flex flex-col gap-1.5">
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
            </div>
          </details>

          {softWarnings.length > 0 ? (
            <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
              {softWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
        </form>
      ) : null}
    </section>
  )
}
