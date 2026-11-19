import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Navigation } from 'lucide-react'
import { Button, Field, IconButton, ModalSheet, Pill, Tabs, buttonClass, panelId, tabId, useToast } from '@/design'
import { useActions, useApp } from '@/app/store'
import { useClock } from '@/app/hooks'
import { byRecent } from '@/lib/history'
import { countdownLabel, durationText, startLabel, timeTodayIso } from '@/lib/planTime'
import { cn } from '@/lib/cn'
import { HistoryRow } from '@/features/profile/HistoryRow'
import { directionsHref, useMyPlans, type MyPlan } from './useMyPlans'

type Tab = 'proximos' | 'curso' | 'pasados'
const TABS: { value: Tab; label: string }[] = [{ value: 'proximos', label: 'Próximos' }, { value: 'curso', label: 'En curso' }, { value: 'pasados', label: 'Pasados' }]
const STARTS = [{ l: 'Ahora', after: 0 }, { l: 'En 30 min', after: 30 }, { l: 'En 1 h', after: 60 }, { l: 'Otra hora', after: -1 }]
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
  const [edit, setEdit] = useState<MyPlan | null>(null)
  const [cancel, setCancel] = useState<MyPlan | null>(null)

  const list = tab === 'proximos' ? mine.filter((p) => p.phase === 'upcoming') : tab === 'curso' ? mine.filter((p) => p.phase === 'live') : []
  const past = byRecent(state.history)

  return (
    <div className="flex flex-col gap-4 px-[22px] pt-8 pb-[104px] lg:max-w-[760px] lg:p-0">
      <header className="flex items-center gap-3">
        <IconButton label="Volver" onClick={() => nav(-1)}><ArrowLeft aria-hidden="true" size={20} strokeWidth={2.4} /></IconButton>
        <h1 className="text-h1 font-extrabold">Mis planes</h1>
      </header>

      <Tabs<Tab> base="planes" label="Mis planes" value={tab} onChange={setTab} tabs={TABS} />

      <div role="tabpanel" id={panelId('planes', tab)} aria-labelledby={tabId('planes', tab)} className="flex flex-col gap-3">
        {tab !== 'pasados' && list.length === 0 && (
          <p className="rounded-md border border-dashed border-line-dashed bg-surface px-3 py-3 text-sm text-muted">
            {tab === 'proximos' ? 'No tienes planes próximos.' : 'No tienes nada en curso ahora.'} <Link to="/publicar" className="font-bold text-primary">Publica un plan</Link> o únete a uno desde Explorar.
          </p>
        )}
        {tab !== 'pasados' && list.length > 0 && (
          <ul aria-label={tab === 'proximos' ? 'Planes próximos' : 'Planes en curso'} className="flex flex-col gap-3">
            {list.map((p) => <PlanCard key={p.key} p={p} now={now} onEdit={() => setEdit(p)} onCancel={() => setCancel(p)} />)}
          </ul>
        )}
        {tab === 'pasados' && (past.length === 0
          ? <p className="rounded-md border border-dashed border-line-dashed bg-surface px-3 py-3 text-sm text-muted">Aún no hay planes pasados.</p>
          : (
            <>
              <p className="text-sm font-bold">{past.length} {past.length === 1 ? 'plan' : 'planes'} en tu historial</p>
              <ul aria-label="Planes pasados" className="flex flex-col gap-2">{past.map((h) => <HistoryRow key={h.id} item={h} />)}</ul>
              <p className="text-caption text-muted">Solo tú ves este historial.</p>
            </>
          ))}
      </div>

      <EditTimeSheet plan={edit} onClose={() => setEdit(null)} />
      <CancelSheet plan={cancel} onClose={() => setCancel(null)} />
    </div>
  )
}

function PlanCard({ p, now, onEdit, onCancel }: { p: MyPlan; now: number; onEdit: () => void; onCancel: () => void }) {
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
        {p.role === 'voy' && <Link to={p.href} className={buttonClass('secondary', 'md', false, 'h-11 flex-1 rounded-md px-3 text-sm')}>Ver</Link>}
        {p.role === 'organizador' && p.kind === 'evento' && <Link to={p.href} className={buttonClass('secondary', 'md', false, 'h-11 flex-1 rounded-md px-3 text-sm')}>Ver evento</Link>}
        {p.role === 'organizador' && p.kind === 'plan' && (
          <>
            <Button variant="secondary" className="h-11 flex-1 rounded-md px-3 text-sm" aria-label={`Editar hora de ${p.title}`} onClick={onEdit}>Editar hora</Button>
            <Button variant="ghost" className="h-11 flex-1 rounded-md px-3 text-sm !text-danger" aria-label={`Cancelar plan ${p.title}`} onClick={onCancel}>Cancelar plan</Button>
          </>
        )}
      </div>
    </li>
  )
}

function EditTimeSheet({ plan, onClose }: { plan: MyPlan | null; onClose: () => void }) {
  const { updatePlan } = useActions()
  const toast = useToast()
  const [start, setStart] = useState('Ahora')
  const [time, setTime] = useState('')
  const [dur, setDur] = useState<number | null>(null)
  const [error, setError] = useState<string>()
  if (!plan) return <ModalSheet open={false} title="" onClose={onClose}>{null}</ModalSheet>
  const duration = dur ?? plan.durationMin

  const save = async () => {
    const s = STARTS.find((x) => x.l === start)!
    let startsAt = new Date(Date.now() + Math.max(0, s.after) * 60_000).toISOString()
    if (s.after < 0) {
      const iso = timeTodayIso(time)
      if (!iso) { setError('Elige una hora de hoy que no haya pasado.'); return }
      startsAt = iso
    }
    if (!await updatePlan(plan.id, startsAt, duration)) return
    toast('Plan actualizado')
    onClose()
  }

  return (
    <ModalSheet open title="Editar hora" onClose={onClose}>
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

function CancelSheet({ plan, onClose }: { plan: MyPlan | null; onClose: () => void }) {
  const { removePlan } = useActions()
  const toast = useToast()
  if (!plan) return <ModalSheet open={false} title="" onClose={onClose}>{null}</ModalSheet>
  return (
    <ModalSheet open title="¿Cancelar este plan?" onClose={onClose}>
      <div className="flex flex-col gap-3.5">
        <p className="text-sm leading-normal text-text"><strong>{plan.title}</strong> dejará de verse y quienes se hayan unido ya no lo verán. Como lo organizas tú, no pierdes XP.</p>
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="secondary" onClick={onClose}>Mantener</Button>
          <Button variant="dark" onClick={async () => { if (await removePlan(plan.id)) { toast('Plan cancelado'); onClose() } }}>Cancelar plan</Button>
        </div>
      </div>
    </ModalSheet>
  )
}
