import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, Check, X } from 'lucide-react'

const round = 'flex items-center justify-center rounded-full border border-line bg-surface shadow-md'

/** Acciones: Paso (60, danger), Luego (48, primary) y Jalo / Me uno (72, primary + shadow-primary). */
export function SwipeActions({
  onPass, onLater, onJoin, joinTo, joinLabel, extra,
}: { onPass: () => void; onLater: () => void; onJoin?: () => void; joinTo?: string; joinLabel: string; extra?: ReactNode }) {
  const joinCls = 'flex size-[72px] items-center justify-center rounded-full bg-primary text-white shadow-primary'
  return (
    <div className="flex items-center justify-center gap-5">
      <button type="button" aria-label="Paso" onClick={onPass} className={`${round} size-[60px] text-danger`}>
        <X aria-hidden="true" size={24} strokeWidth={2.6} />
      </button>
      <button type="button" aria-label="Guardar para luego" onClick={onLater} className={`${round} size-12 text-primary`}>
        <Bookmark aria-hidden="true" size={20} strokeWidth={2.2} />
      </button>
      {joinTo ? (
        <Link to={joinTo} aria-label={joinLabel} className={joinCls}>
          <Check aria-hidden="true" size={30} strokeWidth={2.8} />
        </Link>
      ) : (
        <button type="button" aria-label={joinLabel} onClick={onJoin} className={joinCls}>
          <Check aria-hidden="true" size={30} strokeWidth={2.8} />
        </button>
      )}
      {extra}
    </div>
  )
}
