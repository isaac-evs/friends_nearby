import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, BottomSheet, Button, ButtonLink, Pill, useToast } from '@/design'
import { useApp } from '@/app/store'
import { useClock } from '@/app/hooks'
import { countdownLabel, durationText, startLabel } from '@/lib/planTime'
import { JoinButton, useJoinBlock } from './JoinButton'
import { PlanDetailSheet } from './PlanDetailSheet'
import { EVENT_TYPES, PLAN_CATEGORIES } from '@/lib/category'
import { eventRange, formatApproxDistance, formatNearby, staleLabel, timeLabel } from '@/lib/format'
import { AVAILABILITY_LABEL } from '@/features/profile/ProfileMenu'
import { InviteButton } from './InviteButton'
import type { MapEventItem, MapItem, MapPerson, MapPlan } from './useMapData'

/** Hoja del seleccionado: amigo cercano, plan o evento. */
export function SelectedSheet({ item, className }: { item: MapItem; className?: string }) {
  // Cada tipo en su componente: los hooks no pueden depender de qué elemento está seleccionado.
  if (item.kind === 'person') return <PersonSheet item={item} className={className} />
  if (item.kind === 'plan') return <PlanSheet item={item} className={className} />
  return <EventSheet item={item} className={className} />
}

function EventSheet({ item, className }: { item: MapEventItem; className?: string }) {
  const e = item.event
  const t = EVENT_TYPES[e.type]
  return (
    <BottomSheet label="Seleccionado en el mapa" className={className}>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-md border border-line bg-accent">{t.icon({ size: 26, strokeWidth: 2.2 })}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="truncate text-base font-extrabold">{e.title}</span>
          <span className="text-meta text-muted">{e.placeName} · a {formatApproxDistance(item.distanceM)}</span>
        </div>
        <Pill tone="surface" className="bg-cat-musica">Evento</Pill>
      </div>
      <h2 className="text-[19px] leading-tight font-extrabold">{eventRange(e)}</h2>
      <p className="text-meta font-semibold text-text">{e.going} van · cupo {e.capacity}</p>
      <div className="grid grid-cols-2 gap-2">
        <ButtonLink to={`/evento/${e.id}`} variant="secondary" className="h-[46px] rounded-md text-sm">Ver evento</ButtonLink>
        <ButtonLink to={`/evento/${e.id}`} className="h-[46px] rounded-md text-sm">Me uno</ButtonLink>
      </div>
    </BottomSheet>
  )
}

/**
 * Amigo cercano: foto, nombre, "Amigo cercano", cercanía en rangos ("a menos de 500 m"), hace cuánto se actualizó (si pasó
 * un rato) y su disponibilidad. Si tiene un plan en curso se puede ver o unirse; si no hace nada, se le puede invitar a un plan.
 */
function PersonSheet({ item, className }: { item: MapPerson; className?: string }) {
  const { user, exact, exactUntil, plan, availability } = item
  const stale = staleLabel(item.updatedAt)
  return (
    <BottomSheet label="Seleccionado en el mapa" className={className}>
      <div className="flex items-center gap-3">
        <Avatar userId={user.id} name={user.name} size={48} src={user.avatarUrl} />
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-base font-extrabold">{user.name}</span>
          <span className="text-meta text-muted">Amigo cercano · {formatNearby(item.distanceM)}</span>
          {stale && <span className="text-caption text-muted">{stale}</span>}
        </div>
        <Pill tone={availability === 'busy' ? 'muted' : 'accent'}>{AVAILABILITY_LABEL[availability]}</Pill>
      </div>
      {exact && <p className="text-caption font-semibold text-text">Ubicación exacta compartida hasta las {timeLabel(exactUntil!)}</p>}
      {plan ? <PersonPlan item={item} plan={plan} /> : <PersonIdle item={item} />}
      {!exact && (
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="size-3.5 shrink-0 rounded-full border-2 border-dashed border-primary bg-approx-fill" />
          <span className="text-caption font-medium text-muted">Círculo = ubicación aproximada. La exacta solo si tu amigo cercano la comparte.</span>
        </div>
      )}
    </BottomSheet>
  )
}

