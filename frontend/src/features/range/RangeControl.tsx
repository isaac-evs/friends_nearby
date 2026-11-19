import { useState } from 'react'
import { Radar } from 'lucide-react'
import { ModalSheet } from '@/design'
import { useActions, useApp } from '@/app/store'
import { RADIUS_OPTIONS, radiusLabel } from '@/lib/reach'
import { cn } from '@/lib/cn'

/**
 * Rango de búsqueda: solo ves planes, eventos y amigos dentro de este radio (puedes ampliarlo).
 * Es una preferencia tuya, no sale de tu ubicación exacta. Objetivo de 44 px.
 */
export function RangeControl({ className }: { className?: string }) {
  const { state } = useApp()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}
        className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-meta font-bold shadow-sm', className)}
      >
        <Radar aria-hidden="true" size={16} strokeWidth={2.2} />Rango · {radiusLabel(state.radiusM)}
      </button>
      <ModalSheet open={open} title="Rango de búsqueda" onClose={() => setOpen(false)}>
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-normal text-text">Solo ves planes, eventos y amigos que estén dentro de este rango. Si no aparece nada, amplíalo.</p>
          <RangeOptions />
          <p className="text-caption text-muted">Se mide desde tu ubicación aproximada, no desde tu punto exacto.</p>
        </div>
      </ModalSheet>
    </>
  )
}

/** Rango como slider (1 · 3 · 5 · 10 · 25 km). Se mueve con el dedo, el mouse o las flechas del teclado. */
export function RangeOptions() {
  const { state } = useApp()
  const { setRadius } = useActions()
  const idx = Math.max(0, RADIUS_OPTIONS.findIndex((m) => m >= state.radiusM))
  return (
    <div className="flex flex-col gap-0.5">
      <input
        type="range" aria-label="Rango" min={0} max={RADIUS_OPTIONS.length - 1} step={1} value={idx}
        aria-valuetext={radiusLabel(RADIUS_OPTIONS[idx]!)} onChange={(e) => setRadius(RADIUS_OPTIONS[Number(e.target.value)]!)}
        className="h-11 w-full cursor-pointer accent-primary"
      />
      <div aria-hidden="true" className="flex justify-between px-1 text-caption font-semibold text-muted">
        {RADIUS_OPTIONS.map((m) => <span key={m} className={m === RADIUS_OPTIONS[idx] ? 'font-extrabold text-ink' : undefined}>{radiusLabel(m)}</span>)}
      </div>
    </div>
  )
}
