import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import Map, { AttributionControl, Marker, Source, Layer, type MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Crosshair, Minus, Plus } from 'lucide-react'
import { ClusterMarker, EventMarker, EVENT_PIN_OFFSET, MeMarker, PersonMarker, PLAN_PIN_OFFSET, PlanMarker } from '@/design'
import { EVENT_TYPES, PLAN_CATEGORIES } from '@/lib/category'
import { circlePolygon, APPROX_RADIUS_M } from '@/lib/geo'
import { useApp } from '@/app/store'
import { eventRange, formatApproxDistance } from '@/lib/format'
import { clusterPoints } from '@/lib/cluster'
import { planPhase, clockLabel } from '@/lib/planTime'
import { Layers } from 'lucide-react'
import tokens from '../../../docs/design/tokens.json'
import { itemPoint, type MapItem } from './useMapData'

/**
 * Estilo vectorial CARTO "Positron" (OpenStreetMap), sin API key. Aviso de privacidad: al cargar
 * tiles el proveedor ve el área que se mira (no tu identidad ni tu punto exacto). Para producción,
 * alojar un estilo propio (p. ej. OpenFreeMap/Protomaps en S3 + CloudFront de `infra/`).
 */
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const START_ZOOM = 14

export interface MapPadding { top: number; right: number; bottom: number; left: number }

/** Tocar un marcador no cuenta como tocar el mapa vacío (que quita la selección). */
const stop = (e: { originalEvent: MouseEvent }) => e.originalEvent.stopPropagation()

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Mapa MapLibre GL. La ubicación aproximada de un amigo cercano es un círculo de 500 m (capa GeoJSON con borde punteado);
 * la posición exacta solo se dibuja cuando `item.exact` existe (esa persona te la compartió por un rato).
 * Los planes y eventos se dibujan en su lugar exacto.
 */
