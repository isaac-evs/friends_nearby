import { Link } from 'react-router-dom'
import { Hourglass, MapPinCheck } from 'lucide-react'
import { Button, ModalSheet, Notice, useToast } from '@/design'
import { useActions, useApp } from '@/app/store'
import { useNow } from '@/app/hooks'
import { durationLabel, EXACT_DURATIONS, minutesLeft, shareWith } from '@/lib/privacy'
import { timeLabel } from '@/lib/format'

/**
 * Ubicación exacta TEMPORAL con un amigo cercano. Dos sentidos, cada uno lo decide quien comparte:
 *  · Tu ubicación: eliges por cuánto (30 min, 1 h, 2 h); solo esa persona la ve; se apaga sola; puedes cortarla antes.
 *  · La suya: se la pides y ella decide desde sus notificaciones.
 */
export function ExactSheet({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { state } = useApp()
  const { startExact, stopExact, askExact, cancelAskExact, removeClose } = useActions()
  const toast = useToast()
  const tick = useNow(15_000) // re-pinta cada 15 s para que la cuenta regresiva avance
  const now = Math.max(tick, Date.now()) // y nunca usa una hora vieja (no puede salir "61 min" de un tiempo de 60)
  const u = userId ? state.users[userId] : undefined
  if (!userId || !u) return <ModalSheet open={false} title="" onClose={onClose}>{null}</ModalSheet>

  const first = u.name.split(' ')[0]!
  const mine = shareWith(state.exactShares, userId, now)
  const theirs = shareWith(state.exactGrants, userId, now)
  const pending = state.exactPending.includes(userId)

  return (
    <ModalSheet open title={`Ubicación exacta · ${first}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-normal text-text">Solo {first} ve tu punto exacto y solo mientras dure. Se apaga sola y puedes cortarla cuando quieras.</p>

        <section aria-label="Tu ubicación" className="flex flex-col gap-2.5">
          <h3 className="text-meta font-bold">Tu ubicación</h3>
          {mine ? (
            <>
              <p role="status" className="flex items-center gap-2 rounded-md bg-cat-musica px-3 py-2.5 text-sm font-bold text-ink">
                <MapPinCheck aria-hidden="true" size={18} />Compartiendo con {first} hasta las {timeLabel(mine.until)} ({minutesLeft(mine.until, now)} min)
              </p>
              <Button variant="secondary" onClick={async () => { if (!await stopExact(userId)) return; toast(`Dejaste de compartir con ${first}`) }}>Dejar de compartir</Button>
            </>
          ) : state.ghost ? (
            <Notice tone="warning" icon="eye">Estás en modo fantasma. Desactívalo para compartir tu ubicación exacta.</Notice>
          ) : (
            <div role="group" aria-label={`Compartir mi ubicación exacta con ${first} por`} className="grid grid-cols-3 gap-2">
              {EXACT_DURATIONS.map((m) => (
                <Button key={m} variant="secondary" onClick={async () => { if (!await startExact(userId, m)) return; toast(`Compartiendo con ${first} por ${durationLabel(m)}`) }}>{durationLabel(m)}</Button>
              ))}
            </div>
          )}
        </section>

        <section aria-label="Su ubicación" className="flex flex-col gap-2.5">
          <h3 className="text-meta font-bold">Su ubicación</h3>
          {theirs ? (
            <>
              <p role="status" className="flex items-center gap-2 rounded-md bg-cat-musica px-3 py-2.5 text-sm font-bold text-ink">
                <MapPinCheck aria-hidden="true" size={18} />{first} te comparte su ubicación exacta hasta las {timeLabel(theirs.until)}
              </p>
              <Link to="/mapa" className="flex h-12 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">Verla en el mapa</Link>
            </>
          ) : pending ? (
            <>
              <p role="status" className="flex items-center gap-2 rounded-md bg-surface-muted px-3 py-2.5 text-sm font-bold"><Hourglass aria-hidden="true" size={18} />Esperando a que {first} acepte…</p>
              <Button variant="secondary" onClick={() => cancelAskExact(userId)}>Cancelar pedido</Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => askExact(userId)}>Pedirle su ubicación exacta</Button>
          )}
        </section>

        <Button variant="ghost" className="!text-danger" onClick={async () => { if (!await removeClose(userId)) return; onClose(); toast(`${first} ya no es amigo cercano`) }}>Quitar de amigos cercanos</Button>
      </div>
    </ModalSheet>
  )
}
