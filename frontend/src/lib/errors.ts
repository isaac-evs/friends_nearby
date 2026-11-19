/** Mensajes del servidor (en inglés o técnicos) → texto claro en español. Lo desconocido cae a un mensaje por código HTTP. */
const KNOWN: [RegExp, string][] = [
  [/cannot add yourself/i, 'No puedes agregarte a ti mismo.'],
  [/invalid email or password/i, 'Correo o contraseña incorrectos.'],
  [/email already registered/i, 'Ese correo ya tiene una cuenta. Entra o recupera tu contraseña.'],
  [/username already taken/i, 'Ese nombre de usuario ya está en uso.'],
  [/username must be/i, 'Usa de 3 a 20 letras minúsculas, números o guion bajo.'],
  [/user not found|usuario no encontrado/i, 'No encontramos a esa persona.'],
  [/request already sent|already friends/i, 'Ya le enviaste una solicitud o ya son amigos.'],
  [/no pending request/i, 'Esa solicitud ya no existe.'],
  [/friendship not found/i, 'Esa amistad ya no existe.'],
  [/session expired|unauthorized/i, 'Tu sesión terminó. Entra de nuevo.'],
  [/reset token|password recovery/i, 'Ese enlace ya no es válido. Pide uno nuevo.'],
  [/invalid email/i, 'Revisa tu correo: debe verse como tu@correo.com.'],
  [/password must be/i, 'La contraseña debe tener entre 8 y 72 caracteres.'],
  [/display_name/i, 'El nombre debe tener entre 1 y 50 caracteres.'],
  [/body too large|content_type|photo_key|tipo de imagen/i, 'No pudimos usar esa imagen. Prueba con un JPG, PNG o WebP de hasta 5 MB.'],
  [/internal error/i, 'Algo falló de nuestro lado. Intenta de nuevo en un momento.'],
]
const hasLatin = (s: string) => /[áéíóúñ¿¡]/i.test(s) || /\b(el|la|los|las|de|que|tu|tus|no|ya|una?)\b/i.test(s)

export function friendlyError(message: string | undefined, status = 0): string {
  const m = (message ?? '').trim()
  const hit = KNOWN.find(([re]) => re.test(m))
  if (hit) return hit[1]
  if (m && hasLatin(m)) return m // ya viene en español
  if (status === 401) return 'Tu sesión terminó. Entra de nuevo.'
  if (status === 403) return 'No tienes permiso para hacer eso.'
  if (status === 404) return 'Eso ya no existe.'
  if (status === 409) return 'Los datos cambiaron. Actualiza e inténtalo de nuevo.'
  if (status === 429) return 'Vas muy rápido. Espera un momento e intenta de nuevo.'
  if (status >= 500) return 'Algo falló de nuestro lado. Intenta de nuevo en un momento.'
  return m || 'No pudimos completar la operación.'
}
