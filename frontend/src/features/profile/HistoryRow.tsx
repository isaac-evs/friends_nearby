import { AvatarStack } from '@/design'
import { useApp } from '@/app/store'
import { attendeesLabel } from '@/lib/history'
import { formatLastVisit } from '@/lib/format'
import type { PlanHistoryItem } from '@/api/schemas'

/** Un plan o evento al que fuiste y quién fue (solo nombre y avatar; quien bloqueaste no aparece). */
export function HistoryRow({ item }: { item: PlanHistoryItem }) {
  const { state } = useApp()
  const people = item.attendeeIds.filter((id) => !state.blocks.includes(id)).map((id) => state.users[id]).filter((u): u is NonNullable<typeof u> => !!u)
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-bold">{item.title}</span>
        <span className="text-caption text-muted">{item.kind === 'evento' ? 'Evento' : 'Plan'} · {item.categoryLabel} · {item.placeName} · {formatLastVisit(item.at)}</span>
      </div>
      <div className="flex items-center gap-2">
        {people.length > 0 && <AvatarStack people={people} size={34} max={5} />}
        <span className="text-caption font-semibold text-text">{attendeesLabel(people.map((u) => u.name))}</span>
      </div>
    </li>
  )
}
