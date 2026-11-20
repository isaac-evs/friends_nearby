import { useRef, useState, type ChangeEvent } from 'react'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { Avatar } from './Avatar'
import { Button } from './Button'
import { cn } from '@/lib/cn'
import { IMAGE_TYPES, processImage, validateImage, type ImageKind } from '@/lib/image'

interface ImageUploadProps {
  kind: ImageKind
  /** Nombre del campo, para lectores de pantalla: "Foto de perfil" / "Portada". */
  label: string
  /** Texto corto del botón: "foto" / "portada". */
  noun: string
  /** id de un texto de ayuda que ya está en pantalla (se enlaza con `aria-describedby`). */
  hintId?: string
  value?: string
  userId: string
  name: string
  /** Sube el JPEG ya procesado y devuelve su URL pública. */
  upload: (blob: Blob) => Promise<string>
  onChange: (url: string) => void
  onRemove: () => void
}

/**
 * Subida de foto con vista previa. Estados: reposo, procesando (`aria-busy`), error (`role="alert"`).
 * El archivo se valida, se recorta y se vuelve a codificar antes de subirlo (ver `lib/image.ts`: sin EXIF).
 */
export function ImageUpload({ kind, label, noun, hintId, value, userId, name, upload, onChange, onRemove }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!file) return
    const invalid = validateImage(file)
    if (invalid) { setError(invalid); return }
    setError(null)
    setBusy(true)
    try {
      const jpeg = await processImage(file, kind)
      onChange(await upload(jpeg))
    } catch (err) {
      setError(err instanceof Error && err.message === 'decode' ? 'No pudimos leer esa imagen. Prueba con otra.' : 'No se pudo subir. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const actions = (
    <div className={cn('flex flex-wrap items-center gap-2', kind === 'avatar' && 'flex-1')}>
      <Button variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()} aria-describedby={hintId} aria-label={`${value ? 'Cambiar' : 'Subir'} ${label.toLowerCase()}`} icon={<Camera aria-hidden="true" size={18} />}>
        {value ? 'Cambiar' : 'Subir'} {noun}
      </Button>
      {value && (
        <Button variant="ghost" disabled={busy} onClick={() => { setError(null); onRemove() }} icon={<Trash2 aria-hidden="true" size={18} />} aria-label={`Quitar ${label.toLowerCase()}`}>
          Quitar
        </Button>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-2.5" aria-busy={busy || undefined}>
      {kind === 'avatar' ? (
        <div className="flex items-center gap-3.5">
          <Avatar userId={userId} name={name} size={90} self src={value} />
          {actions}
        </div>
      ) : (
        <>
          <div className="relative h-[104px] overflow-hidden rounded-lg border border-line bg-primary-soft">
            {value && <img src={value} alt="" className="size-full object-cover" />}
          </div>
          {actions}
        </>
      )}
      <input
        ref={inputRef} type="file" accept={IMAGE_TYPES.join(',')} data-kind={kind} onChange={pick}
        aria-hidden="true" tabIndex={-1} className="hidden"
      />
      {busy && <p role="status" className="flex items-center gap-1.5 text-caption font-bold"><Loader2 aria-hidden="true" size={14} className="animate-spin" />Subiendo…</p>}
      {error && <p role="alert" className="text-caption font-bold text-danger">{error}</p>}
    </div>
  )
}
