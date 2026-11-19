import { Check } from 'lucide-react'
import { Avatar } from '@/design'
import { useApp } from '@/app/store'
import { formatAgo, formatApproxDistance } from '@/lib/format'
import { cellDistanceM } from '@/lib/reach'
import { cn } from '@/lib/cn'

/** Máximo de invitados por plan o evento. */
export const MAX_INVITES = 10

/**
 * Invitar a amigos al crear un plan o evento. Arriba, los que están cerca de ti (con su distancia aproximada y hace cuánto se actualizó); abajo, el resto de tus amigos (sin ubicación). Les llega una invitación a Notificaciones.
 */
export function InvitePicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { state } = useApp()
  // Cerca de ti: solo amigos cercanos (de los dos) que te muestran su ubicación aproximada, con su distancia y cuándo se actualizó.
  const nearby = (state.ghost ? [] : state.presence) // en modo fantasma no ves dónde andan tus cercanos
    .flatMap((pr) => {
      const f = state.friendships[pr.userId]
      const u = state.users[pr.userId]
      if (!u || f?.status !== 'friends' || f.close !== 'mutual' || f.locationPaused || state.blocks.includes(u.id)) return []
      return [{ id: u.id, name: u.name, avatarUrl: u.avatarUrl, dist: cellDistanceM(pr.cell, state.location.center), ago: formatAgo(pr.updatedAt) }]
    })
    .sort((a, b) => a.dist - b.dist)
  const nearIds = new Set(nearby.map((n) => n.id))
  const others = Object.values(state.friendships)
    .filter((f) => f.status === 'friends' && !state.blocks.includes(f.userId) && !nearIds.has(f.userId))
    .map((f) => state.users[f.userId]!)
    .sort((a, b) => a.name.localeCompare(b.name))

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : value.length >= MAX_INVITES ? value : [...value, id])

  const Row = ({ id, name, src, sub }: { id: string; name: string; src?: string; sub: string }) => {
    const on = value.includes(id)
    return (
      <li>
        <button
          type="button" role="checkbox" aria-checked={on} aria-label={`Invitar a ${name}`} onClick={() => toggle(id)}
          className={cn('flex min-h-12 w-full items-center gap-3 rounded-lg border px-2.5 text-left', on ? 'border-primary bg-primary-soft' : 'border-line bg-surface')}
        >
          <Avatar userId={id} name={name} size={34} src={src} />
          <span className="flex min-w-0 flex-1 flex-col"><span className="text-sm font-bold">{name}</span><span className="text-caption text-muted">{sub}</span></span>
          <span aria-hidden="true" className={cn('flex size-6 items-center justify-center rounded-full border-2', on ? 'border-primary bg-primary text-white' : 'border-line-input text-transparent')}><Check size={14} strokeWidth={3} /></span>
        </button>
      </li>
    )
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-meta font-bold">Invitar a amigos (opcional){value.length > 0 ? ` · ${value.length}` : ''}</legend>
      {nearby.length === 0 && others.length === 0 && <p className="text-caption text-muted">Aún no tienes amigos a quienes invitar.</p>}
      {nearby.length > 0 && (
        <>
          <p className="text-caption font-semibold text-muted">Cerca de ti</p>
          <ul aria-label="Amigos cerca de ti" className="flex flex-col gap-1.5">{nearby.map((n) => <Row key={n.id} id={n.id} name={n.name} src={n.avatarUrl} sub={`a ${formatApproxDistance(n.dist)} · ${n.ago}`} />)}</ul>
        </>
      )}
      {others.length > 0 && (
        <>
          <p className="text-caption font-semibold text-muted">Otros amigos</p>
          <ul aria-label="Otros amigos" className="flex flex-col gap-1.5">{others.map((u) => <Row key={u.id} id={u.id} name={u.name} src={u.avatarUrl} sub="Sin ubicación a la vista" />)}</ul>
        </>
      )}
      <p className="text-caption text-muted">Les llega una invitación a Notificaciones y ellos deciden si aceptan.{value.length >= MAX_INVITES ? ` Máximo ${MAX_INVITES}.` : ''}</p>
    </fieldset>
  )
}
