import type { Event, Plan, User } from '@/api/schemas'
import type { CardProps } from '@/design'
import { EVENT_TYPES, PLAN_CATEGORIES } from '@/lib/category'
import { dayNumber, eventWhen, formatApproxDistance, formatPlanTime, monthShortUpper } from '@/lib/format'

/** Mapea el dominio a las props presentacionales de la card. */
export function planToCard(plan: Plan, author: User, now = Date.now()): CardProps {
  const cat = PLAN_CATEGORIES[plan.category]
  return {
    variant: 'friend',
    tileClass: cat.tile,
    icon: cat.icon({ size: 72, strokeWidth: 1.5 }),
    category: cat.label,
    time: formatPlanTime(plan, now),
    xp: '+20 XP',
    person: { id: author.id, name: author.name },
    where: `a ${formatApproxDistance(plan.zone.approxDistanceM)} · ${plan.zone.name}`,
    title: plan.line,
    chip: plan.joinedCount === 1 ? '1 ya jaló' : `${plan.joinedCount} ya jalaron`,
  }
}

export function eventToCard(ev: Event): CardProps {
  const t = EVENT_TYPES[ev.type]
  return {
    variant: 'event',
    tileClass: t.tile,
    icon: t.icon({ size: 72, strokeWidth: 1.5 }),
    category: ev.subtype ? `${t.group} · ${ev.subtype}` : t.group,
    xp: `+${ev.xp} XP`,
    organizer: ev.organizer.name,
    verified: ev.organizer.verified,
    title: ev.title,
    day: dayNumber(ev.startsAt),
    month: monthShortUpper(ev.startsAt),
    when: eventWhen(ev.startsAt),
    place: `${ev.placeName} · ${formatApproxDistance(ev.approxDistanceM)}`,
    going: ev.going,
    capacity: ev.capacity,
  }
}
