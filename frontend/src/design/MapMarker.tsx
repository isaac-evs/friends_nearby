import type { ReactNode } from 'react'
import { Avatar } from './Avatar'
import { cn } from '@/lib/cn'

/**
 * Contenido de los marcadores del mapa. No se posicionan solos: el mapa (MapLibre) los ancla a una
 * coordenada. La ubicación aproximada se dibuja como capa del mapa (ver features/map/MapView.tsx).
 */

/** Alto del cuerpo del pin hasta su centro (para anclar el centro del avatar a la coordenada). */
export const FRIEND_PIN_OFFSET = 25
export const PLAN_PIN_OFFSET = 36
export const EVENT_PIN_OFFSET = 29

/** Punto de disponibilidad de una persona: verde = disponible, rojo = ocupado. Va junto con texto en el nombre accesible. */
function AvailabilityDot({ availability }: { availability: 'available' | 'busy' }) {
  return <span aria-hidden="true" className={cn('absolute right-0 bottom-0.5 size-3.5 rounded-full border-2 border-white', availability === 'busy' ? 'bg-danger' : 'bg-success')} />
}

/**
 * Amigo cercano: SOLO su foto (sin nombre) + un punto de disponibilidad. Si no tiene plan el aro parpadea suave (verde);
 * con movimiento reducido queda fijo. Una ubicación exacta compartida se marca con aro primary. El nombre y el estado van
 * en el nombre accesible, no en pantalla.
 */
export function PersonMarker({
  person, selected, exact, noPlan, availability, src, description, onSelect,
}: {
  person: { id: string; name: string }; selected?: boolean; exact?: boolean; noPlan?: boolean; availability: 'available' | 'busy'; src?: string
  description: string; onSelect: () => void
}) {
  return (
    <button type="button" aria-pressed={selected} onClick={onSelect} className="relative flex min-h-11 min-w-11 items-center justify-center bg-transparent p-0">
      <span className={cn('relative rounded-full border-[3px] shadow-md', noPlan && !exact && 'animate-chill motion-reduce:animate-none bg-cat-musica', selected ? 'border-primary ring-2 ring-ink' : exact ? 'border-primary' : noPlan ? 'border-success' : 'border-white')}>
        <Avatar userId={person.id} name={person.name} size={44} src={src} />
        <AvailabilityDot availability={availability} />
      </span>
      <span className="sr-only">{description}</span>
    </button>
  )
}

/** Plan: pin con el ícono de la actividad, en el lugar exacto. En curso = relleno y borde verde con pulso; próximo = borde normal y su hora. */
export function PlanMarker({
  icon, tileClass, label, live, selected, description, onSelect, people = [],
}: { icon: ReactNode; tileClass: string; label: string; live?: boolean; selected?: boolean; description: string; onSelect: () => void; people?: CornerPerson[] }) {
  return (
    <div className="relative flex flex-col items-center">
      <button type="button" aria-pressed={selected} onClick={onSelect} className="flex min-h-11 min-w-11 flex-col items-center gap-1 bg-transparent p-0">
        <span className={cn('flex size-11 items-center justify-center rounded-[14px] border-[3px] text-ink shadow-md', tileClass, selected ? 'border-primary ring-2 ring-ink' : live ? 'animate-chill motion-reduce:animate-none border-success' : 'border-white')}>
          {icon}
        </span>
        <span className={cn('rounded-full border px-2 py-0.5 text-caption font-bold whitespace-nowrap', live ? 'border-success bg-cat-musica text-ink' : 'border-line bg-surface text-ink')}>{label}</span>
        <span className="sr-only">, {description}</span>
      </button>
      <CornerPeople people={people} tileHalf={22} />
    </div>
  )
}

