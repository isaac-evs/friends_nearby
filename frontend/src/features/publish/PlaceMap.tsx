import { useEffect, useRef } from 'react'
import Map, { Marker, type MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MapPin } from 'lucide-react'
import type { LatLng } from '@/lib/geo'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

/** Mapa para elegir un punto: toca el mapa o arrastra el pin. Se carga bajo demanda (MapLibre pesa). */
export default function PlaceMap({ point, onPick }: { point: LatLng; onPick: (p: LatLng) => void }) {
  const ref = useRef<MapRef>(null)
  const first = useRef(true)
  // Si el punto cambia por los botones de mover, el mapa lo sigue.
  useEffect(() => {
    if (first.current) { first.current = false; return }
    ref.current?.easeTo({ center: [point.lng, point.lat], duration: 250 })
  }, [point.lat, point.lng])
  return (
    <Map
      ref={ref} initialViewState={{ longitude: point.lng, latitude: point.lat, zoom: 14 }} mapStyle={MAP_STYLE} attributionControl={false}
      style={{ width: '100%', height: '100%' }} minZoom={10} maxZoom={18} dragRotate={false} touchPitch={false}
      onClick={(e) => onPick({ lat: Number(e.lngLat.lat.toFixed(5)), lng: Number(e.lngLat.lng.toFixed(5)) })}
    >
      <Marker
        longitude={point.lng} latitude={point.lat} anchor="bottom" draggable
        onDragEnd={(e) => onPick({ lat: Number(e.lngLat.lat.toFixed(5)), lng: Number(e.lngLat.lng.toFixed(5)) })}
      >
        <MapPin aria-hidden="true" size={38} strokeWidth={2} className="fill-primary text-white drop-shadow-md" />
      </Marker>
    </Map>
  )
}
