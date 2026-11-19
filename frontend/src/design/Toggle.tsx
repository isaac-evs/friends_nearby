import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Switch 50×30; área táctil de 56×44; `role="switch"` + `aria-checked`. */
export function Toggle({
  checked, onChange, label, disabled,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex h-11 w-14 shrink-0 items-center justify-center bg-transparent disabled:opacity-50"
    >
      <span className={cn('flex h-[30px] w-[50px] items-center rounded-full p-[3px] transition-colors', checked ? 'bg-primary justify-end' : 'bg-line-dashed justify-start')}>
        <span className="size-6 rounded-full bg-white shadow-xs" />
      </span>
    </button>
  )
}

/** Ícono de una fila de ajustes: solo el trazo, en negro, sin recuadro (decorativo). */
export function RowIcon({ icon }: { icon: ReactNode }) {
  return <span aria-hidden="true" className="flex size-6 flex-none items-center justify-center text-ink">{icon}</span>
}

/** Fila de ajuste con ícono opcional, título, subtítulo y switch. */
export function ToggleRow({
  title, subtitle, checked, onChange, last, icon,
}: { title: string; subtitle: string; checked: boolean; onChange: (v: boolean) => void; last?: boolean; icon?: ReactNode }) {
  return (
    <div className={cn('flex min-h-[56px] items-center gap-3', !last && 'border-b border-surface-sunken')}>
      {icon && <RowIcon icon={icon} />}
      <span className="flex flex-1 flex-col">
        <span className="text-sm font-bold">{title}</span>
        <span className="text-caption font-medium text-muted">{subtitle}</span>
      </span>
      <Toggle checked={checked} onChange={onChange} label={title} />
    </div>
  )
}
