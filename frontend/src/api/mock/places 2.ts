/** MOCK: buscador de lugares con la misma forma que tendrá la API real (`GET /places/autocomplete`, `GET /places/{id}`). */
import type { PlacesProvider } from '../client'
import type { PlanPlace } from '../schemas'
import { distanceM, type LatLng } from '@/lib/geo'

/** Lugares de ejemplo, ubicados por desplazamiento (en grados) respecto a `near`, para que siempre haya algo cerca. */
const CATALOG = [
  { id: 'mock-cafe-ambar', name: 'Café Ámbar', address: 'Av. Providencia 1200', dLat: 0.004, dLng: -0.003 },
  { id: 'mock-parque-metro', name: 'Parque Metropolitano', address: 'Av. Beethoven 5800', dLat: -0.012, dLng: 0.009 },
  { id: 'mock-gym-nucleo', name: 'Gimnasio Núcleo', address: 'Calle Hidalgo 340', dLat: 0.007, dLng: 0.006 },
  { id: 'mock-taqueria-centro', name: 'Taquería El Centro', address: 'Av. Juárez 215', dLat: -0.003, dLng: -0.008 },
  { id: 'mock-biblioteca', name: 'Biblioteca Pública Central', address: 'Calle Libertad 80', dLat: 0.002, dLng: 0.012 },
  { id: 'mock-plaza-fuentes', name: 'Plaza de las Fuentes', address: 'Av. Vallarta 3010', dLat: -0.009, dLng: -0.004 },
  { id: 'mock-cancha-sur', name: 'Cancha Sur', address: 'Calle Olímpica 12', dLat: -0.015, dLng: 0.001 },
  { id: 'mock-ludoteca', name: 'Ludoteca Dado Doble', address: 'Av. Chapultepec 480', dLat: 0.006, dLng: -0.011 },
] as const

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
const at = (c: (typeof CATALOG)[number], near: LatLng): PlanPlace => ({ placeId: c.id, name: c.name, address: c.address, center: { lat: near.lat + c.dLat, lng: near.lng + c.dLng } })

export const mockPlaces: PlacesProvider = {
  kind: 'mock',
  async autocomplete(q, near) {
    const n = norm(q)
    if (n.length < 2) return []
    return CATALOG.filter((c) => norm(`${c.name} ${c.address}`).includes(n)).map((c) => at(c, near)).sort((a, b) => distanceM(near, a.center) - distanceM(near, b.center)).slice(0, 5)
  },
  async details(placeId) {
    const c = CATALOG.find((x) => x.id === placeId)
    return c ? at(c, { lat: 20.675, lng: -103.365 }) : null
  },
}
