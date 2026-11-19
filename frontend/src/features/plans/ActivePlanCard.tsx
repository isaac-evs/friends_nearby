import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, MapPin, Navigation, Radio, Users } from 'lucide-react'
import { Button, ModalSheet, buttonClass, useToast } from '@/design'
import { useActions, useApp } from '@/app/store'
import { useClock } from '@/app/hooks'
import { countdownLabel, minutesUntilStart, startLabel } from '@/lib/planTime'
import { cn } from '@/lib/cn'
import { directionsHref, useMyPlans, type MyPlan } from './useMyPlans'

/** El plan o evento que tienes ahora: el que está en curso o, si no, el próximo que empieza en menos de 24 h. */
export function useActivePlan(): MyPlan | undefined {
  const now = useClock(30_000)
  const mine = useMyPlans(now)
  return mine.find((p) => p.phase === 'live') ?? mine.find((p) => p.phase === 'upcoming' && minutesUntilStart(p, now) <= 24 * 60)
}

/**
 * "Mi plan activo" (panel derecho de desktop). Es un botón: al tocarlo se abre tu plan. Si lo organizas puedes empezarlo,
 * ver cuánta gente va y cómo llegar; si solo vas, ver el match. [PROPUESTA] La lista de quién ya va y a cuántos metros
 * está cada quien (10 min antes) llega con el lobby del plan (`GET /plans/{id}/lobby`).
 */
export function ActivePlanCard({ className }: { className?: string }) {
  const now = useClock(30_000)
  const p = useActivePlan()
  const [open, setOpen] = useState(false)
  if (!p) return null
  const live = p.phase === 'live'
  return (
    <>
      <button
        type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}
        className={cn('flex min-h-[76px] w-full items-center gap-3 rounded-xl border border-line p-3.5 text-left shadow-sm', live ? 'bg-cat-musica' : 'bg-surface', className)}
      >
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-md border border-line bg-surface"><Radio size={20} /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-caption font-bold tracking-[0.8px] text-muted uppercase">Mi plan activo</span>
          <span className="truncate text-[15px] font-extrabold">{p.title}</span>
          <span className="text-caption font-semibold text-text">{countdownLabel(p, now)} · {p.placeName}</span>
        </span>
        <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-muted" />
      </button>
      <ActivePlanSheet plan={p} open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function ActivePlanSheet({ plan: p, open, onClose }: { plan: MyPlan; open: boolean; onClose: () => void }) {
  const { state } = useApp()
  const { updatePlan } = useActions()
  const toast = useToast()
  const now = useClock(30_000)
  const full = p.kind === 'plan' ? state.plans.find((x) => x.id === p.id) : undefined
  const owner = p.role === 'organizador'
  const way = directionsHref(p)
  const going = full ? full.joinedCount : undefined
  return (
    <ModalSheet open={open} title="Mi plan activo" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <h3 className="text-[19px] leading-tight font-extrabold">{p.title}</h3>
        <ul className="flex flex-col gap-1.5 text-sm">
          <li><strong>{p.categoryLabel}</strong> · {owner ? 'Tú organizas' : 'Vas'}</li>
          <li>{startLabel(p.startsAt, now)} · <strong>{countdownLabel(p, now)}</strong></li>
          <li className="flex items-center gap-1.5"><MapPin aria-hidden="true" size={14} className="text-muted" />{p.placeName}</li>
          {going !== undefined && (
            <li className="flex items-center gap-1.5"><Users aria-hidden="true" size={14} className="text-muted" />
              {going === 0 ? 'Todavía no se une nadie' : `${going} ${going === 1 ? 'persona ya jaló' : 'personas ya jalaron'}`}{full?.capacity ? ` · límite ${full.capacity}` : ''}
            </li>
          )}
        </ul>
        <div className="grid grid-cols-2 gap-2">
          {way.external
            ? <a href={way.href} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'md', false, 'h-12 rounded-md text-sm')}><Navigation aria-hidden="true" size={16} />Cómo llegar<span className="sr-only"> (abre tu app de mapas en otra pestaña)</span></a>
            : <Link to={way.href} onClick={onClose} className={buttonClass('secondary', 'md', false, 'h-12 rounded-md text-sm')}><Navigation aria-hidden="true" size={16} />Cómo llegar</Link>}
          <Link to={p.href} onClick={onClose} className={buttonClass('secondary', 'md', false, 'h-12 rounded-md text-sm')}>Ver detalle</Link>
        </div>
        {owner && p.kind === 'plan' && p.phase === 'upcoming' && full && (
          <Button full onClick={async () => { if (!await updatePlan(full.id, new Date().toISOString(), full.durationMin)) return; toast('Tu plan empezó'); onClose() }}>Empezar ahora</Button>
        )}
        <Link to="/planes" onClick={onClose} className="flex min-h-11 items-center text-sm font-bold text-primary">Ir a Mis planes</Link>
      </div>
    </ModalSheet>
  )
}
