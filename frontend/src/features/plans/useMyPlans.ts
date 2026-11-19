import { useMemo } from 'react'
import type { LatLng } from '@/lib/geo'
import { ME_ID } from '@/api/me'
import { useApp } from '@/app/store'
import { EVENT_TYPES, PLAN_CATEGORIES } from '@/lib/category'
import { planPhase, spanMin, type PlanPhase } from '@/lib/planTime'

export interface MyPlan {
  key: string
  kind: 'plan' | 'evento'
  id: string
  title: string
  categoryLabel: string
  startsAt: string
  durationMin: number
  placeName: string
  /** Punto exacto del lugar. */
  placeCenter?: LatLng
  role: 'organizador' | 'voy'
  /** Solicitud enviada a un evento con aprobación manual. */
  pending?: boolean
  href: string
  photoUrl?: string
  phase: PlanPhase
}

/**
 * Tus planes y eventos: los que organizas y a los que vas (con "Jalo" o "Me uno"). Ordenados por hora de inicio.
 * Los pasados salen del historial; aquí solo hay lo que aún no termina más lo que terminó hace poco no se repite.
 */
export function useMyPlans(now: number): MyPlan[] {
  const { state } = useApp()
  return useMemo(() => {
    const out: MyPlan[] = []
    for (const p of state.plans) {
      if (p.authorId === ME_ID) {
        out.push({
          key: `plan:${p.id}`, kind: 'plan', id: p.id, title: p.line, categoryLabel: PLAN_CATEGORIES[p.category].label, startsAt: p.startsAt, durationMin: p.durationMin,
          placeName: p.place.name, placeCenter: p.place.center, role: 'organizador', href: '/planes', photoUrl: p.photoUrl, phase: planPhase(p, now),
        })
      }
    }
    for (const m of state.matches) {
      const p = state.plans.find((x) => x.id === m.planId)
      if (!p || p.authorId === ME_ID) continue
      out.push({
        key: `match:${m.id}`, kind: 'plan', id: p.id, title: p.line, categoryLabel: PLAN_CATEGORIES[p.category].label, startsAt: p.startsAt, durationMin: p.durationMin,
        placeName: p.place.name, placeCenter: p.place.center, role: 'voy', href: `/match/${m.id}`, photoUrl: p.photoUrl, phase: planPhase(p, now),
      })
    }
    for (const e of state.events) {
      const att = state.attendances.find((a) => a.eventId === e.id)
      const mine = e.organizerId === ME_ID
      if (!mine && !att) continue
      out.push({
        key: `event:${e.id}`, kind: 'evento', id: e.id, title: e.title, categoryLabel: EVENT_TYPES[e.type].label, startsAt: e.startsAt, durationMin: spanMin(e),
        placeName: e.placeName, placeCenter: e.center, role: mine ? 'organizador' : 'voy', pending: !mine && att?.status === 'pending', href: `/evento/${e.id}`, photoUrl: e.photoUrl,
        phase: planPhase(e, now),
      })
    }
    return out.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  }, [state.plans, state.matches, state.events, state.attendances, now])
}

/** Enlace para llegar: app de mapas con el lugar exacto; si no hay punto, el mapa de la app. */
export const directionsHref = (p: Pick<MyPlan, 'placeCenter'>): { href: string; external: boolean } =>
  p.placeCenter ? { href: `https://www.google.com/maps/dir/?api=1&destination=${p.placeCenter.lat},${p.placeCenter.lng}`, external: true } : { href: '/mapa', external: false }
