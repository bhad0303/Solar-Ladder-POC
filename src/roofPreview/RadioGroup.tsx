type Option<T extends string> = { value: T; label: string }

type Props<T extends string> = {
  label: string
  name: string
  value: T
  options: readonly Option<T>[]
  onChange: (value: T) => void
  /** Compact inline chips (units). Default: stacked/wrap radios. */
  compact?: boolean
  /** Hide visible legend (still used for aria). */
  hideLabel?: boolean
}

export function RadioGroup<T extends string>({
  label,
  name,
  value,
  options,
  onChange,
  compact = false,
  hideLabel = false,
}: Props<T>) {
  return (
    <fieldset className="min-w-0">
      <legend
        className={
          hideLabel
            ? 'sr-only'
            : 'mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500'
        }
      >
        {label}
      </legend>
      <div
        className={
          compact
            ? 'inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5'
            : 'flex flex-wrap gap-2'
        }
        role="radiogroup"
        aria-label={label}
      >
        {options.map((opt) => {
          const id = `${name}-${opt.value}`
          const selected = value === opt.value
          if (compact) {
            return (
              <label
                key={opt.value}
                htmlFor={id}
                className={`cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                  selected
                    ? 'bg-white text-sky-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <input
                  id={id}
                  type="radio"
                  className="sr-only"
                  name={name}
                  value={opt.value}
                  checked={selected}
                  onChange={() => onChange(opt.value)}
                />
                {opt.label}
              </label>
            )
          }
          return (
            <label
              key={opt.value}
              htmlFor={id}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                selected
                  ? 'border-sky-400 bg-sky-50 text-sky-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <input
                id={id}
                type="radio"
                className="size-3.5 accent-sky-600"
                name={name}
                value={opt.value}
                checked={selected}
                onChange={() => onChange(opt.value)}
              />
              {opt.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
