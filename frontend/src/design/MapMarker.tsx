import type { ReactNode } from 'react'
import { Avatar } from './Avatar'
import { cn } from '@/lib/cn'

/**
 * Contenido de los marcadores del mapa. No se posicionan solos: el mapa (MapLibre) los ancla a una
 * coordenada. La zona aproximada se dibuja como capa del mapa (ver features/map/MapView.tsx).
 */

/** Alto del cuerpo del pin hasta su centro (para anclar el centro del avatar a la coordenada). */
export const FRIEND_PIN_OFFSET = 25
export const EVENT_PIN_OFFSET = 29

export function FriendMarker({
  person, label, exact, selected, description, onSelect,
}: {
  person: { id: string; name: string }; label: string; exact?: boolean; selected?: boolean
  /** Texto solo para lectores de pantalla; el nombre accesible nace del texto visible (WCAG 2.5.3). */
  description: string; onSelect: () => void
}) {
  return (
    <button type="button" aria-pressed={selected} onClick={onSelect} className="relative flex min-h-11 min-w-11 flex-col items-center gap-1 bg-transparent p-0">
      <span className={cn('rounded-full border-[3px] shadow-md', selected ? 'border-primary' : 'border-white')}>
        <Avatar userId={person.id} name={person.name} size={44} />
      </span>
      <span className={cn('rounded-full border border-line px-2 py-0.5 text-caption font-bold whitespace-nowrap', exact ? 'bg-primary text-white' : 'bg-surface text-ink')}>
        {label}{exact ? ' · match' : ''}
      </span>
      <span className="sr-only">, {description}</span>
    </button>
  )
}

export function EventMarker({
  icon, label, selected, description, onSelect,
}: { icon: ReactNode; label: string; selected?: boolean; description: string; onSelect: () => void }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onSelect} className="flex min-h-11 flex-col items-center gap-1 bg-transparent p-0">
      <span className={cn('flex size-[52px] items-center justify-center rounded-lg border-[3px] bg-accent text-ink shadow-md', selected ? 'border-primary' : 'border-white')}>
        {icon}
      </span>
      <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-caption font-bold whitespace-nowrap">{label}</span>
      <span className="sr-only">, {description}</span>
    </button>
  )
}

/** "Tú": punto primary de 20 px con borde blanco y halo. */
export function MeMarker() {
  return (
    <div aria-hidden="true" className="relative flex size-[42px] items-center justify-center">
      <span className="absolute inset-0 rounded-full bg-primary/20" />
      <span className="relative block size-5 rounded-full border-[3px] border-white bg-primary shadow-md" />
    </div>
  )
}
