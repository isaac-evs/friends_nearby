/**
 * Agrupación de marcadores del mapa por cercanía EN PANTALLA: lo que queda a menos de `cellPx` píxeles se junta en un
 * grupo; al acercar el zoom los píxeles entre puntos crecen y los grupos se separan solos. Dos cosas en el mismo lugar
 * (misma coordenada) se agrupan siempre: es un solo establecimiento.
 */
import type { LatLng } from '@/lib/geo'

export interface Clusterable { id: string; point: LatLng }
export interface Cluster<T extends Clusterable> {
  /** Un elemento suelto conserva su id; un grupo lleva `cluster:` + los ids. */
  id: string
  /** Centro del grupo (promedio de sus puntos). */
  point: LatLng
  items: T[]
}

/** Coordenada → píxeles del mapa mundial a ese zoom (Web Mercator, teselas de 512 px como MapLibre). */
export function toWorldPx(p: LatLng, zoom: number): { x: number; y: number } {
  const size = 512 * 2 ** zoom
  const x = ((p.lng + 180) / 360) * size
  const s = Math.sin((p.lat * Math.PI) / 180)
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * size
  return { x, y }
}

export function clusterPoints<T extends Clusterable>(items: T[], zoom: number, cellPx = 52): Cluster<T>[] {
  const groups: { items: T[]; sx: number; sy: number; slat: number; slng: number }[] = []
  // Orden estable: el resultado no depende del orden en que lleguen.
  for (const it of [...items].sort((a, b) => a.id.localeCompare(b.id))) {
    const px = toWorldPx(it.point, zoom)
    const g = groups.find((c) => Math.hypot(c.sx / c.items.length - px.x, c.sy / c.items.length - px.y) < cellPx)
    if (g) { g.items.push(it); g.sx += px.x; g.sy += px.y; g.slat += it.point.lat; g.slng += it.point.lng }
    else groups.push({ items: [it], sx: px.x, sy: px.y, slat: it.point.lat, slng: it.point.lng })
  }
  return groups.map((g) => ({
    id: g.items.length === 1 ? g.items[0]!.id : `cluster:${g.items.map((i) => i.id).join('+')}`,
    point: { lat: g.slat / g.items.length, lng: g.slng / g.items.length },
    items: g.items,
  }))
}
