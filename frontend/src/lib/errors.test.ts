import { describe, expect, it } from 'vitest'
import { friendlyError } from './errors'

describe('friendlyError', () => {
  it('traduce mensajes conocidos del servidor', () => {
    expect(friendlyError('you cannot add yourself', 400)).toBe('No puedes agregarte a ti mismo.')
    expect(friendlyError('email already registered', 409)).toMatch(/ya tiene una cuenta/)
  })
  it('deja pasar lo que ya está en español y cae a un mensaje por código', () => {
    expect(friendlyError('Ese nombre de usuario ya está en uso.', 409)).toBe('Ese nombre de usuario ya está en uso.')
    expect(friendlyError('weird thing', 500)).toMatch(/de nuestro lado/)
    expect(friendlyError(undefined, 429)).toMatch(/Espera/)
  })
})
