import { Link } from 'react-router-dom'
import { Bell, Bookmark, Flame } from 'lucide-react'
import { useNotifications } from '../notifications/useNotifications'
import { useMe } from '@/app/store'
import { ExploreDeck } from './ExploreDeck'
import { usePlanToday } from './PlanTodayHeader'
import { DayChips } from './DayChips'
import { useSaved } from '../saved/useSaved'

/** Pantalla 3: Explorar (Mis amigos / Abierto). */
export function ExploreScreen() {
  const me = useMe()
  const notif = useNotifications()
  const saved = useSaved()
  const { title, counts } = usePlanToday()
  return (
    <div className="flex flex-col gap-2.5 px-4 pt-6 pb-[100px]">
      {/* Arriba, todo en poco espacio: así las cartas de hoy quedan a la vista sin bajar. */}
      <header className="flex items-center justify-between gap-2">
        <h1 className="min-w-0 text-[24px] leading-tight font-extrabold tracking-[-0.5px]">{title}</h1>
        <div className="flex shrink-0 items-center gap-1.5">
          <Link to="/perfil" aria-label={`Racha de ${me.streakWeeks} semanas`} className="flex h-9 items-center gap-1 rounded-full bg-accent-soft px-2.5 text-sm font-bold text-accent-text">
            <Flame aria-hidden="true" size={16} strokeWidth={2.2} />{me.streakWeeks}
          </Link>
          <Link to="/guardados" aria-label={saved.count ? `Guardados (${saved.count})` : 'Guardados'} className="relative flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-sm">
            <Bookmark aria-hidden="true" size={20} />
            {saved.count > 0 && <span aria-hidden="true" className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-caption font-bold text-white">{saved.count}</span>}
          </Link>
          <Link to="/notificaciones" className="relative flex size-12 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-sm">
            <Bell aria-hidden="true" size={26} strokeWidth={2.2} />
            <span className="sr-only">Notificaciones</span>
            {notif.count > 0 && <span className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-accent px-1 text-caption font-bold text-ink">{notif.count}<span className="sr-only"> sin responder</span></span>}
          </Link>
        </div>
      </header>
      <p className="-mt-1 text-caption leading-snug text-muted">{counts}</p>
      <DayChips compact />
      <ExploreDeck />
    </div>
  )
}
