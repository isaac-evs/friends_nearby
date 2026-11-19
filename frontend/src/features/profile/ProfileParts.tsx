import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { LevelBadge } from '@/design'
import { levelInfo } from '@/lib/levels'

/** Amigos · planes a los que asistió · eventos a los que asistió. Igual en tu perfil y en el de otra persona. */
export function ProfileStats({ friends, plans, events }: { friends: number; plans: number; events: number }) {
  return (
    <dl aria-label="Resumen" className="grid grid-cols-3 gap-2">
      <Stat value={friends} label={friends === 1 ? 'amigo' : 'amigos'} />
      <Stat value={plans} label={plans === 1 ? 'plan' : 'planes'} />
      <Stat value={events} label={events === 1 ? 'evento' : 'eventos'} />
    </dl>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-line bg-surface px-2 py-2.5 text-center lg:py-3">
      <dd className="text-[22px] leading-none font-extrabold lg:text-2xl">{value}</dd>
      <dt className="mt-1 text-caption font-semibold text-muted">{label}</dt>
    </div>
  )
}

/** "Nivel N" con el nombre del nivel. Con `to` es un enlace (tu progreso); sin él, solo se muestra (perfil de otra persona). */
export function LevelCard({ level, to }: { level: number; to?: string }) {
  const body = (
    <>
      <LevelBadge level={level} size={48} />
      <span className="flex flex-1 flex-col">
        <span className="text-lg font-extrabold lg:text-xl">Nivel {level}</span>
        <span className="text-sm font-semibold text-muted">{levelInfo(level).name}</span>
      </span>
      {to && <ChevronRight aria-hidden="true" size={20} strokeWidth={2.2} className="text-muted" />}
    </>
  )
  const cls = 'flex min-h-[64px] items-center gap-3.5 rounded-lg border border-line bg-surface px-3.5 py-2.5 lg:min-h-[76px] lg:rounded-xl lg:px-5'
  return to ? <Link to={to} className={cls}>{body}</Link> : <div className={cls}>{body}</div>
}
