import { useNavigate } from 'react-router-dom'
import { MapPinned } from 'lucide-react'
import { Avatar, Button, ButtonLink, EmptyState, Pill } from '@/design'
import { EVENT_TYPES, PLAN_CATEGORIES } from '@/lib/category'
import { eventWhenShort, formatAgo, formatApproxDistance } from '@/lib/format'
import { useActions } from '@/app/store'
import type { MapItem } from './useMapData'

/** Vista de lista equivalente al mapa (accesibilidad): mismos elementos, mismos datos y acciones. */
export function MapList({ items, emptyHint, onLocate, selectedId }: { items: MapItem[]; emptyHint: string; onLocate?: (id: string) => void; selectedId?: string | null }) {
  const { jalo } = useActions()
  const nav = useNavigate()
  if (items.length === 0) {
    return <EmptyState icon={<MapPinned aria-hidden="true" size={30} />} title="Nada por aquí" text={emptyHint} />
  }
  return (
    <ul aria-label="Amigos y eventos cerca, en lista" className="flex flex-col gap-2.5">
      {items.map((it) =>
        it.kind === 'friend' ? (
          <li key={it.id} className={`flex flex-col gap-2.5 rounded-lg border bg-surface p-3.5 shadow-sm ${selectedId === it.id ? 'border-primary' : 'border-line'}`}>
            <div className="flex items-center gap-3">
              <Avatar userId={it.user.id} name={it.user.name} size={44} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-bold">{it.user.name} · {PLAN_CATEGORIES[it.plan.category].label}</span>
                <span className="text-caption text-muted">
                  {it.exact ? it.plan.meetPoint : `a ${formatApproxDistance(it.plan.zone.approxDistanceM)} · ${it.plan.zone.name}`} · {it.exact ? 'en vivo' : formatAgo(it.plan.zoneUpdatedAt)}
                </span>
              </div>
              <Pill tone={it.exact ? 'primary' : 'muted'}>{it.exact ? 'Exacta' : 'Aprox.'}</Pill>
            </div>
            <p className="text-sm font-bold">{it.plan.line}</p>
            <div className="flex gap-2">
              {onLocate && <Button variant="secondary" className="h-11 flex-1 rounded-md text-sm" onClick={() => onLocate(it.id)}>Ver en el mapa</Button>}
              {!it.exact && (
                <Button className="h-11 flex-1 rounded-md text-sm" onClick={() => { const id = jalo(it.plan.id); if (id) nav(`/match/${id}`) }}>Jalo</Button>
              )}
            </div>
          </li>
        ) : (
          <li key={it.id} className={`flex flex-col gap-2.5 rounded-lg border bg-surface p-3.5 shadow-sm ${selectedId === it.id ? 'border-primary' : 'border-line'}`}>
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-md bg-accent">{EVENT_TYPES[it.event.type].icon({ size: 22, strokeWidth: 2.2 })}</span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-bold">{it.event.title}</span>
                <span className="text-caption text-muted">{it.event.placeName} · {eventWhenShort(it.event.startsAt)} · {formatApproxDistance(it.event.approxDistanceM)}</span>
              </div>
              <Pill tone="muted" className="bg-cat-musica">Público</Pill>
            </div>
            <p className="text-sm font-bold">{it.event.going} van · cupo {it.event.capacity}</p>
            <div className="flex gap-2">
              {onLocate && <Button variant="secondary" className="h-11 flex-1 rounded-md text-sm" onClick={() => onLocate(it.id)}>Ver en el mapa</Button>}
              <ButtonLink to={`/evento/${it.event.id}`} className="h-11 flex-1 rounded-md text-sm">Ver evento</ButtonLink>
            </div>
          </li>
        ),
      )}
    </ul>
  )
}
