import { Chip } from '@/design'
import { useActions, useApp } from '@/app/store'
import { DAY_OFFSETS, dayLabel } from '@/lib/day'
import { cn } from '@/lib/cn'

/** Día que se mira: Hoy · Mañana · los próximos días. Cambia lo que muestran Explorar y el mapa (planes y eventos de ese día). */
export function DayChips({ compact, wrap, className }: { compact?: boolean; wrap?: boolean; className?: string }) {
  const { state } = useApp()
  const { setDay } = useActions()
  return (
    <div role="group" aria-label="Día" className={cn('flex gap-2', wrap ? 'flex-wrap' : 'no-scrollbar overflow-x-auto', className)}>
      {DAY_OFFSETS.map((d) => (
        <Chip
          key={d} selected={state.dayOffset === d} onClick={() => setDay(d)}
          className={cn(compact ? 'h-9 shadow-md' : 'h-11', state.dayOffset === d && compact && '!border-primary !bg-primary !text-white')}
        >
          {dayLabel(d)}
        </Chip>
      ))}
    </div>
  )
}
