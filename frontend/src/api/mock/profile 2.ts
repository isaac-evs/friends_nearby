/**
 * Mock de los endpoints de perfil. TODOS son [PROPUESTA]: `infra/` tiene S3 + CloudFront para fotos
 * pero aún no hay API de perfil ni autenticación (ver docs/especificacion.md §7).
 *
 *   POST /me/media/presign   → { uploadUrl, publicUrl }   (el cliente luego hace PUT del JPEG a S3)
 *   POST /me/password        → 204 | 400 { code: 'wrong_current' }
 *   GET  /usernames/:name    → { available: boolean }   (y PATCH /me { username } rechaza si ya existe: 409)
 *
 * Mock: la "subida" devuelve una URL de objeto local (no persiste al recargar) y la contraseña
 * nunca se guarda. Para poder ver el estado de error, la contraseña actual `incorrecta1` se rechaza.
 */
import type { ImageKind } from '@/lib/image'

const delay = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))

export class ApiError extends Error {
  constructor(public code: string, message: string) { super(message) }
}

export async function uploadProfileMedia(_kind: ImageKind, blob: Blob): Promise<string> {
  await delay(450)
  return URL.createObjectURL(blob)
}

/** ¿Está libre ese nombre de usuario? `taken` son los usuarios que ya existen (en producción lo decide el servidor). */
export async function isUsernameAvailable(username: string, taken: string[]): Promise<boolean> {
  await delay(350)
  return !taken.map((t) => t.replace('@', '').toLowerCase()).includes(username.toLowerCase())
}

export async function changePassword(input: { current: string; next: string }): Promise<void> {
  await delay(500)
  if (input.current === 'incorrecta1') throw new ApiError('wrong_current', 'La contraseña actual no es correcta.')
}
