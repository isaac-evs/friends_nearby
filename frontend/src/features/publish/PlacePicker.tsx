import { useEffect, useId, useState } from 'react'
import { Check, MapPin } from 'lucide-react'
import { Button, Field } from '@/design'
import { MapPickerSheet } from './MapPickerSheet'
import type { PlanPlace } from '@/api/schemas'
import { api } from '@/api/client'
import { useApp } from '@/app/store'
import { formatApproxDistance } from '@/lib/format'
import { distanceM } from '@/lib/geo'

/** Lo que eligió la persona. El lugar es OBLIGATORIO: nombre + punto exacto (del buscador o marcado en el mapa). */
export interface PlaceValue { name: string; center?: PlanPlace['center']; address?: string; placeId?: string }

/**
 * ¿Dónde es? Escribes y aparecen lugares (buscador); si no está, "No lo encuentro": escribes el nombre y marcas el
 * pin en el mapa. Ese punto es el lugar EXACTO del plan para todos (no es tu ubicación). El buscador sale de
 * `api.places` (hoy de ejemplo; preparado para Amazon Location).
 */
export function PlacePicker({
  label, value, onChange, placeholder, hint, error,
}: { label: string; value: PlaceValue; onChange: (v: PlaceValue) => void; placeholder?: string; hint?: string; error?: string }) {
  const { state } = useApp()
  const [mapOpen, setMapOpen] = useState(false)
  const [results, setResults] = useState<PlanPlace[]>([])
  const [searched, setSearched] = useState(false)
  const listId = useId()
  const query = value.name.trim()
  // Solo se busca mientras no haya un lugar elegido del buscador con ese mismo nombre.
  const chosen = !!value.placeId

  useEffect(() => {
    if (chosen || query.length < 2) { setResults([]); setSearched(false); return }
    let live = true
    const t = setTimeout(() => { api.places.autocomplete(query, state.location.center).then((r) => { if (live) { setResults(r); setSearched(true) } }) }, 200)
    return () => { live = false; clearTimeout(t) }
  }, [query, chosen, state.location.center])

  const pick = (p: PlanPlace) => { onChange({ name: p.name, address: p.address, placeId: p.placeId, center: p.center }); setResults([]) }

  return (
    <div className="flex flex-col gap-2">
      <Field
        label={label} icon={<MapPin aria-hidden="true" size={18} />} placeholder={placeholder} value={value.name}
        onChange={(e) => onChange({ name: e.target.value, center: value.center && !chosen ? value.center : undefined })}
        hint={hint} error={error} autoComplete="off" aria-controls={results.length ? listId : undefined}
      />
      {results.length > 0 && (
        <ul id={listId} aria-label="Lugares encontrados" className="flex flex-col gap-1.5">
          {results.map((p) => (
            <li key={p.placeId}>
              <button type="button" onClick={() => pick(p)} className="flex min-h-12 w-full flex-col justify-center rounded-lg border border-line bg-surface px-3 py-1.5 text-left">
                <span className="text-sm font-bold">{p.name}</span>
                <span className="text-caption text-muted">{p.address} · a {formatApproxDistance(distanceM(state.location.center, p.center))}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {searched && results.length === 0 && !chosen && <p role="status" className="text-caption text-muted">No lo encontramos. Marca el lugar en el mapa con el nombre que escribiste.</p>}
      <Button variant="secondary" className="self-start !h-11 rounded-md px-3.5 text-sm" icon={<MapPin aria-hidden="true" size={16} />} onClick={() => setMapOpen(true)}>
        {chosen ? 'Ajustar pin en el mapa' : value.center ? 'Cambiar en el mapa' : results.length || !searched ? 'Elegir en el mapa' : 'No lo encuentro · marcar en el mapa'}
      </Button>
      <MapPickerSheet open={mapOpen} initial={value.center} onClose={() => setMapOpen(false)} onPick={(center) => onChange({ name: value.name, center })} />
      {value.center && (
        <p role="status" className="flex items-center gap-2 rounded-md bg-cat-musica px-3 py-2 text-caption font-bold text-ink">
          <Check aria-hidden="true" size={16} strokeWidth={3} />
          Lugar exacto marcado en el mapa · a {formatApproxDistance(distanceM(state.location.center, value.center))}
        </p>
      )}
    </div>
  )
}
