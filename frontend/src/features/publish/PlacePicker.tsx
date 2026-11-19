import { useState } from 'react'
import { Check, MapPin } from 'lucide-react'
import { Button, Field } from '@/design'
import { MapPickerSheet } from './MapPickerSheet'
import type { PlanPlace } from '@/api/schemas'
import { useApp } from '@/app/store'
import { formatApproxDistance } from '@/lib/format'
import { distanceM } from '@/lib/geo'

/** Lo que escribió y marcó la persona. El lugar es OBLIGATORIO: nombre + punto exacto en el mapa. */
export interface PlaceValue { name: string; center?: PlanPlace['center'] }

/**
 * ¿Dónde es? Escribes cómo se llama el lugar y lo marcas en el mapa: ese punto es el lugar EXACTO del plan para todos
 * (no es tu ubicación). [PROPUESTA] Preparado para un buscador de lugares reales (Amazon Location, ver `api.places`):
 * cuando exista, el nombre se autocompletará y el punto vendrá del lugar; el pin manual seguirá como respaldo.
 */
export function PlacePicker({
  label, value, onChange, placeholder, hint, error,
}: { label: string; value: PlaceValue; onChange: (v: PlaceValue) => void; placeholder?: string; hint?: string; error?: string }) {
  const { state } = useApp()
  const [mapOpen, setMapOpen] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      <Field
        label={label} icon={<MapPin aria-hidden="true" size={18} />} placeholder={placeholder} value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })} hint={hint} error={error} autoComplete="off"
      />
      <Button variant="secondary" className="self-start !h-11 rounded-md px-3.5 text-sm" icon={<MapPin aria-hidden="true" size={16} />} onClick={() => setMapOpen(true)}>
        {value.center ? 'Cambiar en el mapa' : 'Elegir en el mapa'}
      </Button>
      <MapPickerSheet open={mapOpen} initial={value.center} onClose={() => setMapOpen(false)} onPick={(center) => onChange({ ...value, center })} />
      {value.center && (
        <p role="status" className="flex items-center gap-2 rounded-md bg-cat-musica px-3 py-2 text-caption font-bold text-ink">
          <Check aria-hidden="true" size={16} strokeWidth={3} />
          Lugar exacto marcado en el mapa · a {formatApproxDistance(distanceM(state.location.center, value.center))}
        </p>
      )}
    </div>
  )
}
