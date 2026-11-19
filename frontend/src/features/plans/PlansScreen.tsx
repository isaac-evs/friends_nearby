import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Bell, Bookmark, Navigation } from 'lucide-react'
import { AvatarStack, Button, Field, IconButton, ModalSheet, Pill, Tabs, buttonClass, panelId, tabId, useToast } from '@/design'
import { useActions, useApp } from '@/app/store'
import { useClock } from '@/app/hooks'
import { byRecent } from '@/lib/history'
import { cancelPenalty } from '@/lib/lifecycle'
import { minutesLabel, formatLastVisit } from '@/lib/format'
import { PLAN_CATEGORIES } from '@/lib/category'
import type { CanceledPlan, Plan, PlanCategory } from '@/api/schemas'
import { countdownLabel, minutesUntilStart, dayStr, dayTimeIso, durationText, startLabel, timeTodayIso } from '@/lib/planTime'
import { cn } from '@/lib/cn'
import { HistoryRow } from '@/features/profile/HistoryRow'
import { useSaved } from '@/features/saved/useSaved'
import { useNotifications } from '@/features/notifications/useNotifications'
import { directionsHref, useMyPlans, type MyPlan } from './useMyPlans'

type Tab = 'proximos' | 'curso' | 'pasados' | 'cancelados'
const TABS: { value: Tab; label: string }[] = [{ value: 'proximos', label: 'Próximos' }, { value: 'curso', label: 'En curso' }, { value: 'pasados', label: 'Pasados' }, { value: 'cancelados', label: 'Cancelados' }]
const STARTS = [{ l: 'Ahora', after: 0 }, { l: 'En 30 min', after: 30 }, { l: 'En 1 h', after: 60 }, { l: 'Otra hora', after: -1 }, { l: 'Otro día', after: -2 }]
const DURATIONS = [30, 60, 120, 180]

