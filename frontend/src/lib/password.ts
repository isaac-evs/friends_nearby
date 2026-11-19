/** Reglas visibles de la contraseña nueva. Una sola fuente para el checklist de la UI y para el esquema Zod. */
export interface PasswordRule { id: 'length' | 'letter' | 'digit'; label: string; ok: boolean }

export function passwordRules(pw: string): PasswordRule[] {
  return [
    { id: 'length', label: 'Al menos 8 caracteres', ok: pw.length >= 8 },
    { id: 'letter', label: 'Una letra', ok: /\p{L}/u.test(pw) },
    { id: 'digit', label: 'Un número', ok: /\d/.test(pw) },
  ]
}
