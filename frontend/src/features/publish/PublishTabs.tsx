import { NavLink } from 'react-router-dom'
import { useApp } from '@/app/store'

/** Plan rápido | Evento: segmented control como links (`aria-current`). Los eventos son públicos: solo con el modo abierto activo. */
export function PublishTabs() {
  const { state } = useApp()
  if (!state.openMode.enabled) return null
  const cls = ({ isActive }: { isActive: boolean }) =>
    `flex h-9 items-center justify-center gap-1.5 rounded-[11px] text-sm font-bold ${isActive ? 'bg-surface text-ink shadow-xs' : 'text-muted'}`
  return (
    <nav aria-label="Qué quieres publicar" className="grid grid-cols-2 gap-1 rounded-md bg-surface-sunken p-1">
      <NavLink to="/publicar" end className={cls}>Plan rápido</NavLink>
      <NavLink to="/publicar/evento" className={cls}>Evento <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" /></NavLink>
    </nav>
  )
}
