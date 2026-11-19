import { Flame } from 'lucide-react'
import { ModalSheet } from '@/design'
import { useApp } from '@/app/store'
import { historyDates } from '@/lib/history'
import { streakWeeks, thisWeekDone } from '@/lib/streak'
import { cn } from '@/lib/cn'

/** Información de la racha: solo aparece cuando tocas la racha en tu perfil. */
export function StreakSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useApp()
  const dates = historyDates(state.history)
  const weeks = streakWeeks(dates)
  const done = thisWeekDone(dates)
  return (
    <ModalSheet open={open} title="Tu racha" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <Flame aria-hidden="true" size={28} strokeWidth={2.2} />
          <p className="text-h3 font-extrabold">{weeks} {weeks === 1 ? 'semana' : 'semanas'} de racha</p>
        </div>
        <p className="text-sm leading-normal text-text">Se mantiene con al menos un plan o evento cada semana (de lunes a domingo).</p>
        <p role="status" className={cn('rounded-md px-3 py-2.5 text-sm font-bold', done ? 'bg-cat-musica text-ink' : 'bg-accent-soft text-accent-text')}>
          {done ? 'Esta semana ya cuenta.' : 'Esta semana aún no cuenta: haz un plan o evento para mantener tu racha.'}
        </p>
      </div>
    </ModalSheet>
  )
}
