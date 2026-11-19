import { describe, expect, it } from 'vitest'
import { mockPlaces } from './places'

const near = { lat: 20.675, lng: -103.365 }
describe('mockPlaces', () => {
  it('busca sin acentos, devuelve lugar exacto y ordena por cercanía', async () => {
    const r = await mockPlaces.autocomplete('cafe', near)
    expect(r[0]).toMatchObject({ name: 'Café Ámbar', placeId: 'mock-cafe-ambar' })
    expect(r[0]!.center).not.toEqual(near)
  })
  it('con menos de 2 letras o sin coincidencias no devuelve nada', async () => {
    expect(await mockPlaces.autocomplete('c', near)).toEqual([])
    expect(await mockPlaces.autocomplete('zzzz', near)).toEqual([])
  })
})