/** `/planes`: tus planes y eventos — próximos, en curso y pasados (historial). Puedes cambiar la hora o cancelar los que organizas. */
export function PlansScreen() {
  const { state } = useApp()
  const nav = useNavigate()
  const now = useClock(30_000)
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.find((t) => t.value === params.get('tab'))?.value ?? 'proximos'
  const setTab = (t: Tab) => setParams(t === 'proximos' ? {} : { tab: t }, { replace: true })
  const mine = useMyPlans(now)
  const saved = useSaved(now)
  const notif = useNotifications()
  const [edit, setEdit] = useState<MyPlan | null>(null)
  const [cancel, setCancel] = useState<MyPlan | null>(null)
  const [finish, setFinish] = useState<MyPlan | null>(null)

  const canceled = [...state.canceledPlans].sort((a, b) => b.at.localeCompare(a.at))
  const list = tab === 'proximos' ? mine.filter((p) => p.phase === 'upcoming') : tab === 'curso' ? mine.filter((p) => p.phase === 'live') : []
  // Pasados: los planes que ya terminaron (también los que terminaste con "Terminar ahora") + el resto del historial (eventos).
  const pastPlans = [...state.pastPlans].sort((a, b) => b.expiresAt.localeCompare(a.expiresAt))
  const pastIds = new Set(pastPlans.map((p) => `plan:${p.id}`))
  const past = byRecent(state.history.filter((h) => !pastIds.has(h.id)))
  const pastCount = pastPlans.length + past.length

  return (
    <div className="flex flex-col gap-4 px-[22px] pt-8 pb-[104px] lg:max-w-[760px] lg:p-0">
      <header className="flex items-center gap-3">
        <IconButton label="Volver" onClick={() => nav(-1)}><ArrowLeft aria-hidden="true" size={20} strokeWidth={2.4} /></IconButton>
        <h1 className="flex-1 text-h1 font-extrabold">Mis planes</h1>
        {/* Esquina derecha: Guardados y notificaciones, a un toque desde aquí. */}
        <Link to="/guardados" aria-label={saved.count ? `Guardados (${saved.count})` : 'Guardados'} className="relative flex size-11 items-center justify-center rounded-full text-ink">
          <Bookmark aria-hidden="true" size={20} />
          {saved.count > 0 && <span aria-hidden="true" className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-caption font-bold text-white">{saved.count}</span>}
        </Link>
        <Link to="/notificaciones" className="relative flex size-11 items-center justify-center rounded-full text-ink">
          <Bell aria-hidden="true" size={20} />
          <span className="sr-only">Notificaciones</span>
          {notif.total > 0 && <span className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-accent px-1 text-caption font-bold text-ink">{notif.total > 99 ? '99+' : notif.total}</span>}
        </Link>
      </header>

      <Tabs<Tab> base="planes" label="Mis planes" value={tab} onChange={setTab} tabs={TABS.map((t) => (t.value === 'curso' ? { ...t, live: mine.some((p) => p.phase === 'live') } : t))} />

      <div role="tabpanel" id={panelId('planes', tab)} aria-labelledby={tabId('planes', tab)} className="flex flex-col gap-3">
        {tab !== 'pasados' && tab !== 'cancelados' && list.length === 0 && (
          <p className="rounded-md border border-dashed border-line-dashed bg-surface px-3 py-3 text-sm text-muted">
            {tab === 'proximos' ? 'No tienes planes próximos.' : 'No tienes nada en curso ahora.'} <Link to="/publicar" className="font-bold text-primary">Publica un plan</Link> o únete a uno desde Explorar.
          </p>
        )}
        {tab !== 'pasados' && tab !== 'cancelados' && list.length > 0 && (
          <ul aria-label={tab === 'proximos' ? 'Planes próximos' : 'Planes en curso'} className="flex flex-col gap-3">
            {list.map((p) => <PlanCard key={p.key} p={p} now={now} onEdit={() => setEdit(p)} onCancel={() => setCancel(p)} onFinish={() => setFinish(p)} />)}
          </ul>
        )}
        {tab === 'pasados' && (pastCount === 0
          ? <p className="rounded-md border border-dashed border-line-dashed bg-surface px-3 py-3 text-sm text-muted">Aún no hay planes pasados.</p>
          : (
            <>
              <p className="text-sm font-bold">{pastCount} {pastCount === 1 ? 'plan' : 'planes'} en tu historial</p>
              <ul aria-label="Planes pasados" className="flex flex-col gap-2">
                {pastPlans.map((p) => <PastPlanRow key={p.id} plan={p} />)}
                {past.map((h) => <HistoryRow key={h.id} item={h} />)}
              </ul>
              <p className="text-caption text-muted">Solo tú ves este historial. Los planes se guardan 30 días con su chat.</p>
            </>
          ))}
        {tab === 'cancelados' && (canceled.length === 0
          ? <p className="rounded-md border border-dashed border-line-dashed bg-surface px-3 py-3 text-sm text-muted">No tienes planes cancelados en los últimos 30 días.</p>
          : (
            <>
              <p className="text-sm font-bold">{canceled.length} {canceled.length === 1 ? 'plan cancelado' : 'planes cancelados'}</p>
              <ul aria-label="Planes cancelados" className="flex flex-col gap-2">{canceled.map((c) => <CanceledRow key={`${c.id}-${c.kind}`} c={c} />)}</ul>
              <p className="text-caption text-muted">Se guardan 30 días. Solo ves los que organizabas o a los que ibas.</p>
            </>
          ))}
      </div>

      <EditTimeSheet plan={edit} onClose={() => setEdit(null)} />
      <CancelSheet plan={cancel} onClose={() => setCancel(null)} />
      <FinishSheet plan={finish} onClose={() => setFinish(null)} />
    </div>
  )
}

/** Un plan que ya terminó (haya llegado o no gente): cuándo fue, quiénes iban y acceso al plan y su chat. */
function PastPlanRow({ plan }: { plan: Plan }) {
  const { state } = useApp()
  const people = (plan.roster ?? []).map((r) => state.users[r.userId]).filter((u): u is NonNullable<typeof u> => !!u)
  const arrived = (plan.roster ?? []).filter((r) => r.arrivedAt).length
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-bold">{plan.line}</span>
        <span className="text-caption text-muted">Plan · {PLAN_CATEGORIES[plan.category].label} · {plan.place.name} · {formatLastVisit(plan.expiresAt)}</span>
      </div>
      <div className="flex items-center gap-2">
        {people.length > 0 && <AvatarStack people={people} size={34} max={5} />}
        <span className="text-caption font-semibold text-text">{arrived} de {(plan.roster ?? []).length} llegaron</span>
      </div>
      <Link to={`/plan/${plan.id}`} className="inline-flex min-h-11 items-center self-start text-sm font-bold text-primary">Ver plan y chat</Link>
    </li>
  )
}

/** Una fila del historial de cancelados: qué pasó, cuándo y con cuánta anticipación, y lo que costó en XP. */
function CanceledRow({ c }: { c: CanceledPlan }) {
  const { state } = useApp()
  const who = state.users[c.organizerId]?.name ?? 'Quien organizaba'
  const ahead = Math.round((new Date(c.startsAt).getTime() - new Date(c.at).getTime()) / 60_000)
  const when = ahead > 0 ? `${minutesLabel(ahead)} antes de que empezara` : 'con el plan ya empezado'
  const ev = state.xpEvents.find((x) => x.id === `cancel:${c.id}` || x.id === `leave:${c.id}`)
  const why = c.kind === 'left' ? `Cancelaste tu lugar, ${when}` : c.byMe ? `Cancelaste tu plan, ${when}` : `${who} canceló el plan`
  return (
    <li className="flex flex-col gap-1 rounded-lg border border-line bg-surface-muted p-3">
      <span className="text-[15px] font-bold">{c.line}</span>
      <span className="text-caption text-muted">{PLAN_CATEGORIES[c.category as PlanCategory]?.label ?? c.category} · {c.placeName} · {formatLastVisit(c.at)}</span>
      <span className="text-sm font-semibold text-text">{why}</span>
      {c.kind === 'left' || c.byMe
        ? <span className={cn('text-caption font-bold', ev && ev.amount < 0 ? 'text-danger' : 'text-success-text')}>{ev && ev.amount < 0 ? `${ev.amount} XP` : 'Sin penalización'}</span>
        : <span className="text-caption font-bold text-success-text">Sin penalización para ti</span>}
    </li>
  )
}

function PlanCard({ p, now, onEdit, onCancel, onFinish }: { p: MyPlan; now: number; onEdit: () => void; onCancel: () => void; onFinish: () => void }) {
  const { state } = useApp()
  const encounters = state.matches.filter(m => m.planId === p.id)
  const way = directionsHref(p)
  const live = p.phase === 'live'
  return (
    <li className="flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-3.5 shadow-sm">
      {p.photoUrl && <img src={p.photoUrl} alt={`Foto de ${p.title}`} className="h-28 w-full rounded-md border border-line object-cover" />}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[15px] font-extrabold">{p.title}</span>
          <span className="text-caption text-muted">{p.kind === 'evento' ? 'Evento' : 'Plan'} · {p.categoryLabel} · {p.placeName}</span>
        </div>
        <Pill tone="muted" className={cn('flex-none', p.role === 'organizador' ? 'bg-primary-soft' : '')}>{p.pending ? 'Pendiente' : p.role === 'organizador' ? 'Tú organizas' : 'Vas'}</Pill>
      </div>
      <p className="text-sm font-bold">{startLabel(p.startsAt, now)} · dura {durationText(p.durationMin)}</p>
      <p className={cn('text-caption font-bold', live ? 'text-accent-text' : 'text-text')}>{countdownLabel(p, now)[0]!.toUpperCase() + countdownLabel(p, now).slice(1)}</p>
      {p.role === 'organizador' && encounters.map(m => <Link key={m.id} to={`/match/${m.id}`} className="flex min-h-11 items-center text-sm font-bold text-primary">Ver encuentro con {state.users[m.friendId]?.name}</Link>)}
      <div className="flex flex-wrap gap-2">
        {way.external
          ? <a href={way.href} target="_blank" rel="noopener noreferrer" className={buttonClass('primary', 'md', false, 'h-11 flex-1 rounded-md px-3 text-sm')}><Navigation aria-hidden="true" size={16} />Cómo llegar<span className="sr-only"> (abre tu app de mapas en otra pestaña)</span></a>
          : <Link to={way.href} className={buttonClass('primary', 'md', false, 'h-11 flex-1 rounded-md px-3 text-sm')}><Navigation aria-hidden="true" size={16} />Cómo llegar</Link>}
        {p.kind === 'plan' && p.role === 'organizador' && <Link to={p.href} className={buttonClass('secondary', 'md', false, 'h-11 flex-1 rounded-md px-3 text-sm')}>Ver plan</Link>}
        {p.role === 'voy' && <Link to={p.href} className={buttonClass('secondary', 'md', false, 'h-11 flex-1 rounded-md px-3 text-sm')}>Ver</Link>}
        {p.role === 'organizador' && p.kind === 'evento' && <Link to={p.href} className={buttonClass('secondary', 'md', false, 'h-11 flex-1 rounded-md px-3 text-sm')}>Ver evento</Link>}
        {p.role === 'organizador' && p.kind === 'plan' && (
          <>
            {live
              ? <Button variant="secondary" className="h-11 flex-1 rounded-md px-3 text-sm" aria-label={`Terminar ahora ${p.title}`} onClick={onFinish}>Terminar ahora</Button>
              : <Button variant="secondary" className="h-11 flex-1 rounded-md px-3 text-sm" aria-label={`Editar fecha y hora de ${p.title}`} onClick={onEdit}>Editar fecha y hora</Button>}
            <Button variant="ghost" className="h-11 flex-1 rounded-md px-3 text-sm !text-danger" aria-label={`Cancelar plan ${p.title}`} onClick={onCancel}>Cancelar plan</Button>
          </>
        )}
      </div>
    </li>
  )
}

export function EditTimeSheet({ plan, onClose }: { plan: MyPlan | null; onClose: () => void }) {
  const { updatePlan } = useActions()
  const toast = useToast()
  const [start, setStart] = useState('Ahora')
  const [time, setTime] = useState('')
  const [date, setDate] = useState(() => dayStr(1))
  const [dur, setDur] = useState<number | null>(null)
  const [error, setError] = useState<string>()
  if (!plan) return <ModalSheet open={false} title="" onClose={onClose}>{null}</ModalSheet>
  const duration = dur ?? plan.durationMin

  const save = async () => {
    const s = STARTS.find((x) => x.l === start)!
    let startsAt = new Date(Date.now() + Math.max(0, s.after) * 60_000).toISOString()
    if (s.after === -2) {
      const iso = dayTimeIso(date, time)
      if (!iso) { setError('Elige un día y una hora que no hayan pasado.'); return }
      startsAt = iso
    } else if (s.after < 0) {
      const iso = timeTodayIso(time)
      if (!iso) { setError('Elige una hora de hoy que no haya pasado.'); return }
      startsAt = iso
    }
    if (!await updatePlan(plan.id, startsAt, duration)) return
    toast('Plan actualizado')
    onClose()
  }

  return (
    <ModalSheet open title="Editar fecha y hora" onClose={onClose}>
      <div className="flex flex-col gap-3.5">
        <p className="text-sm text-text">{plan.title}</p>
        <fieldset>
          <legend className="mb-2 text-meta font-bold">Nueva hora de inicio</legend>
          <div className="grid grid-cols-2 gap-2">
            {STARTS.map((x) => (
              <button key={x.l} type="button" aria-pressed={start === x.l} onClick={() => { setStart(x.l); setError(undefined) }}
                className={cn('h-11 rounded-[12px] border text-[13px] font-bold', start === x.l ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink')}>{x.l}</button>
            ))}
          </div>
          {start === 'Otro día' && (
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              <Field label="Día" type="date" value={date} min={dayStr(0)} max={dayStr(365)} onChange={(e) => { setDate(e.target.value); setError(undefined) }} />
              <Field label="Hora de inicio" type="time" value={time} onChange={(e) => { setTime(e.target.value); setError(undefined) }} error={error} />
            </div>
          )}
          {start === 'Otra hora' && <Field className="mt-2" label="Hora de inicio (hoy)" type="time" value={time} onChange={(e) => { setTime(e.target.value); setError(undefined) }} error={error} />}
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-meta font-bold">Duración</legend>
          <div className="grid grid-cols-4 gap-2">
            {DURATIONS.map((m) => (
              <button key={m} type="button" aria-pressed={duration === m} onClick={() => setDur(m)}
                className={cn('h-11 rounded-[12px] border text-[13px] font-bold', duration === m ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink')}>{durationText(m)}</button>
            ))}
          </div>
        </fieldset>
        <Button onClick={save}>Guardar cambios</Button>
      </div>
    </ModalSheet>
  )
}

export function CancelSheet({ plan, onClose }: { plan: MyPlan | null; onClose: () => void }) {
  const { removePlan } = useActions()
  const toast = useToast()
  if (!plan) return <ModalSheet open={false} title="" onClose={onClose}>{null}</ModalSheet>
  return (
    <ModalSheet open title="¿Cancelar este plan?" onClose={onClose}>
      <div className="flex flex-col gap-3.5">
        <p className="text-sm leading-normal text-text"><strong>{plan.title}</strong> dejará de verse y quienes se hayan unido ya no lo verán.</p>
        <PenaltyLine plan={plan} />
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="secondary" onClick={onClose}>Mantener</Button>
          <Button variant="dark" onClick={async () => { if (await removePlan(plan.id)) { toast('Plan cancelado'); onClose() } }}>Cancelar plan</Button>
        </div>
      </div>
    </ModalSheet>
  )
}

export function FinishSheet({ plan, onClose }: { plan: MyPlan | null; onClose: () => void }) {
  const { endPlan } = useActions()
  const toast = useToast()
  if (!plan) return <ModalSheet open={false} title="" onClose={onClose}>{null}</ModalSheet>
  return (
    <ModalSheet open title="¿Terminar este plan?" onClose={onClose}>
      <div className="flex flex-col gap-3.5">
        <p className="text-sm leading-normal text-text"><strong>{plan.title}</strong> se marca como terminado ahora. Queda en tu historial y ya nadie más se puede unir.</p>
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="secondary" onClick={onClose}>Seguir</Button>
          <Button variant="dark" onClick={async () => { if (await endPlan(plan.id)) { toast('Plan terminado'); onClose() } }}>Terminar ahora</Button>
        </div>
      </div>
    </ModalSheet>
  )
}

/** "Perderás 25 XP" antes de confirmar: nada de castigos sorpresa. Solo pierde quien organiza si ya había gente confirmada. */
function PenaltyLine({ plan }: { plan: MyPlan }) {
  const { state } = useApp()
  const p = state.plans.find((x) => x.id === plan.id)
  if (!p || p.joinedCount === 0) return <p className="text-caption font-semibold text-muted">Nadie se había unido, así que no pierdes XP.</p>
  const { xp, miss } = cancelPenalty(minutesUntilStart(p))
  return <p role="status" className="text-sm font-bold text-danger">Perderás {xp} XP{miss ? ' y cuenta para tu confiabilidad' : ''}. Quienes se unieron no pierden nada.</p>
}
