import { BottomSheet, IconButton } from '@/design'
import { Avatar } from '@/design'
import { X } from 'lucide-react'
import { EVENT_TYPES, PLAN_CATEGORIES } from '@/lib/category'
import { eventRange, formatApproxDistance, formatNearby } from '@/lib/format'
import type { MapItem } from './useMapData'

/** Panel pequeño de un grupo de marcadores: lo que hay ahí, para elegir uno. Al acercar el zoom los grupos se separan solos. */
export function ClusterSheet({ items, onPick, onClose, className }: { items: MapItem[]; onPick: (id: string) => void; onClose: () => void; className?: string }) {
  return (
    <BottomSheet label="Grupo en el mapa" className={className}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-extrabold">{items.length} aquí</h2>
        <IconButton label="Cerrar grupo" onClick={onClose}><X aria-hidden="true" size={18} /></IconButton>
      </div>
      <ul aria-label="En este grupo" className="flex max-h-[220px] flex-col gap-1.5 overflow-y-auto">
        {items.map((it) => (
          <li key={it.id}>
            <button type="button" onClick={() => onPick(it.id)} className="flex min-h-12 w-full items-center gap-3 rounded-md border border-line bg-surface px-2.5 text-left">
              {it.kind === 'person' ? <Avatar userId={it.user.id} name={it.user.name} size={34} src={it.user.avatarUrl} />
                : it.kind === 'plan' ? <span aria-hidden="true" className={`flex size-[34px] items-center justify-center rounded-md ${PLAN_CATEGORIES[it.plan.category].tile}`}>{PLAN_CATEGORIES[it.plan.category].icon({ size: 18, strokeWidth: 2.2 })}</span>
                  : <span aria-hidden="true" className="flex size-[34px] items-center justify-center rounded-md bg-accent">{EVENT_TYPES[it.event.type].icon({ size: 18, strokeWidth: 2.2 })}</span>}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-bold">{it.kind === 'person' ? it.user.name : it.kind === 'plan' ? it.plan.line : it.event.title}</span>
                <span className="truncate text-caption text-muted">
                  {it.kind === 'person' ? `Amigo cercano · ${formatNearby(it.distanceM)}` : it.kind === 'plan' ? `${it.user.name} · ${it.place.name} · a ${formatApproxDistance(it.distanceM)}` : `${it.event.placeName} · ${eventRange(it.event)}`}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  )
}
