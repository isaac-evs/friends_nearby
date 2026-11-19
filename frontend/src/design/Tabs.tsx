import { useRef, type KeyboardEvent } from 'react'
import { cn } from '@/lib/cn'

/** `live`: punto verde parpadeante junto al nombre (algo está pasando ahora). */
export interface TabDef<T extends string> { value: T; label: string; live?: boolean }

/** ids estables para enlazar pestaña ↔ panel (`aria-controls` / `aria-labelledby`). */
export const tabId = (base: string, v: string) => `${base}-tab-${v}`
export const panelId = (base: string, v: string) => `${base}-panel-${v}`

/**
 * Pestañas accesibles (patrón WAI-ARIA): `tablist` + `tab` con `aria-selected`; flechas ← → Inicio Fin mueven el foco
 * y seleccionan. El panel lo pinta quien la usa con `role="tabpanel"` y `aria-labelledby={tabId(base, value)}`.
 */
export function Tabs<T extends string>({
  base, label, value, onChange, tabs, className,
}: { base: string; label: string; value: T; onChange: (v: T) => void; tabs: TabDef<T>[]; className?: string }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const onKey = (e: KeyboardEvent, i: number) => {
    const last = tabs.length - 1
    const next = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? last : -1
    if (next < 0) return
    e.preventDefault()
    const t = tabs[next]!
    onChange(t.value)
    refs.current[t.value]?.focus()
  }
  return (
    <div role="tablist" aria-label={label} className={cn('grid border-b border-line', className)} style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map((t, i) => {
        const on = t.value === value
        return (
          <button
            key={t.value} ref={(el) => { refs.current[t.value] = el }} type="button" role="tab" id={tabId(base, t.value)}
            aria-selected={on} aria-controls={panelId(base, t.value)} tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.value)} onKeyDown={(e) => onKey(e, i)}
            className={cn('-mb-px h-12 border-b-[3px] text-[15px] font-bold transition-colors', on ? 'border-primary text-ink' : 'border-transparent text-muted')}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              {t.label}
              {t.live && <><span aria-hidden="true" className="size-2.5 animate-pulse rounded-full bg-success motion-reduce:animate-none" /><span className="sr-only"> (hay uno ahora)</span></>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
