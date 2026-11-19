import { Navigation } from 'lucide-react'
import { ModalSheet, buttonClass } from '@/design'
import { useClock } from '@/app/hooks'
import { PLAN_CATEGORIES } from '@/lib/category'
import { formatApproxDistance } from '@/lib/format'
import { countdownLabel, durationText, startLabel } from '@/lib/planTime'
import { directionsHref } from '@/features/plans/useMyPlans'
import { JoinButton, useJoinBlock } from './JoinButton'
import type { MapPlan } from './useMapData'

/**
 * Detalle de un plan SOBRE el mapa (no te saca de él): hora, duración, lugar exacto, cuántos van y si se puede unir en curso.
 */
export function PlanDetailSheet({ item, open, onClose }: { item: MapPlan; open: boolean; onClose: () => void }) {
  const { plan, user, place, joined } = item
  const now = useClock(30_000)
  const why = useJoinBlock(plan)
  const cat = PLAN_CATEGORIES[plan.category]
  const way = directionsHref({ placeCenter: place.center })
  return (
    <ModalSheet open={open} title={`Plan de ${user.name}`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <h3 className="text-[19px] leading-tight font-extrabold">{plan.line}</h3>
        <ul className="flex flex-col gap-1.5 text-sm">
          <li><strong>{cat.label}</strong> · {user.name}</li>
          <li>{startLabel(plan.startsAt, now)} · dura {durationText(plan.durationMin)}</li>
          <li className="font-bold">{countdownLabel(plan, now)[0]!.toUpperCase() + countdownLabel(plan, now).slice(1)}</li>
          <li>{place.name}{place.address ? ` · ${place.address}` : ''} · a {formatApproxDistance(item.distanceM)}</li>
          <li>{plan.joinedCount} {plan.joinedCount === 1 ? 'ya jaló' : 'ya jalaron'}{plan.capacity ? ` · límite ${plan.capacity} personas` : ''}</li>
          <li>{plan.lateJoin ? 'Se puede unir aunque ya haya empezado.' : 'Cuando empiece, ya no admite más gente.'}</li>
        </ul>
        {why && !joined && <p id="plan-detail-why" role="status" className="text-caption font-semibold text-danger">{why}</p>}
        <div className="grid grid-cols-2 gap-2">
          {way.external
            ? <a href={way.href} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'md', false, 'h-12 rounded-md text-sm')}><Navigation aria-hidden="true" size={16} />Cómo llegar<span className="sr-only"> (abre tu app de mapas en otra pestaña)</span></a>
            : <span />}
          {joined ? <span /> : <JoinButton plan={plan} className="h-12 rounded-md text-sm" describedBy="plan-detail-why" />}
        </div>
      </div>
    </ModalSheet>
  )
}
