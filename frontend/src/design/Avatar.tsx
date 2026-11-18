import { avatarColor, initials } from '@/lib/avatar'
import { cn } from '@/lib/cn'

const SIZES = { 34: 'size-[34px] text-caption', 40: 'size-10 text-meta', 44: 'size-11 text-sm', 48: 'size-12 text-base', 58: 'size-[58px] text-xl font-extrabold', 90: 'size-[90px] text-[26px] font-extrabold', 96: 'size-24 text-[32px] font-extrabold' } as const
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
  className?: string
}

/** Círculo con iniciales sobre un color de avatar estable por usuario. */
export function Avatar({ userId, name, size = 44, online, paused, self, text, className }: AvatarProps) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        aria-hidden="true"
        className={cn(
          'flex items-center justify-center rounded-full border font-bold text-ink',
          SIZES[size],
          self && 'bg-primary text-white',
          paused && 'border-dashed border-line-dashed bg-surface-sunken',
        )}
        style={self || paused ? undefined : { background: avatarColor(userId) }}
      >
        {text ?? initials(name)}
      </span>
      {online && (
        <span aria-hidden="true" className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-surface bg-success" />
      )}
    </span>
  )
}

export function AvatarStack({ people, size = 34 }: { people: { id: string; name: string }[]; size?: AvatarSize }) {
  return (
    <span aria-hidden="true" className="flex">
      {people.map((p, i) => (
        <Avatar key={p.id} userId={p.id} name={p.name} size={size} className={i > 0 ? '-ml-2' : undefined} />
      ))}
    </span>
  )
}