export default function MapView({
  items, selectedId, onSelect, onCluster, padding, showZoom, showRecenter = true, hideAttribution, controlsStyle, attribution = 'bottom-right', attributionStyle,
}: {
  items: MapItem[]
  selectedId: string | null
  /** `null` = se tocó un espacio vacío del mapa: se quita la selección. */
  onSelect: (id: string | null) => void
  /** Se tocó un grupo de marcadores: la lista de lo que hay ahí. */
  onCluster: (items: MapItem[]) => void
  /** Parte del mapa que NO está tapada por UI flotante; el centro visual se calcula con esto. */
  padding: MapPadding
  showZoom?: boolean
  /** Botón "Centrar en mi ubicación". */
  showRecenter?: boolean
  /** Oculta el control de créditos de la esquina (los créditos van en la ayuda del mapa). */
  hideAttribution?: boolean
  /** Posición del grupo de controles (alineado a la derecha). */
  controlsStyle: CSSProperties
  attribution?: 'bottom-right' | 'bottom-left'
  attributionStyle?: CSSProperties
}) {
  const ref = useRef<MapRef>(null)
  const { state: { location }, locationIssue, connected } = useApp()
  const origin = location.center
  const [zoom, setZoom] = useState(START_ZOOM)
  const first = useRef(true)

  const approx = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: items.flatMap((it) =>
        it.kind === 'person' && !it.exact && !it.atId
          ? [{ type: 'Feature' as const, properties: { id: it.id }, geometry: circlePolygon(it.cell, APPROX_RADIUS_M) }]
          : [],
      ),
    }),
    [items],
  )

  // Agrupación por cercanía en pantalla: personas por un lado; planes y eventos por otro. El seleccionado sale del grupo.
  const groups = useMemo(() => {
    const point = (it: MapItem) => ({ id: it.id, point: itemPoint(it), it })
    const free = items.filter((i) => i.id === selectedId && !(i.kind === 'person' && i.atId))
    // Los amigos que están en un evento en curso van como círculos del evento: no tienen marcador propio.
    const persons = clusterPoints(items.filter((i) => i.kind === 'person' && !i.atId && i.id !== selectedId).map(point), zoom)
    const places = clusterPoints(items.filter((i) => i.kind !== 'person' && i.id !== selectedId).map(point), zoom)
    return [...free.map((it) => ({ id: it.id, point: itemPoint(it), items: [it] })), ...[...persons, ...places].map((c) => ({ id: c.id, point: c.point, items: c.items.map((x) => x.it) }))]
  }, [items, zoom, selectedId])
  const atPlace = useMemo(() => {
    const m: Record<string, Extract<MapItem, { kind: 'person' }>[]> = {}
    for (const it of items) if (it.kind === 'person' && it.atId) m[it.atId] = [...(m[it.atId] ?? []), it]
    return m
  }, [items])

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
    ref.current?.flyTo({ center: [origin.lng, origin.lat], zoom: START_ZOOM, padding, duration: reduced() ? 0 : 700 })

  const btn = 'flex size-11 items-center justify-center rounded-md border border-line bg-surface shadow-md'

  return (
    <div className="absolute inset-0">
      <Map
        ref={ref}
        initialViewState={{ longitude: origin.lng, latitude: origin.lat, zoom: START_ZOOM, padding }}
        mapStyle={MAP_STYLE}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
        minZoom={10}
        maxZoom={18}
        onZoomEnd={(e) => setZoom(Math.round(e.viewState.zoom * 4) / 4)}
        onClick={() => onSelect(null)}
        dragRotate={false}
        touchPitch={false}
        locale={{ 'AttributionControl.ToggleAttribution': 'Mostrar créditos del mapa' }}
      >
        {!hideAttribution && <AttributionControl compact position={attribution} style={attributionStyle} />}
        <Source id="approx" type="geojson" data={approx}>
          <Layer id="approx-fill" type="fill" paint={{ 'fill-color': tokens.color.primary, 'fill-opacity': 0.1 }} />
          <Layer id="approx-line" type="line" paint={{ 'line-color': tokens.color.primary, 'line-width': 2, 'line-dasharray': [2, 2] }} />
        </Source>

        <Marker longitude={origin.lng} latitude={origin.lat} anchor="center" style={{ zIndex: 1 }}>
          <MeMarker issue={!!locationIssue} live={connected && location.status === 'granted'} />
        </Marker>

        {groups.map((g) => {
          const first = g.items[0]!
          if (g.items.length > 1) {
            const persons = g.items.every((x) => x.kind === 'person')
            return (
              <Marker onClick={stop} key={g.id} longitude={g.point.lng} latitude={g.point.lat} anchor="center" style={{ zIndex: 2 }}>
                <ClusterMarker
                  count={g.items.length} onSelect={() => onCluster([...g.items, ...g.items.flatMap((x) => (x.kind !== 'person' ? (atPlace[x.id] ?? []) : []))])}
                  people={persons ? g.items.flatMap((x) => (x.kind === 'person' ? [{ id: x.user.id, name: x.user.name, src: x.user.avatarUrl }] : [])) : undefined}
                  icon={persons ? undefined : <Layers aria-hidden="true" size={18} />}
                  label={`${g.items.length} ${persons ? 'amigos cercanos' : 'planes y eventos'} aquí. Abre la lista`}
                />
              </Marker>
            )
          }
          const it = first
          const p = itemPoint(it)
          const selected = selectedId === it.id
          if (it.kind === 'event') {
            const t = EVENT_TYPES[it.event.type]
            return (
              <Marker onClick={stop} key={it.id} longitude={p.lng} latitude={p.lat} anchor="top" offset={[0, -EVENT_PIN_OFFSET]} style={{ zIndex: selected ? 3 : 2 }}>
                <EventMarker
                  icon={t.icon({ size: 26, strokeWidth: 2.2 })} selected={selected} onSelect={() => onSelect(it.id)}
                  label={`${it.event.title.split(' ').slice(0, 2).join(' ')} · ${clockLabel(it.event.startsAt)}`}
                  description={`${it.event.title}: evento, ${eventRange(it.event)}, en ${it.event.placeName}, a ${formatApproxDistance(it.distanceM)}`}
                  people={(atPlace[it.id] ?? []).map((pp) => ({
                    id: pp.user.id, name: pp.user.name, src: pp.user.avatarUrl, selected: selectedId === pp.id, onSelect: () => onSelect(pp.id),
                    description: `${pp.user.name}: amigo cercano, está en este evento`,
                  }))}
                />
              </Marker>
            )
          }
          if (it.kind === 'person') {
            const state = it.exact ? 'ubicación exacta compartida' : 'ubicación aproximada'
            return (
              <Marker onClick={stop} key={it.id} longitude={p.lng} latitude={p.lat} anchor="center" style={{ zIndex: selected ? 3 : 2 }}>
                <PersonMarker
                  person={it.user} src={it.user.avatarUrl} selected={selected} exact={!!it.exact} noPlan={!it.plan} onSelect={() => onSelect(it.id)}
                  description={`${it.user.name}: ${it.plan ? 'con plan' : 'sin plan'}, ${state}`}
                />
              </Marker>
            )
          }
          const cat = PLAN_CATEGORIES[it.plan.category]
          const live = planPhase(it.plan) === 'live'
          return (
            <Marker onClick={stop} key={it.id} longitude={p.lng} latitude={p.lat} anchor="top" offset={[0, -PLAN_PIN_OFFSET]} style={{ zIndex: selected ? 3 : 2 }}>
              <PlanMarker
                icon={cat.icon({ size: 22, strokeWidth: 2.2 })} tileClass={cat.tile} live={live} selected={selected} onSelect={() => onSelect(it.id)}
                label={`${cat.label} · ${live ? 'En curso' : clockLabel(it.plan.startsAt)}`}
                description={`${it.user.name}: plan en ${it.place.name}, lugar exacto`}
                people={(atPlace[it.id] ?? []).map((pp) => ({
                  id: pp.user.id, name: pp.user.name, src: pp.user.avatarUrl, selected: selectedId === pp.id, onSelect: () => onSelect(pp.id),
                  description: `${pp.user.name}: amigo cercano, está en este plan`,
                }))}
              />
            </Marker>
          )
        })}
      </Map>

      {/* Un solo grupo de controles, misma columna y mismo ancho: Ubicarme + zoom (lo que esté activo). */}
      {(showRecenter || showZoom) && (
        <div className="absolute z-20 flex flex-col items-center gap-2" style={controlsStyle}>
          {showRecenter && (
            <button type="button" aria-label="Centrar en mi ubicación" onClick={recenter} className={`${btn} text-primary`}>
              <Crosshair aria-hidden="true" size={20} strokeWidth={2.2} />
            </button>
          )}
          {showZoom && (
            <>
              <button type="button" aria-label="Acercar" onClick={() => ref.current?.zoomIn({ duration: reduced() ? 0 : 250 })} className={btn}><Plus aria-hidden="true" size={20} /></button>
              <button type="button" aria-label="Alejar" onClick={() => ref.current?.zoomOut({ duration: reduced() ? 0 : 250 })} className={btn}><Minus aria-hidden="true" size={20} /></button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
