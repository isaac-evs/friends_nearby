import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface Segment<T extends string> { value: T; label: ReactNode; ariaLabel?: string }

/** Pista `surface-sunken`, radio 14; la opción activa es `surface` + `shadow-xs`. */
export function SegmentedControl<T extends string>({
  label, value, onChange, options, className,
}: { label: string; value: T; onChange: (v: T) => void; options: Segment<T>[]; className?: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('grid gap-1 rounded-md bg-surface-sunken p-1', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            aria-label={o.ariaLabel}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex h-9 items-center justify-center gap-1.5 rounded-[11px] text-sm font-bold transition-colors',
              on ? 'bg-surface text-ink shadow-xs' : 'text-muted',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
