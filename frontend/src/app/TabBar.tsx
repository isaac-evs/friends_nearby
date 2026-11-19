import { NavLink } from 'react-router-dom'
import { Layers, Map as MapIcon, Plus, Users } from 'lucide-react'
import { Avatar } from '@/design'
import { useMe } from './store'
import { cn } from '@/lib/cn'

const item = ({ isActive }: { isActive: boolean }) =>
  cn('flex min-h-12 w-[60px] flex-col items-center justify-center gap-0.5 text-caption', isActive ? 'font-bold text-primary' : 'font-semibold text-muted')

/** TabBar flotante: inset 12, alto 68, radio `xl`, `shadow-lg`. Item activo con `aria-current="page"`. El perfil es tu foto. */
export function TabBar() {
  const me = useMe()
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
        <NavLink to="/perfil" className={item}>
          {({ isActive }) => (
            <>
              <Avatar userId="me" name={me.name} size={34} self src={me.avatarUrl} className={cn('rounded-full', isActive && 'ring-2 ring-primary ring-offset-2 ring-offset-surface')} />
              Perfil
            </>
          )}
        </NavLink>
      </nav>
    </div>
  )
}
