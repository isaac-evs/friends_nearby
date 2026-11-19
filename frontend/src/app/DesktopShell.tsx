import type { ReactNode } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { Bell, Bookmark, CalendarClock, Layers, Plus, Users } from 'lucide-react'
import { Avatar, Logo, ProgressBar, StreakBadge } from '@/design'
import { useApp, useMe } from './store'
import { useSaved } from '@/features/saved/useSaved'
import { useNotifications } from '@/features/notifications/useNotifications'
import { cn } from '@/lib/cn'

const link = ({ isActive }: { isActive: boolean }) =>
  cn('flex h-[48px] items-center gap-3 rounded-md border px-3 text-[15px] font-bold', isActive ? 'border-line bg-primary-soft' : 'border-transparent hover:bg-surface-muted')

/** Desktop (≥ 1024 px): sidebar de 220 px + contenido. El contenido de explorar/mapa ocupa todo el ancho. */
export function DesktopShell({ children, wide }: { children: ReactNode; wide: boolean }) {
  const { state } = useApp()
  const me = useMe()
  const saved = useSaved()
  const notif = useNotifications()
  // Solicitudes de amistad y de amigo cercano que esperan tu respuesta.
  const pending = Object.values(state.friendships).filter((f) => !state.blocks.includes(f.userId) && (f.status === 'requested_in' || (f.status === 'friends' && f.close === 'requested_in'))).length
  return (
    <div className="flex min-h-dvh bg-bg">
      <aside aria-label="Menú" className="sticky top-0 flex h-dvh w-[220px] shrink-0 flex-col gap-[22px] border-r border-line bg-surface px-[18px] py-[26px]">
        <Link to="/" className="px-1.5"><Logo className="text-[32px] tracking-[-1px]" /></Link>
        <nav aria-label="Navegación principal" className="flex flex-col gap-1.5">
          <NavLink to="/" end className={link}><Layers aria-hidden="true" size={24} strokeWidth={2.2} className="shrink-0" />Explorar</NavLink>
          <NavLink to="/amigos" className={link}>
            <Users aria-hidden="true" size={24} strokeWidth={2.2} className="shrink-0" />Amigos
            {pending > 0 && <span className="ml-auto rounded-full bg-accent px-[7px] text-caption font-bold">{pending}</span>}
          </NavLink>
          <NavLink to="/notificaciones" className={link}>
            <Bell aria-hidden="true" size={24} strokeWidth={2.2} className="shrink-0" />Notificaciones
            {notif.count > 0 && <span aria-label={`${notif.count} sin responder`} className="ml-auto rounded-full bg-accent px-[7px] text-caption font-bold">{notif.count}</span>}
          </NavLink>
          <NavLink to="/guardados" className={link}>
            <Bookmark aria-hidden="true" size={24} strokeWidth={2.2} className="shrink-0" />Guardados
            {saved.count > 0 && <span aria-label={`${saved.count} guardados`} className="ml-auto rounded-full bg-primary px-[7px] text-caption font-bold text-white">{saved.count}</span>}
          </NavLink>
          <NavLink to="/planes" className={link}><CalendarClock aria-hidden="true" size={24} strokeWidth={2.2} className="shrink-0" />Mis planes</NavLink>
        </nav>
        <Link to="/publicar" className="flex h-[50px] items-center justify-center gap-2 rounded-lg bg-accent text-[15px] font-bold text-ink shadow-md">
          <Plus aria-hidden="true" size={18} strokeWidth={2.6} />Publicar plan
        </Link>
        {/* Tu tarjeta: foto (lleva a tu perfil), nombre y racha; "Nivel N" arriba de la barra de nivel. */}
        <div className="mt-auto flex flex-col gap-3">
        <div className="flex flex-col gap-3.5 rounded-xl border border-line bg-surface p-3.5 shadow-sm">
          <Link to="/perfil" className="flex items-center gap-3 rounded-md">
            <span className="sr-only">Mi perfil: </span>
            <Avatar userId="me" name={me.name} size={48} self src={me.avatarUrl} />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-[15px] font-extrabold">{me.name}</span>
              <StreakBadge weeks={me.streakWeeks} className="self-start" />
            </span>
          </Link>
          <div className="flex flex-col gap-1.5">
            <span className="text-caption font-bold">Nivel {me.level}</span>
            <ProgressBar value={(state.xp / state.xpGoal) * 100} label={`Progreso al nivel ${Math.min(me.level + 1, 100)}`} height="h-3" />
          </div>
        </div>
        </div>
      </aside>
      <main className={cn('min-w-0 flex-1', !wide && 'flex justify-center')}>
        {wide ? children : <div className="relative flex min-h-dvh w-full max-w-[1120px] flex-col px-10 py-8">{children}</div>}
      </main>
    </div>
  )
}
