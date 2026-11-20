import { NavLink } from 'react-router-dom'

/** Plan rápido | Evento: segmented control como links (`aria-current`). Siempre visible; el evento pide modo abierto (se avisa dentro). */
export function PublishTabs() {
  const cls = ({ isActive }: { isActive: boolean }) =>
    `flex h-11 items-center justify-center rounded-[11px] text-sm font-bold ${isActive ? 'bg-surface text-ink shadow-xs' : 'text-muted'}`
  return (
    <nav aria-label="Qué quieres publicar" className="grid grid-cols-2 gap-1 rounded-md bg-surface-sunken p-1">
      <NavLink to="/publicar" end className={cls}>Plan rápido</NavLink>
      <NavLink to="/publicar/evento" className={cls}>Evento</NavLink>
    </nav>
  )
}
