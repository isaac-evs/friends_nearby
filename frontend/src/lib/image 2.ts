/**
 * Fotos de perfil y portada. Todo se procesa en el cliente antes de "subir":
 * se valida tipo y tamaño, se recorta al centro y se vuelve a codificar en un canvas.
 * Re-codificar descarta los metadatos EXIF (incluida la ubicación GPS de la foto): privacidad.
 */
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export type ImageKind = 'avatar' | 'cover' | 'plan'
/** Relación de aspecto del recorte y tamaño máximo de salida. */
export const IMAGE_SPECS: Record<ImageKind, { aspect: number; outW: number; outH: number }> = {
  avatar: { aspect: 1, outW: 512, outH: 512 },
  cover: { aspect: 3, outW: 1536, outH: 512 },
  /** Foto de un plan o evento (16:9). */
  plan: { aspect: 16 / 9, outW: 960, outH: 540 },
}

export function validateImage(file: { type: string; size: number }): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return 'Usa una imagen JPG, PNG o WebP.'
  if (file.size > MAX_IMAGE_BYTES) return 'La imagen pesa más de 5 MB. Prueba con una más ligera.'
  if (file.size === 0) return 'Ese archivo está vacío.'
  return null
}

/** Recorte centrado con la relación de aspecto pedida. */
export function centerCrop(w: number, h: number, aspect: number) {
  let sw = w
  let sh = Math.max(1, Math.round(w / aspect))
  if (sh > h) { sh = h; sw = Math.max(1, Math.round(h * aspect)) }
  return { sx: Math.floor((w - sw) / 2), sy: Math.floor((h - sh) / 2), sw, sh }
}

/** Tamaño de salida: nunca agranda y respeta el máximo del tipo de imagen. */
export function outputSize(sw: number, sh: number, kind: ImageKind) {
  const { outW, outH } = IMAGE_SPECS[kind]
  const scale = Math.min(1, outW / sw, outH / sh)
  return { w: Math.max(1, Math.round(sw * scale)), h: Math.max(1, Math.round(sh * scale)) }
}

/** Decodifica, recorta y re-codifica a JPEG (sin EXIF). Lanza `Error('decode')` si no se puede leer. */
export async function processImage(file: Blob, kind: ImageKind): Promise<Blob> {
  let bmp: ImageBitmap
  try { bmp = await createImageBitmap(file) } catch { throw new Error('decode') }
  try {
    const { sx, sy, sw, sh } = centerCrop(bmp.width, bmp.height, IMAGE_SPECS[kind].aspect)
    const { w, h } = outputSize(sw, sh, kind)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('decode')
    ctx.fillStyle = '#fff' // PNG/WebP con transparencia → fondo blanco en JPEG
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85))
    if (!blob) throw new Error('decode')
    return blob
  } finally {
    bmp.close()
  }
}
