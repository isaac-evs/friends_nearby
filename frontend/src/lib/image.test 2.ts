import { describe, expect, it } from 'vitest'
import { centerCrop, MAX_IMAGE_BYTES, outputSize, validateImage } from './image'
import { passwordRules } from './password'
import { PasswordChangeInput, ProfileNameInput } from '@/api/schemas'

describe('validateImage', () => {
  it('acepta JPG, PNG y WebP hasta 5 MB', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) expect(validateImage({ type, size: 1000 })).toBeNull()
    expect(validateImage({ type: 'image/png', size: MAX_IMAGE_BYTES })).toBeNull()
  })
  it('rechaza otros tipos, archivos vacíos y pesados', () => {
    expect(validateImage({ type: 'image/gif', size: 10 })).toMatch(/JPG, PNG o WebP/)
    expect(validateImage({ type: 'text/plain', size: 10 })).toMatch(/JPG, PNG o WebP/)
    expect(validateImage({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 })).toMatch(/5 MB/)
    expect(validateImage({ type: 'image/png', size: 0 })).toMatch(/vacío/)
  })
})

describe('centerCrop', () => {
  it('cuadrado desde una foto horizontal', () => expect(centerCrop(400, 200, 1)).toEqual({ sx: 100, sy: 0, sw: 200, sh: 200 }))
  it('cuadrado desde una foto vertical', () => expect(centerCrop(200, 400, 1)).toEqual({ sx: 0, sy: 100, sw: 200, sh: 200 }))
  it('portada 3:1 desde una foto casi cuadrada', () => expect(centerCrop(300, 280, 3)).toEqual({ sx: 0, sy: 90, sw: 300, sh: 100 }))
  it('imágenes diminutas nunca dan un recorte de 0 px', () => expect(centerCrop(1, 1, 3)).toEqual({ sx: 0, sy: 0, sw: 1, sh: 1 }))
  it('portada 3:1 cuando la foto es más ancha que 3:1', () => expect(centerCrop(900, 100, 3)).toEqual({ sx: 300, sy: 0, sw: 300, sh: 100 }))
})

describe('outputSize', () => {
  it('reduce al máximo del tipo, sin agrandar', () => {
    expect(outputSize(2000, 2000, 'avatar')).toEqual({ w: 512, h: 512 })
    expect(outputSize(300, 300, 'avatar')).toEqual({ w: 300, h: 300 })
    expect(outputSize(3000, 1000, 'cover')).toEqual({ w: 1536, h: 512 })
  })
})

describe('contraseña', () => {
  it('lista las reglas con su estado', () => {
    expect(passwordRules('abc').map((r) => r.ok)).toEqual([false, true, false])
    expect(passwordRules('abcdefg1').every((r) => r.ok)).toBe(true)
  })
  it('valida el cambio completo', () => {
    const ok = PasswordChangeInput.safeParse({ current: 'vieja-123', next: 'nueva-1234', confirm: 'nueva-1234' })
    expect(ok.success).toBe(true)
    const issues = (v: object) => { const r = PasswordChangeInput.safeParse(v); return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }
    expect(issues({ current: 'x1234567', next: 'corta1', confirm: 'corta1' })[0]).toMatch(/^next: .*8 caracteres/)
    expect(issues({ current: 'x1234567', next: 'sinnumeros', confirm: 'sinnumeros' })[0]).toMatch(/número/)
    expect(issues({ current: 'x1234567', next: 'x1234567', confirm: 'x1234567' })[0]).toMatch(/distinta/)
    expect(issues({ current: 'x1234567', next: 'nueva-1234', confirm: 'otra-12345' })[0]).toMatch(/^confirm: .*no coinciden/)
    expect(issues({ current: '', next: 'nueva-1234', confirm: 'nueva-1234' })[0]).toMatch(/^current:/)
  })
})

describe('nombre', () => {
  it('recorta espacios y valida largo', () => {
    expect(ProfileNameInput.parse({ name: '  Alan  ' }).name).toBe('Alan')
    expect(ProfileNameInput.safeParse({ name: ' a ' }).success).toBe(false)
    expect(ProfileNameInput.safeParse({ name: 'x'.repeat(41) }).success).toBe(false)
  })
})

describe('descripción', () => {
  it('permite hasta 160 caracteres y recorta espacios', async () => {
    const { ProfileBioInput } = await import('@/api/schemas')
    expect(ProfileBioInput.parse({ bio: '  hola  ' }).bio).toBe('hola')
    expect(ProfileBioInput.safeParse({ bio: 'x'.repeat(160) }).success).toBe(true)
    expect(ProfileBioInput.safeParse({ bio: 'x'.repeat(161) }).success).toBe(false)
    expect(ProfileBioInput.parse({ bio: '' }).bio).toBe('')
  })
})
