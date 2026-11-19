import { Toggle } from '@/design'

/** ¿Se puede unir gente cuando ya empezó? Lo decide quien organiza. */
export function LateJoinRow({ noun, value, onChange }: { noun: 'plan' | 'evento'; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-surface py-1.5 pr-2.5 pl-4">
      <span className="flex flex-1 flex-col">
        <span className="text-sm font-bold">Se puede unir con el {noun} en curso</span>
        <span className="text-caption font-medium text-muted">{value ? `La gente puede unirse aunque el ${noun} ya haya empezado.` : `Cuando el ${noun} empiece, ya no entra nadie más.`}</span>
      </span>
      <Toggle checked={value} onChange={onChange} label={`Se puede unir con el ${noun} en curso`} />
    </div>
  )
}
