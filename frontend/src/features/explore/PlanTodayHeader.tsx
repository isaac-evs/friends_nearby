import { useApp } from '@/app/store'
import { dayPhrase } from '@/lib/day'
import { useDayCounts } from '../map/useMapData'

/** Título y conteos de "¿Qué plan hoy?" para el día elegido y tu rango. */
export function usePlanToday(): { title: string; counts: string } {
  const { state } = useApp()
  const { friends, events, eventsHidden } = useDayCounts()
  const when = dayPhrase(state.dayOffset)
  const f = friends === 0 ? `Nadie ha publicado un plan ${when}` : `${friends} ${friends === 1 ? 'amigo quiere' : 'amigos quieren'} hacer algo ${when}`
  const e = eventsHidden ? 'Activa el modo abierto para ver eventos' : `${events} ${events === 1 ? 'evento' : 'eventos'} ${when}`
  return { title: `¿Qué plan ${when}?`, counts: `${f} · ${e}` }
}

/** "¿Qué plan hoy?" con cuántos amigos quieren hacer algo y cuántos eventos hay ese día (dentro de tu rango). */
export function PlanTodayHeader({ as: H = 'h1' }: { as?: 'h1' | 'h2' }) {
  const { title, counts } = usePlanToday()
  return (
    <div className="flex flex-col gap-2 pt-1">
      <H className="text-h1 font-extrabold">{title}</H>
      <span className="text-meta leading-snug text-muted">{counts}</span>
    </div>
  )
}