function PersonIdle({ item }: { item: MapPerson }) {
  const { user, availability } = item
  const free = availability === 'available'
  return (
    <>
      <h2 className="text-[19px] leading-tight font-extrabold">{free ? 'Sin plan por ahora' : 'Sin plan, ocupado'}</h2>
      <div className="grid grid-cols-2 gap-2">
        <ButtonLink to={`/u/${user.id}`} variant="secondary" className="h-[46px] rounded-md text-sm">Ver perfil</ButtonLink>
        <InviteButton userId={user.id} name={user.name} className="h-[46px] rounded-md text-sm" />
      </div>
    </>
  )
}

function PersonPlan({ item, plan }: { item: MapPerson; plan: NonNullable<MapPerson['plan']> }) {
  const { state } = useApp()
  const now = useClock(30_000)
  const [detail, setDetail] = useState(false)
  const why = useJoinBlock(plan)
  const joined = state.matches.some((m) => m.planId === plan.id)
  const planItem: MapPlan = { kind: 'plan', id: plan.id, plan, user: item.user, place: plan.place, distanceM: item.distanceM, joined }
  return (
    <>
      <h2 className="text-[19px] leading-tight font-extrabold">{plan.line}</h2>
      <p className="text-meta font-semibold text-text">{startLabel(plan.startsAt, now)} · {countdownLabel(plan, now)} · {plan.place.name}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" className="h-[46px] rounded-md text-sm" onClick={() => setDetail(true)}>Ver plan</Button>
        {joined ? <ButtonLink to={`/match/match-${plan.id}`} className="h-[46px] rounded-md text-sm">Ya jalaste</ButtonLink> : <JoinButton plan={plan} className="h-[46px] rounded-md text-sm" describedBy="sheet-why" />}
      </div>
      {why && !joined && <p id="sheet-why" role="status" className="text-caption font-semibold text-danger">{why}</p>}
      <PlanDetailSheet item={planItem} open={detail} onClose={() => setDetail(false)} />
    </>
  )
}

function PlanSheet({ item, className }: { item: MapPlan; className?: string }) {
  const toast = useToast()
  const now = useClock(30_000)
  const [detail, setDetail] = useState(false)
  const { plan, user, joined, place } = item
  const why = useJoinBlock(plan)
  const cat = PLAN_CATEGORIES[plan.category]
  return (
    <BottomSheet label="Seleccionado en el mapa" className={className}>
      <div className="flex items-center gap-3">
        <Avatar userId={user.id} name={user.name} size={48} src={user.avatarUrl} />
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-base font-extrabold">{user.name} · {cat.label}</span>
          <span className="text-meta text-muted">{place.name} · a {formatApproxDistance(item.distanceM)}</span>
        </div>
        <Pill tone="primary">Lugar exacto</Pill>
      </div>
      <h2 className="text-[21px] leading-tight font-extrabold">{plan.line}</h2>
      <p className="text-meta font-semibold text-text">{startLabel(plan.startsAt, now)} · dura {durationText(plan.durationMin)} · {countdownLabel(plan, now)}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" className="h-[46px] rounded-md text-sm" onClick={() => setDetail(true)}>Ver plan</Button>
        {joined ? (
          <Button className="h-[46px] rounded-md text-sm" onClick={() => toast(`Indicaciones a ${plan.place.name} (mock)`)}>Cómo llegar</Button>
        ) : (
          <JoinButton plan={plan} className="h-[46px] rounded-md text-sm" describedBy="sheet-why" />
        )}
      </div>
      {why && !joined && <p id="sheet-why" role="status" className="text-caption font-semibold text-danger">{why}</p>}
      <Link to={`/u/${user.id}`} className="flex min-h-11 items-center self-start text-sm font-bold text-primary">Ver perfil de {user.name}</Link>
      <PlanDetailSheet item={item} open={detail} onClose={() => setDetail(false)} />
    </BottomSheet>
  )
}
