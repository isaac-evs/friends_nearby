import { CalendarDays } from 'lucide-react'
import { Chip } from '@/design'
import { useActions, useApp } from '@/app/store'
import { DAY_OFFSETS, MAX_CUSTOM_OFFSET, MAX_DAY_OFFSET, dateOfOffset, dayLabel, offsetOfDate } from '@/lib/day'
import { cn } from '@/lib/cn'

/** Día que se mira: Hoy · Mañana · los próximos días. Cambia lo que muestran Explorar y el mapa (planes y eventos de ese día). */
export function DayChips({ compact, wrap, className }: { compact?: boolean; wrap?: boolean; className?: string }) {
  const { state } = useApp()
  const { setDay } = useActions()
  const custom = state.dayOffset > MAX_DAY_OFFSET
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
      <label className={cn('relative inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-meta font-bold', compact ? 'h-9 shadow-md' : 'h-11', custom ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink')}>
        <CalendarDays aria-hidden="true" size={16} />
        {custom ? dayLabel(state.dayOffset) : 'Otra fecha'}
        <input
          type="date" aria-label="Elegir otra fecha" min={dateOfOffset(0)} max={dateOfOffset(MAX_CUSTOM_OFFSET)} value={dateOfOffset(state.dayOffset)}
          onClick={(e) => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
          onChange={(e) => { const o = offsetOfDate(e.target.value); if (o !== null) setDay(o) }}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  )
}
