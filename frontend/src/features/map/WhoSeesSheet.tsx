import { Link } from 'react-router-dom'
import { Avatar, ModalSheet } from '@/design'
import { useApp } from '@/app/store'
import { useNow } from '@/app/hooks'
import { locationViewers, shareWith } from '@/lib/privacy'
import { timeLabel } from '@/lib/format'

/** "Quién te ve": tus amigos cercanos que ven tu ubicación aproximada (y a quién le compartes la exacta, hasta cuándo). */
export function WhoSeesSheet({ open, onClose, manage = true }: { open: boolean; onClose: () => void; manage?: boolean }) {
  const { state } = useApp()
  const now = useNow()
  const viewers = locationViewers(state).map((id) => state.users[id]!).sort((x, y) => x.name.localeCompare(y.name))
  return (
    <ModalSheet open={open} title="Quién te ve" onClose={onClose}>
      <div className="flex flex-col gap-3">
        {viewers.length === 0 ? (
          <p role="status" className="rounded-md bg-surface-muted px-3 py-2.5 text-sm font-bold">Nadie ve tu ubicación ahora.</p>
        ) : (
          <>
            <p className="text-sm text-text">Te ven {viewers.length} {viewers.length === 1 ? 'amigo cercano' : 'amigos cercanos'}. Ven tu ubicación aproximada, no tu punto exacto.</p>
            <ul aria-label="Quién te ve" className="flex flex-col gap-2">
              {viewers.map((u) => {
                const mine = shareWith(state.exactShares, u.id, now)
                return (
                  <li key={u.id} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-2.5">
                    <Avatar userId={u.id} name={u.name} size={40} src={u.avatarUrl} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[15px] font-bold">{u.name}</span>
                      <span className="text-caption text-muted">{mine ? `Ubicación exacta hasta las ${timeLabel(mine.until)}` : 'Ubicación aproximada'}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
        {manage && <Link to="/perfil" onClick={onClose} className="flex min-h-11 items-center text-sm font-bold text-primary">Administrar desde tu perfil</Link>}
      </div>
    </ModalSheet>
  )
}
