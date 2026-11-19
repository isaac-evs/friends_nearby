import { avatarColor, initials } from '@/lib/avatar'
import { cn } from '@/lib/cn'

const SIZES = { 28: 'size-7 text-[10px]', 34: 'size-[34px] text-caption', 40: 'size-10 text-meta', 44: 'size-11 text-sm', 48: 'size-12 text-base', 58: 'size-[58px] text-xl font-extrabold', 90: 'size-[90px] text-[26px] font-extrabold', 96: 'size-24 text-[32px] font-extrabold', 144: 'size-36 text-[46px] font-extrabold' } as const
export type AvatarSize = keyof typeof SIZES

interface AvatarProps {
  userId: string
  name: string
  size?: AvatarSize
  online?: boolean
  paused?: boolean
  /** Fondo primary con texto blanco (tú). */
  self?: boolean
  /** Texto en lugar de las iniciales (p. ej. "TÚ"). */
  text?: string
  /** Foto de perfil. Decorativa: el nombre ya va como texto al lado. */
  src?: string
  className?: string
}

/** Círculo con iniciales sobre un color de avatar estable por usuario. */
export function Avatar({ userId, name, size = 44, online, paused, self, text, src, className }: AvatarProps) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        aria-hidden="true"
        className={cn(
          'flex items-center justify-center rounded-full border font-bold text-ink',
          SIZES[size],
          self && 'bg-primary text-white',
          paused && 'border-dashed border-line-dashed bg-surface-sunken',
          src && 'overflow-hidden border-transparent',
        )}
        style={self || paused ? undefined : { background: avatarColor(userId) }}
      >
        {src ? <img src={src} alt="" referrerPolicy="no-referrer" className="block size-full rounded-full object-cover" /> : (text ?? initials(name))}
      </span>
      {online && (
        <span aria-hidden="true" className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-surface bg-success" />
      )}
    </span>
  )
}

/**
 * Pila de avatares. Con `max` muestra solo los primeros y un círculo "+N" con cuánta gente más hay
 * (decorativa: los nombres van siempre como texto al lado).
 */
export function AvatarStack({ people, size = 34, max }: { people: { id: string; name: string; avatarUrl?: string }[]; size?: AvatarSize; max?: number }) {
  const shown = max ? people.slice(0, max) : people
  const more = people.length - shown.length
  const dim = { 34: 'size-[34px] text-caption', 40: 'size-10 text-meta', 44: 'size-11 text-sm' } as Record<number, string>
  return (
    <span aria-hidden="true" className="flex">
      {shown.map((p, i) => (
        <Avatar key={p.id} userId={p.id} name={p.name} size={size} src={p.avatarUrl} className={i > 0 ? '-ml-2' : undefined} />
      ))}
      {more > 0 && (
        <span data-testid="avatar-more" className={cn('-ml-2 flex shrink-0 items-center justify-center rounded-full border bg-surface-sunken font-bold text-ink', dim[size] ?? 'size-[34px] text-caption')}>+{more}</span>
      )}
    </span>
  )
}