/** Varios elementos juntos: pila de fotos (personas) o ícono (planes y eventos) con el total. Al tocarlo se abre la lista. */
export function ClusterMarker({
  count, people, icon, label, onSelect,
}: { count: number; people?: { id: string; name: string; src?: string }[]; icon?: ReactNode; label: string; onSelect: () => void }) {
  return (
    <button type="button" aria-label={label} onClick={onSelect} className="relative flex min-h-11 min-w-11 items-center justify-center bg-transparent p-0">
      <span aria-hidden="true" className="flex items-center rounded-full border-[3px] border-white bg-surface py-0.5 pr-2.5 pl-1 shadow-md">
        {people
          ? <span className="flex">{people.slice(0, 3).map((p, i) => <Avatar key={p.id} userId={p.id} name={p.name} size={34} src={p.src} className={i > 0 ? '-ml-3' : undefined} />)}</span>
          : <span className="flex size-[34px] items-center justify-center rounded-full bg-accent text-ink">{icon}</span>}
        <span className="ml-1.5 text-sm font-extrabold">{count}</span>
      </span>
    </button>
  )
}

export interface CornerPerson { id: string; name: string; src?: string; selected?: boolean; description: string; onSelect: () => void }

/**
 * Amigos cercanos que están en un plan o evento EN CURSO: hasta 3 fotos como círculos en la esquina (y "+N" si hay más),
 * en vez de marcadores aparte encimados. Cada uno se toca por separado.
 */
function CornerPeople({ people, tileHalf }: { people: CornerPerson[]; tileHalf: number }) {
  const shown = people.slice(0, 3)
  const more = people.length - shown.length
  if (shown.length === 0) return null
  return (
    // Anclado a la esquina superior derecha del cuadro (no del texto de abajo, que es más ancho).
    <span className="absolute -top-2.5 left-1/2 flex" style={{ transform: `translateX(calc(-100% + ${tileHalf + 10}px))` }}>
      {shown.map((p, i) => (
        <button
          key={p.id} type="button" aria-pressed={p.selected} onClick={p.onSelect}
          className={cn('relative flex size-7 items-center justify-center rounded-full border-2 bg-transparent p-0 shadow-sm after:absolute after:-inset-2 after:content-[\'\']', p.selected ? 'border-primary ring-2 ring-ink' : 'border-white', i > 0 && '-ml-2')}
        >
          <Avatar userId={p.id} name={p.name} size={28} src={p.src} />
          <span className="sr-only">{p.description}</span>
        </button>
      ))}
      {more > 0 && <span aria-hidden="true" className="-ml-2 flex size-7 items-center justify-center rounded-full border-2 border-white bg-surface-sunken text-caption font-bold">+{more}</span>}
    </span>
  )
}

/** Evento. Si amigos cercanos están ahí AHORA (evento en curso) sus fotos van en la esquina del evento. */
export function EventMarker({
  icon, label, selected, description, onSelect, people = [],
}: { icon: ReactNode; label: string; selected?: boolean; description: string; onSelect: () => void; people?: CornerPerson[] }) {
  return (
    <div className="relative flex flex-col items-center">
      <button type="button" aria-pressed={selected} onClick={onSelect} className="flex min-h-11 flex-col items-center gap-1 bg-transparent p-0">
        <span className={cn('flex size-[52px] items-center justify-center rounded-lg border-[3px] bg-accent text-ink shadow-md', selected ? 'border-primary' : 'border-white')}>
          {icon}
        </span>
        <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-caption font-bold whitespace-nowrap">{label}</span>
        <span className="sr-only">, {description}</span>
      </button>
      <CornerPeople people={people} tileHalf={26} />
    </div>
  )
}

/** "Tú": punto primary de 20 px con borde blanco y halo. */
export function MeMarker({ ghost }: { ghost?: boolean }) {
  return (
    // En modo fantasma tu punto se ve gris (apagado): tú sí ves dónde estás, nadie más te ve.
    <div aria-hidden="true" className="relative flex size-[42px] items-center justify-center">
      <span className={cn('absolute inset-0 rounded-full', ghost ? 'bg-muted/20' : 'bg-primary/20')} />
      <span className={cn('relative block size-5 rounded-full border-[3px] border-white shadow-md', ghost ? 'bg-muted' : 'bg-primary')} />
    </div>
  )
}
