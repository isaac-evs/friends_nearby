import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bookmark, ChevronDown, Clock, MapPin } from 'lucide-react'
import { Avatar, Button, ButtonLink, EmptyState, Pill } from '@/design'
import { useActions, useApp } from '@/app/store'
import { useNow } from '@/app/hooks'
import { EVENT_TYPES, PLAN_CATEGORIES } from '@/lib/category'
import { eventRange, formatApproxDistance, formatPlanTime } from '@/lib/format'
import { eventDistanceM, planDistanceM } from '@/lib/reach'
import { cn } from '@/lib/cn'
import { useSaved } from './useSaved'

/** Guardados: planes y eventos que dejaste "para luego". Jalar, abrir o quitar desde aquí. */
export function SavedScreen() {
  const { state } = useApp()
  const { swipe, jalo } = useActions()
  const now = useNow()
  const saved = useSaved(now)
  const nav = useNavigate()
  const [showPast, setShowPast] = useState(false)
  const none = saved.count === 0 && saved.pastCount === 0
  const pastRows = [
    ...saved.pastPlans.map((p) => ({ key: `plan:${p.id}`, title: p.line, sub: `${state.users[p.authorId]?.name ?? 'Alguien'} · ${p.place.name}`, remove: () => swipe('plan', p.id, 'pass') })),
    ...saved.pastEvents.map((e) => ({ key: `event:${e.id}`, title: e.title, sub: `${eventRange(e)} · ${e.placeName}`, remove: () => swipe('event', e.id, 'pass') })),
  ]

  return (
    <div className="flex flex-col gap-4 px-[22px] pt-9 pb-8 lg:p-0">
      <header className="flex items-center gap-3">
        <button type="button" aria-label="Volver" onClick={() => nav(-1)} className="flex size-11 shrink-0 items-center justify-center rounded-full">
          <ArrowLeft aria-hidden="true" size={20} strokeWidth={2.4} />
        </button>
        <div className="flex flex-col gap-0.5">
          <h1 className="text-h1 font-extrabold">Guardados</h1>
          <span className="text-meta text-muted">{none ? 'Nada guardado todavía' : saved.count === 0 ? 'Nada próximo' : `${saved.count} para luego`}</span>
        </div>
      </header>

      {none ? (
        <EmptyState
          className="min-h-[360px]" icon={<Bookmark aria-hidden="true" size={30} />}
          title="Aquí caen tus “luego”"
          text="Toca el marcador en una card (o desliza hacia arriba) para dejar un plan o evento para después."
        >
          <ButtonLink to="/" variant="dark" pill>Ir a explorar</ButtonLink>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
          {saved.plans.length > 0 && (
            <section aria-label="Planes de amigos guardados" className="flex flex-col gap-2.5">
              <h2 className="text-meta font-bold">Planes de amigos ({saved.plans.length})</h2>
              <ul className="flex flex-col gap-2.5">
                {saved.plans.map((p) => {
                  const u = state.users[p.authorId]!
                  const cat = PLAN_CATEGORIES[p.category]
                  return (
                    <li key={p.id} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3.5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <Avatar userId={u.id} name={u.name} size={44} src={u.avatarUrl} />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="text-[15px] font-bold">{u.name} · {cat.label}</span>
                          <span className="text-caption text-muted">{p.place.name} · a {formatApproxDistance(planDistanceM(p, state.location.center))}</span>
                        </div>
                        <Pill tone="accent" className="gap-1"><Clock aria-hidden="true" size={12} />{formatPlanTime(p, now)}</Pill>
                      </div>
                      <p className="text-sm font-bold">{p.line}</p>
                      <div className="flex gap-2">
                        <Button variant="secondary" className="h-11 flex-1 rounded-md text-sm" aria-label={`Quitar plan de ${u.name}`} onClick={() => swipe('plan', p.id, 'pass')}>Quitar</Button>
                        <Button className="h-11 flex-1 rounded-md text-sm" aria-label={`Jalo con ${u.name}`} onClick={async () => { const id = await jalo(p.id); if (id) nav(`/plan/${id}`) }}>Jalo</Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {saved.events.length > 0 && (
            <section aria-label="Eventos guardados" className="flex flex-col gap-2.5">
              <h2 className="text-meta font-bold">Eventos ({saved.events.length})</h2>
              <ul className="flex flex-col gap-2.5">
                {saved.events.map((e) => {
                  const t = EVENT_TYPES[e.type]
                  return (
                    <li key={e.id} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3.5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <span aria-hidden="true" className={cn('flex size-11 shrink-0 items-center justify-center rounded-md', t.tile)}>{t.icon({ size: 22, strokeWidth: 2 })}</span>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="text-[15px] font-bold">{e.title}</span>
                          <span className="text-caption text-muted">{eventRange(e)}</span>
                        </div>
                      </div>
                      <p className="flex items-center gap-1.5 text-meta text-text"><MapPin aria-hidden="true" size={14} className="text-muted" />{e.placeName} · {formatApproxDistance(eventDistanceM(e, state.location.center))} · {e.going} van · cupo {e.capacity}</p>
                      <div className="flex gap-2">
                        <Button variant="secondary" className="h-11 flex-1 rounded-md text-sm" aria-label={`Quitar ${e.title}`} onClick={() => swipe('event', e.id, 'pass')}>Quitar</Button>
                        <ButtonLink to={`/evento/${e.id}`} className="h-11 flex-1 rounded-md text-sm">Ver evento</ButtonLink>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </div>
      )}

      {saved.count === 0 && !none && (
        <EmptyState className="min-h-[200px]" icon={<Bookmark aria-hidden="true" size={30} />} title="Nada próximo" text="Lo que guardaste ya pasó. Guarda más planes con el marcador para verlos aquí.">
          <ButtonLink to="/" variant="dark" pill>Ir a explorar</ButtonLink>
        </EmptyState>
      )}

      {saved.pastCount > 0 && (
        <section aria-labelledby="past-h" className="flex flex-col gap-2.5">
          <h2 id="past-h" className="text-meta font-bold">
            <button type="button" aria-expanded={showPast} aria-controls="past-list" onClick={() => setShowPast((v) => !v)} className="flex min-h-11 w-full items-center justify-between gap-2 text-left">
              <span>Ya pasaron ({saved.pastCount})</span>
              <ChevronDown aria-hidden="true" size={18} className={cn('transition-transform', showPast && 'rotate-180')} />
            </button>
          </h2>
          {showPast && (
            <div id="past-list" className="flex flex-col gap-2.5">
              <ul className="flex flex-col gap-2">
                {pastRows.map((r) => (
                  <li key={r.key} className="flex items-center gap-3 rounded-lg border border-line bg-surface-sunken p-3">
                    <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-sm font-bold">{r.title}</span><span className="truncate text-caption text-muted">{r.sub}</span></span>
                    <Button variant="secondary" className="h-11 rounded-md px-3 text-sm" aria-label={`Quitar ${r.title}`} onClick={r.remove}>Quitar</Button>
                  </li>
                ))}
              </ul>
              <Button variant="secondary" className="h-11 self-start rounded-md px-4 text-sm" onClick={async () => { for (const r of pastRows) await r.remove() }}>Quitar todos</Button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
