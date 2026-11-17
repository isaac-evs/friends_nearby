import { NavLink } from 'react-router-dom'
import { Layers, Map as MapIcon, Plus, User, Users } from 'lucide-react'
import { cn } from '@/lib/cn'

const item = ({ isActive }: { isActive: boolean }) =>
  cn('flex min-h-12 w-[60px] flex-col items-center justify-center gap-0.5 text-caption', isActive ? 'font-bold text-primary' : 'font-semibold text-muted')

/** TabBar flotante: inset 12, alto 68, radio `xl`, `shadow-lg`. Item activo con `aria-current="page"`. */
export function TabBar() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <nav
        aria-label="Navegación principal"
        className="pointer-events-auto mx-auto flex h-[68px] max-w-[456px] items-center justify-around rounded-xl border border-line bg-surface px-1 shadow-lg"
      >
        <NavLink to="/" end className={item}><Layers aria-hidden="true" size={22} />Explorar</NavLink>
        <NavLink to="/mapa" className={item}><MapIcon aria-hidden="true" size={22} />Mapa</NavLink>
        <NavLink to="/publicar" aria-label="Publicar plan o evento" className="flex size-[50px] items-center justify-center rounded-lg bg-ink text-white">
          <Plus aria-hidden="true" size={24} strokeWidth={2.6} />
        </NavLink>
        <NavLink to="/amigos" className={item}><Users aria-hidden="true" size={22} />Amigos</NavLink>
        <NavLink to="/perfil" className={item}><User aria-hidden="true" size={22} />Perfil</NavLink>
      </nav>
    </div>
  )
}
