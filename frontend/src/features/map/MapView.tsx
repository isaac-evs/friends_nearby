import { useEffect, useMemo, useRef, type CSSProperties } from 'react'
import Map, { AttributionControl, Marker, Source, Layer, type MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Crosshair, Minus, Plus } from 'lucide-react'
import { EventMarker, EVENT_PIN_OFFSET, FRIEND_PIN_OFFSET, FriendMarker, MeMarker } from '@/design'
import { EVENT_TYPES, PLAN_CATEGORIES } from '@/lib/category'
import { circlePolygon, MOCK_ORIGIN, ZONE_RADIUS_M } from '@/lib/geo'
import { formatApproxDistance } from '@/lib/format'
import tokens from '../../../docs/design/tokens.json'
import { itemPoint, type MapItem } from './useMapData'

/**
 * Estilo vectorial CARTO "Positron" (OpenStreetMap), sin API key. Aviso de privacidad: al cargar
 * tiles el proveedor ve el área que se mira (no tu identidad ni tu punto exacto). Para producción,
 * alojar un estilo propio (p. ej. OpenFreeMap/Protomaps en S3 + CloudFront de `infra/`).
 */
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const START_ZOOM = 13

export interface MapPadding { top: number; right: number; bottom: number; left: number }

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Mapa MapLibre GL. Las zonas aproximadas son círculos de 500 m (capa GeoJSON con borde punteado);
 * la posición exacta solo se dibuja cuando `item.exact` existe (match activo).
 */
export default function MapView({
  items, selectedId, onSelect, padding, showZoom, controlsStyle, attribution = 'bottom-right', attributionStyle,
}: {
  items: MapItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** Zona del mapa que NO está tapada por UI flotante; el centro visual se calcula con esto. */
  padding: MapPadding
  showZoom?: boolean
  /** Posición del grupo de controles (alineado a la derecha). */
  controlsStyle: CSSProperties
  attribution?: 'bottom-right' | 'bottom-left'
  attributionStyle?: CSSProperties
}) {
  const ref = useRef<MapRef>(null)
  const first = useRef(true)

  const zones = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: items.flatMap((it) =>
        it.kind === 'friend' && !it.exact
          ? [{ type: 'Feature' as const, properties: { id: it.id }, geometry: circlePolygon(it.zoneCenter, it.plan.zone.radiusM || ZONE_RADIUS_M) }]
          : [],
      ),
    }),
    [items],
  )

  // Si cambia la UI flotante (p. ej. se abre la lista), el centro visual se desplaza con animación.
  const pad = `${padding.top}-${padding.right}-${padding.bottom}-${padding.left}`
  const padFirst = useRef(true)
  useEffect(() => {
    if (padFirst.current) { padFirst.current = false; return }
    ref.current?.easeTo({ padding, duration: reduced() ? 0 : 300 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pad])

  // Al seleccionar (marcador o lista) el mapa se centra suavemente en ese elemento.
  useEffect(() => {
    if (first.current) { first.current = false; return }
    const it = items.find((i) => i.id === selectedId)
    if (!it) return
    const p = itemPoint(it)
    ref.current?.easeTo({ center: [p.lng, p.lat], padding, duration: reduced() ? 0 : 500 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const recenter = () =>
    ref.current?.flyTo({ center: [MOCK_ORIGIN.lng, MOCK_ORIGIN.lat], zoom: START_ZOOM, padding, duration: reduced() ? 0 : 700 })

  const btn = 'flex size-11 items-center justify-center rounded-md border border-line bg-surface shadow-md'

  return (
    <div className="absolute inset-0">
      <Map
        ref={ref}
        initialViewState={{ longitude: MOCK_ORIGIN.lng, latitude: MOCK_ORIGIN.lat, zoom: START_ZOOM, padding }}
        mapStyle={MAP_STYLE}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
        minZoom={10}
        maxZoom={18}
        dragRotate={false}
        touchPitch={false}
        locale={{ 'AttributionControl.ToggleAttribution': 'Mostrar créditos del mapa' }}
      >
        <AttributionControl compact position={attribution} style={attributionStyle} />
        <Source id="zones" type="geojson" data={zones}>
          <Layer id="zones-fill" type="fill" paint={{ 'fill-color': tokens.color.primary, 'fill-opacity': 0.1 }} />
          <Layer id="zones-line" type="line" paint={{ 'line-color': tokens.color.primary, 'line-width': 2, 'line-dasharray': [2, 2] }} />
        </Source>

        <Marker longitude={MOCK_ORIGIN.lng} latitude={MOCK_ORIGIN.lat} anchor="center" style={{ zIndex: 1 }}>
          <MeMarker />
        </Marker>

        {items.map((it) => {
          const p = itemPoint(it)
          const selected = selectedId === it.id
          if (it.kind === 'event') {
            const t = EVENT_TYPES[it.event.type]
            return (
              <Marker key={it.id} longitude={p.lng} latitude={p.lat} anchor="top" offset={[0, -EVENT_PIN_OFFSET]} style={{ zIndex: selected ? 3 : 2 }}>
                <EventMarker
                  icon={t.icon({ size: 26, strokeWidth: 2.2 })} selected={selected} onSelect={() => onSelect(it.id)}
                  label={`${it.event.title.split(' ').slice(0, 2).join(' ')} · ${it.event.going}`}
                  description={`${it.event.title}: evento público, a ${formatApproxDistance(it.event.approxDistanceM)}`}
                />
              </Marker>
            )
          }
          const cat = PLAN_CATEGORIES[it.plan.category]
          return (
            <Marker key={it.id} longitude={p.lng} latitude={p.lat} anchor="top" offset={[0, -FRIEND_PIN_OFFSET]} style={{ zIndex: selected ? 3 : 2 }}>
              <FriendMarker
                person={it.user} label={cat.label} exact={!!it.exact} selected={selected} onSelect={() => onSelect(it.id)}
                description={`${it.user.name}: ${it.exact ? 'ubicación exacta por match' : 'zona aproximada'}`}
              />
            </Marker>
          )
        })}
      </Map>

      {/* Un solo grupo de controles, misma columna y mismo ancho: Ubicarme + zoom. */}
      <div className="absolute z-20 flex flex-col items-center gap-2" style={controlsStyle}>
        <button type="button" aria-label="Centrar en mi ubicación" onClick={recenter} className={`${btn} text-primary`}>
          <Crosshair aria-hidden="true" size={20} strokeWidth={2.2} />
        </button>
        {showZoom && (
          <>
            <button type="button" aria-label="Acercar" onClick={() => ref.current?.zoomIn({ duration: reduced() ? 0 : 250 })} className={btn}><Plus aria-hidden="true" size={20} /></button>
            <button type="button" aria-label="Alejar" onClick={() => ref.current?.zoomOut({ duration: reduced() ? 0 : 250 })} className={btn}><Minus aria-hidden="true" size={20} /></button>
          </>
        )}
      </div>
    </div>
  )
}
