import { useNavigate } from 'react-router-dom'
import { Avatar, BottomSheet, Button, ButtonLink, Pill, useToast } from '@/design'
import { EVENT_TYPES, PLAN_CATEGORIES } from '@/lib/category'
import { formatAgo, formatApproxDistance, eventWhenShort } from '@/lib/format'
import { useActions } from '@/app/store'
import type { MapItem } from './useMapData'

/** Bottom sheet del seleccionado: persona o evento con dos acciones y la aclaración de privacidad. */
export function SelectedSheet({ item, className }: { item: MapItem; className?: string }) {
  const { jalo } = useActions()
  const nav = useNavigate()
  const toast = useToast()

  if (item.kind === 'event') {
    const e = item.event
    const t = EVENT_TYPES[e.type]
    return (
      <BottomSheet label="Seleccionado en el mapa" className={className}>
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-md border border-line bg-accent">{t.icon({ size: 26, strokeWidth: 2.2 })}</span>
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="truncate text-base font-extrabold">{e.title}</span>
            <span className="text-meta text-muted">{e.placeName} · {eventWhenShort(e.startsAt)}</span>
          </div>
          <Pill tone="surface" className="bg-cat-musica">Público</Pill>
        </div>
        <h2 className="text-[21px] leading-tight font-extrabold">{e.going} van · cupo {e.capacity}</h2>
        <div className="grid grid-cols-2 gap-2">
          <ButtonLink to={`/evento/${e.id}`} variant="secondary" className="h-[46px] rounded-md text-sm">Ver evento</ButtonLink>
          <ButtonLink to={`/evento/${e.id}`} className="h-[46px] rounded-md text-sm">Me uno</ButtonLink>
        </div>
      </BottomSheet>
    )
  }

  const { plan, user, exact } = item
  const cat = PLAN_CATEGORIES[plan.category]
  const where = exact ? plan.meetPoint : `a ${formatApproxDistance(plan.zone.approxDistanceM)} · ${plan.zone.name}`
  const ago = exact ? 'en vivo' : formatAgo(plan.zoneUpdatedAt)
  return (
    <BottomSheet label="Seleccionado en el mapa" className={className}>
      <div className="flex items-center gap-3">
        <Avatar userId={user.id} name={user.name} size={48} />
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-base font-extrabold">{user.name} · {cat.label}</span>
          <span className="text-meta text-muted">{where} · {ago}</span>
        </div>
        <Pill tone={exact ? 'primary' : 'muted'}>{exact ? 'Exacta' : 'Aprox.'}</Pill>
      </div>
      <h2 className="text-[21px] leading-tight font-extrabold">{plan.line}</h2>
      <div className="grid grid-cols-2 gap-2">
        <ButtonLink to="/" variant="secondary" className="h-[46px] rounded-md text-sm">Ver plan</ButtonLink>
        {exact ? (
          <Button className="h-[46px] rounded-md text-sm" onClick={() => toast(`Indicaciones a ${plan.meetPoint} (mock)`)}>Cómo llegar</Button>
        ) : (
          <Button className="h-[46px] rounded-md text-sm" onClick={() => { const id = jalo(plan.id); if (id) nav(`/match/${id}`) }}>Jalo</Button>
        )}
      </div>
      {/* El círculo solo existe para amigos con zona aproximada: no aplica a eventos ni a un match exacto. */}
      {!exact && <ZoneNote />}
    </BottomSheet>
  )
}

function ZoneNote() {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className="size-3.5 shrink-0 rounded-full border-2 border-dashed border-primary bg-zone-fill" />
      <span className="text-caption font-medium text-muted">Círculo = zona aproximada. Exacta solo con match.</span>
    </div>
  )
}
