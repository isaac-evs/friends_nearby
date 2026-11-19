import { Link } from 'react-router-dom'
import { ChevronRight, Radio } from 'lucide-react'
import { useClock } from '@/app/hooks'
import { countdownLabel, minutesUntilStart } from '@/lib/planTime'
import { cn } from '@/lib/cn'
import { useMyPlans, type MyPlan } from './useMyPlans'

/** El plan o evento que tienes ahora: el que está en curso o, si no, el próximo que empieza en menos de 24 h. */
export function useActivePlan(): MyPlan | undefined {
  const now = useClock(30_000)
  const mine = useMyPlans(now)
  return mine.find((p) => p.phase === 'live') ?? mine.find((p) => p.phase === 'upcoming' && minutesUntilStart(p, now) <= 24 * 60)
}

/**
 * "Mi plan activo" (panel derecho de desktop). Es un enlace: al tocarlo te lleva directo a la pantalla del plan (o del evento),
 * donde están quiénes van, el chat y el check-in.
 */
export function ActivePlanCard({ className }: { className?: string }) {
  const now = useClock(30_000)
  const p = useActivePlan()
  if (!p) return null
  const live = p.phase === 'live'
  return (
    <>
      <Link
        to={p.href} aria-label={`Mi plan activo: ${p.title}`}
        className={cn('flex min-h-[76px] w-full items-center gap-3 rounded-xl border border-line p-3.5 text-left ', live ? 'bg-cat-musica' : 'bg-surface', className)}
      >
        <span aria-hidden="true" className="flex shrink-0 items-center justify-center text-success-text"><Radio size={22} /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-caption font-bold tracking-[0.8px] text-muted uppercase">Mi plan activo</span>
          <span className="truncate text-[15px] font-extrabold">{p.title}</span>
          <span className="text-caption font-semibold text-text">{countdownLabel(p, now)} · {p.placeName}</span>
        </span>
        <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-muted" />
      </Link>
    </>
  )
}
