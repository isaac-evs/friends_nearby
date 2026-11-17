import type { ReactNode } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { Bookmark, Flame, Layers, Plus, ShieldCheck, User, Users, LogOut } from 'lucide-react'
import { Logo, ProgressBar } from '@/design'
import { useApp, useMe } from './store'
import { useSaved } from '@/features/saved/useSaved'
import { cn } from '@/lib/cn'

const link = ({ isActive }: { isActive: boolean }) =>
  cn('flex h-[46px] items-center gap-3 rounded-md border px-3 text-[15px] font-bold', isActive ? 'border-line bg-primary-soft' : 'border-transparent hover:bg-surface-muted')

/** Desktop (≥ 1024 px): sidebar de 220 px + contenido. El contenido de explorar/mapa ocupa todo el ancho. */
export function DesktopShell({ children, wide }: { children: ReactNode; wide: boolean }) {
  const { state, actions } = useApp()
  const me = useMe()
  const nav = useNavigate()
  const saved = useSaved()
  const pending = Object.values(state.friendships).filter((f) => f.status === 'requested_in' && !state.blocks.includes(f.userId)).length
  return (
    <div className="flex min-h-dvh bg-bg">
      <aside aria-label="Menú" className="sticky top-0 flex h-dvh w-[220px] shrink-0 flex-col gap-[22px] border-r border-line bg-surface px-[18px] py-[26px]">
        <Link to="/" className="px-1.5"><Logo className="text-[32px] tracking-[-1px]" /></Link>
        <nav aria-label="Navegación principal" className="flex flex-col gap-1.5">
          <NavLink to="/" end className={link}><Layers aria-hidden="true" size={20} />Explorar y mapa</NavLink>
          <NavLink to="/amigos" className={link}>
            <Users aria-hidden="true" size={20} />Amigos
            {pending > 0 && <span className="ml-auto rounded-full bg-accent px-[7px] text-caption font-bold">{pending}</span>}
          </NavLink>
          <NavLink to="/guardados" className={link}>
            <Bookmark aria-hidden="true" size={20} />Guardados
            {saved.count > 0 && <span aria-label={`${saved.count} guardados`} className="ml-auto rounded-full bg-primary px-[7px] text-caption font-bold text-white">{saved.count}</span>}
          </NavLink>
          <NavLink to="/perfil" className={link}><User aria-hidden="true" size={20} />Mi perfil</NavLink>
          <NavLink to="/modo-abierto" className={link}><ShieldCheck aria-hidden="true" size={20} />Modo abierto</NavLink>
        </nav>
        <Link to="/publicar" className="flex h-[50px] items-center justify-center gap-2 rounded-lg bg-accent text-[15px] font-bold text-ink shadow-md">
          <Plus aria-hidden="true" size={18} strokeWidth={2.6} />Publicar plan
        </Link>
        <div className="mt-auto flex flex-col gap-2.5 rounded-lg border border-line bg-cat-comer p-3.5">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">AL</span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-bold">{me.name}</span>
              <span className="text-caption font-bold">Nivel {me.level} · {state.xp} XP</span>
            </div>
            <span className="flex items-center gap-0.5 rounded-full bg-accent px-2 py-0.5 text-caption font-bold">
              <Flame aria-hidden="true" size={12} />{me.streakWeeks}
            </span>
          </div>
          <ProgressBar value={(state.xp / state.xpGoal) * 100} label={`Progreso al nivel ${me.level + 1}`} height="h-3" />
          <button type="button" onClick={() => { actions.signOut(); nav('/entrar') }} className="flex h-9 items-center justify-center gap-1.5 text-caption font-bold text-text">
            <LogOut aria-hidden="true" size={14} />Cerrar sesión
          </button>
        </div>
      </aside>
      <main className={cn('min-w-0 flex-1', !wide && 'flex justify-center')}>
        {wide ? children : <div className="relative flex min-h-dvh w-full max-w-[1120px] flex-col px-10 py-8">{children}</div>}
      </main>
    </div>
  )
}
