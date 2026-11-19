import { MapPinned } from 'lucide-react'
import { Avatar, Button, ButtonLink, EmptyState, Pill } from '@/design'
import { AVAILABILITY_LABEL } from '@/features/profile/ProfileMenu'
import { EVENT_TYPES, PLAN_CATEGORIES } from '@/lib/category'
import { eventRange, formatApproxDistance, formatNearby, staleLabel, timeLabel } from '@/lib/format'
import { useClock } from '@/app/hooks'
import { countdownLabel, durationText, startLabel } from '@/lib/planTime'
import { JoinButton, JoinReason } from './JoinButton'
import type { MapItem } from './useMapData'

const card = (selected: boolean) => `flex flex-col gap-2.5 rounded-lg border bg-surface p-3.5 shadow-sm ${selected ? 'border-primary' : 'border-line'}`

/** Vista de lista equivalente al mapa (accesibilidad): mismos elementos, mismos datos y acciones. */
export function MapList({ items, emptyHint, onLocate, selectedId }: { items: MapItem[]; emptyHint: string; onLocate?: (id: string) => void; selectedId?: string | null }) {
  const now = useClock(30_000)
  if (items.length === 0) {
    return <EmptyState icon={<MapPinned aria-hidden="true" size={30} />} title="Nada por aquí" text={emptyHint} />
  }
  const locate = (id: string) => onLocate && <Button variant="secondary" className="h-11 flex-1 rounded-md text-sm" onClick={() => onLocate(id)}>Ver en el mapa</Button>
  return (
    <ul aria-label="Amigos, planes y eventos cerca, en lista" className="flex flex-col gap-2.5">
      {items.map((it) =>
        it.kind === 'person' ? (
          <li key={it.id} className={card(selectedId === it.id)}>
            <div className="flex items-center gap-3">
              <Avatar userId={it.user.id} name={it.user.name} size={44} src={it.user.avatarUrl} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-bold">{it.user.name} · {it.plan ? 'con plan' : 'sin plan'}</span>
                <span className="text-caption text-muted">Amigo cercano · {it.exact ? `ubicación exacta compartida hasta las ${timeLabel(it.exactUntil!)}` : `${formatNearby(it.distanceM)}${staleLabel(it.updatedAt) ? ` · ${staleLabel(it.updatedAt)}` : ''}`}</span>
              </div>
              <Pill tone={it.availability === 'busy' ? 'muted' : 'accent'}>{AVAILABILITY_LABEL[it.availability]}</Pill>
            </div>
            <p className="text-sm font-bold">{it.plan ? `${it.plan.line} · ${it.plan.place.name}` : 'Sin plan por ahora.'}</p>
            <div className="flex gap-2">
              {locate(it.id)}
              <ButtonLink to={`/u/${it.user.id}`} className="h-11 flex-1 rounded-md text-sm">Ver perfil</ButtonLink>
            </div>
          </li>
        ) : it.kind === 'plan' ? (
          <li key={it.id} className={card(selectedId === it.id)}>
            <div className="flex items-center gap-3">
              <Avatar userId={it.user.id} name={it.user.name} size={44} src={it.user.avatarUrl} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-bold">{it.user.name} · {PLAN_CATEGORIES[it.plan.category].label}</span>
                <span className="text-caption text-muted">{it.place.name} · a {formatApproxDistance(it.distanceM)}</span>
              </div>
              <Pill tone="primary">Lugar exacto</Pill>
            </div>
            <p className="text-sm font-bold">{it.plan.line}</p>
            <p className="text-caption font-semibold text-text">{startLabel(it.plan.startsAt, now)} · dura {durationText(it.plan.durationMin)} · {countdownLabel(it.plan, now)}</p>
            <div className="flex gap-2">
              {locate(it.id)}
              {!it.joined && <JoinButton plan={it.plan} className="h-11 flex-1 rounded-md text-sm" />}
            </div>
            <JoinReason plan={it.plan} joined={it.joined} />
          </li>
        ) : (
          <li key={it.id} className={card(selectedId === it.id)}>
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-md bg-accent">{EVENT_TYPES[it.event.type].icon({ size: 22, strokeWidth: 2.2 })}</span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-bold">{it.event.title}</span>
                <span className="text-caption text-muted">{it.event.placeName} · {eventRange(it.event)} · {formatApproxDistance(it.distanceM)}</span>
              </div>
              <Pill tone="muted" className="bg-cat-musica">Evento</Pill>
            </div>
            <p className="text-sm font-bold">{it.event.going} van · cupo {it.event.capacity}</p>
            <div className="flex gap-2">
              {locate(it.id)}
              <ButtonLink to={`/evento/${it.event.id}`} className="h-11 flex-1 rounded-md text-sm">Ver evento</ButtonLink>
            </div>
          </li>
        ),
      )}
    </ul>
  )
}
