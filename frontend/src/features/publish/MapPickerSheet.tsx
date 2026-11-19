import { lazy, Suspense, useEffect, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, MapPinOff } from 'lucide-react'
import { Button, ModalSheet } from '@/design'
import { distanceM, offsetMeters, type LatLng } from '@/lib/geo'
import { useApp } from '@/app/store'
import { formatApproxDistance } from '@/lib/format'

const PlaceMap = lazy(() => import('./PlaceMap'))
const hasWebGL = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false } }
const STEP_M = 100

/**
 * Elegir en el mapa dónde será el plan. Toca el mapa o arrastra el pin; los botones de flecha lo mueven 100 m (alternativa
 * para teclado y lector de pantalla). El punto es un lugar PÚBLICO que tú escoges, no tu ubicación.
 * [PROPUESTA] El servidor debe validar que el punto sea un lugar público real (proveedor de lugares + moderación).
 */
export function MapPickerSheet({ open, initial, onClose, onPick }: { open: boolean; initial?: LatLng; onClose: () => void; onPick: (p: LatLng) => void }) {
  const origin = useApp().state.location.center
  const [pt, setPt] = useState<LatLng>(initial ?? origin)
  useEffect(() => { if (open) setPt(initial ?? origin) }, [open, initial, origin])
  const move = (e: number, n: number) => setPt((p) => { const q = offsetMeters(p, e, n); return { lat: Number(q.lat.toFixed(5)), lng: Number(q.lng.toFixed(5)) } })
  const arrow = 'flex size-11 items-center justify-center rounded-md border border-line bg-surface'

  return (
    <ModalSheet open={open} title="Elegir en el mapa" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-sm leading-normal text-text">Toca el mapa o arrastra el pin hasta donde será el plan. Elige un lugar público (parque, café, plaza, cancha).</p>
        <div className="relative h-[300px] overflow-hidden rounded-lg border border-line bg-map-land">
          {hasWebGL() ? (
            <Suspense fallback={<div aria-busy="true" className="absolute inset-0 animate-pulse bg-map-land" />}>
              <PlaceMap point={pt} onPick={setPt} />
            </Suspense>
          ) : (
            <p role="status" className="flex h-full items-center justify-center gap-2 p-4 text-center text-sm font-bold"><MapPinOff aria-hidden="true" size={20} />Tu navegador no puede dibujar el mapa. Usa los botones para mover el pin.</p>
          )}
        </div>
        <div role="group" aria-label="Mover el pin" className="flex items-center justify-center gap-2">
          <button type="button" aria-label={`Mover ${STEP_M} m al oeste`} onClick={() => move(-STEP_M, 0)} className={arrow}><ArrowLeft aria-hidden="true" size={18} /></button>
          <button type="button" aria-label={`Mover ${STEP_M} m al norte`} onClick={() => move(0, STEP_M)} className={arrow}><ArrowUp aria-hidden="true" size={18} /></button>
          <button type="button" aria-label={`Mover ${STEP_M} m al sur`} onClick={() => move(0, -STEP_M)} className={arrow}><ArrowDown aria-hidden="true" size={18} /></button>
          <button type="button" aria-label={`Mover ${STEP_M} m al este`} onClick={() => move(STEP_M, 0)} className={arrow}><ArrowRight aria-hidden="true" size={18} /></button>
        </div>
        <p role="status" className="rounded-md bg-surface-muted px-3 py-2 text-sm font-bold">Lugar elegido · a {formatApproxDistance(distanceM(origin, pt))} de ti</p>
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => { onPick(pt); onClose() }}>Usar este lugar</Button>
        </div>
      </div>
    </ModalSheet>
  )
}
