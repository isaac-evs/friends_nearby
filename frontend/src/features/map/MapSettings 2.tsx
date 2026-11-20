import { useId, useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { ModalSheet } from '@/design'
import { useApp } from '@/app/store'
import { cn } from '@/lib/cn'
import { RangeOptions } from '../range/RangeControl'
import { radiusLabel } from '@/lib/reach'
import { dayLabel } from '@/lib/day'
import { LiveStatus } from './LiveStatus'
import { MapLegendList } from './MapLegend'
import { DayChips } from '../explore/DayChips'

function Panel() {
  const { state } = useApp()
  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Día" className="flex flex-col gap-2">
        <h3 className="text-meta font-bold">Día · {dayLabel(state.dayOffset)}</h3>
        <p className="text-caption text-muted">Qué día ver de planes y eventos. Tus amigos cercanos se ven siempre.</p>
        <DayChips wrap />
      </section>
      <section aria-label="Rango" className="flex flex-col gap-2">
        <h3 className="text-meta font-bold">Rango de búsqueda · {radiusLabel(state.radiusM)}</h3>
        <p className="text-caption text-muted">Solo ves planes, eventos y amigos dentro de este rango. Se mide desde tu ubicación aproximada.</p>
        <RangeOptions />
      </section>
      <section aria-label="Visibilidad" className="flex flex-col gap-1">
        <LiveStatus />
      </section>
      <section aria-label="Qué es cada cosa" className="flex flex-col gap-2">
        <h3 className="text-meta font-bold">Qué es cada cosa</h3>
        <MapLegendList />
      </section>
    </div>
  )
}

/**
 * Configuración del mapa: un solo botón con ícono. Dentro, el día, el rango, quién te ve y qué significa cada
 * marcador (con los créditos del mapa), para no llenar la pantalla. Desktop: panel junto al botón; móvil: hoja.
 */
export function MapSettings({ variant, align = 'right', className }: { variant: 'popover' | 'sheet'; align?: 'left' | 'right'; className?: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className={cn('relative', className)}>
      <button
        type="button" aria-label="Configuración del mapa" aria-expanded={open} aria-controls={variant === 'popover' ? id : undefined} aria-haspopup={variant === 'sheet' ? 'dialog' : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn('pointer-events-auto flex size-11 items-center justify-center rounded-md border shadow-md', open ? 'border-primary bg-surface text-primary' : 'border-line bg-surface text-ink')}
      >
        {open && variant === 'popover' ? <X aria-hidden="true" size={20} /> : <SlidersHorizontal aria-hidden="true" size={20} />}
      </button>
      {variant === 'popover' && open && (
        <div id={id} role="region" aria-label="Configuración del mapa" className={`pointer-events-auto absolute top-[calc(100%+8px)] z-30 ${align === 'left' ? 'left-0' : 'right-0'} max-h-[calc(100dvh-110px)] w-[340px] overflow-y-auto rounded-lg border border-line bg-surface p-4 shadow-lg`}>
          <Panel />
        </div>
      )}
      {variant === 'sheet' && (
        <ModalSheet open={open} title="Configuración del mapa" onClose={() => setOpen(false)}>
          <Panel />
        </ModalSheet>
      )}
    </div>
  )
}
