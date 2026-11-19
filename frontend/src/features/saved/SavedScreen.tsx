import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bookmark, Clock, MapPin } from 'lucide-react'
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
  const saved = useSaved()
  const nav = useNavigate()
  const now = useNow()

  return (
    <div className="flex flex-col gap-4 px-[22px] pt-9 pb-8 lg:p-0">
      <header className="flex items-center gap-3">
        <button type="button" aria-label="Volver" onClick={() => nav(-1)} className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface shadow-sm">
          <ArrowLeft aria-hidden="true" size={20} strokeWidth={2.4} />
        </button>
        <div className="flex flex-col gap-0.5">
          <h1 className="text-h1 font-extrabold">Guardados</h1>
          <span className="text-meta text-muted">{saved.count === 0 ? 'Nada guardado todavía' : `${saved.count} para luego`}</span>
        </div>
      </header>

      {saved.count === 0 ? (
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
                  const over = new Date(p.expiresAt).getTime() <= now
                  return (
                    <li key={p.id} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3.5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <Avatar userId={u.id} name={u.name} size={44} />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="text-[15px] font-bold">{u.name} · {cat.label}</span>
                          <span className="text-caption text-muted">{p.place.name} · a {formatApproxDistance(planDistanceM(p, state.location.center))}</span>
                        </div>
                        <Pill tone={over ? 'muted' : 'accent'} className="gap-1"><Clock aria-hidden="true" size={12} />{over ? 'terminó' : formatPlanTime(p, now)}</Pill>
                      </div>
                      <p className="text-sm font-bold">{p.line}</p>
                      <div className="flex gap-2">
                        <Button variant="secondary" className="h-11 flex-1 rounded-md text-sm" aria-label={`Quitar plan de ${u.name}`} onClick={() => swipe('plan', p.id, 'pass')}>Quitar</Button>
                        {!over && <Button className="h-11 flex-1 rounded-md text-sm" aria-label={`Jalo con ${u.name}`} onClick={async () => { const id = await jalo(p.id); if (id) nav(`/match/${id}`) }}>Jalo</Button>}
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
    </div>
  )
}
