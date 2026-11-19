import { Link } from 'react-router-dom'
import { Bell, CalendarClock } from 'lucide-react'
import { useNotifications } from '../notifications/useNotifications'
import { ExploreDeck } from './ExploreDeck'
import { usePlanToday } from './PlanTodayHeader'
import { DayChips } from './DayChips'
import { useClock } from '@/app/hooks'
import { useMyPlans } from '../plans/useMyPlans'

/** Pantalla 3: Explorar (Mis amigos / Abierto). */
export function ExploreScreen() {
  const notif = useNotifications()
  const live = useMyPlans(useClock(30_000)).some((p) => p.phase === 'live')
  const { title, counts } = usePlanToday()
  return (
    <div className="flex flex-col gap-2.5 px-4 pt-6 pb-[100px]">
      {/* Arriba, todo en poco espacio: así las cartas de hoy quedan a la vista sin bajar. */}
      {/* Como en Instagram: un botón en cada esquina. Izquierda, Mis planes (y desde ahí Guardados); derecha, notificaciones. */}
      <header className="flex items-center gap-2">
        <Link to="/planes" aria-label={live ? 'Mis planes (tienes uno en curso)' : 'Mis planes'} className="relative flex size-11 shrink-0 items-center justify-center rounded-full text-ink">
          <CalendarClock aria-hidden="true" size={22} strokeWidth={2.2} />
          {live && <span aria-hidden="true" className="absolute top-0.5 right-0.5 size-3 animate-pulse rounded-full border-2 border-surface bg-success motion-reduce:animate-none" />}
        </Link>
        <h1 className="min-w-0 flex-1 text-center text-[22px] leading-tight font-extrabold tracking-[-0.5px]">{title}</h1>
        <Link to="/notificaciones" className="relative flex size-11 shrink-0 items-center justify-center rounded-full text-ink">
          <Bell aria-hidden="true" size={22} strokeWidth={2.2} />
          <span className="sr-only">Notificaciones</span>
          {notif.total > 0 && <span className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-accent px-1 text-caption font-bold text-ink">{notif.total > 99 ? '99+' : notif.total}<span className="sr-only"> {notif.total === 1 ? 'notificación' : 'notificaciones'}{notif.count > 0 ? `, ${notif.count} esperan tu respuesta` : ''}</span></span>}
        </Link>
      </header>
      <p className="-mt-1 text-center text-caption leading-snug text-muted">{counts}</p>
      <DayChips compact />
      <ExploreDeck />
    </div>
  )
}
