import { useEffect, useState } from 'react'

type Props = {
  value: number | undefined
  onCommit: (n: number | undefined) => void
  className?: string
  step?: string
  min?: number
  max?: number
  id?: string
  'aria-label'?: string
}

function formatValue(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return ''
  return String(value)
}

/**
 * Local draft while typing so fields can be cleared and retyped.
 * Commits a finite number on blur / Enter — not on every keystroke —
 * so partial values (e.g. "5" while typing "540") do not wipe the form.
 */
export function SoftNumberInput({
  value,
  onCommit,
  className,
  step = 'any',
  min,
  max,
  id,
  'aria-label': ariaLabel,
}: Props) {
  const [draft, setDraft] = useState(() => formatValue(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(formatValue(value))
  }, [value, focused])

  const commitDraft = (raw: string) => {
    const trimmed = raw.trim()
    if (
      trimmed === '' ||
      trimmed === '-' ||
      trimmed === '.' ||
      trimmed === '-.'
    ) {
      // Restore last known good value; do not push NaN into the form
      setDraft(formatValue(value))
      return
    }
    const n = Number(trimmed)
    if (!Number.isFinite(n)) {
      setDraft(formatValue(value))
      return
    }
    onCommit(n)
    setDraft(String(n))
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      aria-label={ariaLabel}
      className={className}
      value={draft}
      data-step={step}
      data-min={min}
      data-max={max}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        const raw = e.target.value
        if (raw !== '' && !/^-?\d*\.?\d*$/.test(raw)) return
        setDraft(raw)
      }}
      onBlur={() => {
        setFocused(false)
        commitDraft(draft)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
    />
  )
}
