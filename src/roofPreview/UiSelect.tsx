import { useEffect, useId, useRef, useState } from 'react'

export type UiSelectOption<T extends string> = {
  value: T
  label: string
  disabled?: boolean
}

type Props<T extends string> = {
  value: T
  options: UiSelectOption<T>[]
  onChange: (value: T) => void
  label?: string
  'aria-label'?: string
}

/** Custom dropdown — no native &lt;select&gt; chrome. */
export function UiSelect<T extends string>({
  value,
  options,
  onChange,
  label,
  'aria-label': ariaLabel,
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1.5">
      {label ? (
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {label}
        </span>
      ) : null}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel ?? label}
        className={`ui-input flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-800 shadow-sm transition hover:border-slate-300 ${
          open ? 'border-sky-400 ring-[3px] ring-sky-500/15' : ''
        }`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden
          className={`shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
        >
          <path
            d="M2.5 4.5L6 8L9.5 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-[calc(100%+4px)] left-0 z-50 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/10"
        >
          {options.map((opt) => {
            const active = opt.value === value
            return (
              <li key={opt.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  disabled={opt.disabled}
                  className={`flex w-full px-3 py-2 text-left text-sm transition ${
                    opt.disabled
                      ? 'cursor-not-allowed text-slate-300'
                      : active
                        ? 'bg-sky-50 font-medium text-sky-800'
                        : 'text-slate-700 hover:bg-slate-50'
                  }`}
                  onClick={() => {
                    if (opt.disabled) return
                    onChange(opt.value)
                    setOpen(false)
                  }}
                >
                  {opt.label}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
