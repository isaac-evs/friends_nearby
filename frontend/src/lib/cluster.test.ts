import { describe, expect, it } from 'vitest'
import { clusterPoints, toWorldPx } from './cluster'

const at = (id: string, lat: number, lng: number) => ({ id, point: { lat, lng } })

describe('agrupar marcadores', () => {
  const a = at('a', 20.675, -103.365)
  const b = at('b', 20.6752, -103.3652) // ~30 m de a
  const far = at('far', 20.7, -103.4) // varios km

  it('cada punto suelto conserva su id', () => {
    const out = clusterPoints([a, far], 14)
    expect(out.map((c) => c.id).sort()).toEqual(['a', 'far'])
  })
  it('lo muy cercano se agrupa y al acercar el zoom se separa', () => {
    const lejos = clusterPoints([a, b], 12)
    expect(lejos).toHaveLength(1)
    expect(lejos[0]!.items.map((i) => i.id)).toEqual(['a', 'b'])
    expect(lejos[0]!.id).toBe('cluster:a+b')
    expect(clusterPoints([a, b], 18)).toHaveLength(2)
  })
  it('en la misma coordenada se agrupan siempre (un solo establecimiento)', () => {
    expect(clusterPoints([a, at('c', 20.675, -103.365)], 18)).toHaveLength(1)
  })
  it('el centro del grupo es el promedio', () => {
    const c = clusterPoints([at('a', 20, -103), at('b', 20.0002, -103.0002)], 10)[0]!
    expect(c.point.lat).toBeCloseTo(20.0001, 6)
    expect(c.point.lng).toBeCloseTo(-103.0001, 6)
  })
  it('no depende del orden de entrada', () => {
    expect(clusterPoints([b, a, far], 12).map((c) => c.id).sort()).toEqual(clusterPoints([far, a, b], 12).map((c) => c.id).sort())
  })
  it('proyección: el zoom duplica los píxeles', () => {
    const p13 = toWorldPx(a.point, 13)
    const p14 = toWorldPx(a.point, 14)
    expect(p14.x / p13.x).toBeCloseTo(2, 6)
  })
})
