import { MinusIcon, PlusIcon, TrashIcon } from '../icons'

interface QuantityStepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  label: string
  size?: 'sm' | 'md'
  /** com 0, mostra só o botão "+" redondo (como no cardápio do iFood) */
  collapseAtZero?: boolean
  /** permite digitar a quantidade */
  editable?: boolean
}

export default function QuantityStepper({
  value,
  onChange,
  min = 0,
  label,
  size = 'md',
  collapseAtZero = false,
  editable = false,
}: QuantityStepperProps) {
  const dimension = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9'

  if (collapseAtZero && value <= 0) {
    return (
      <button
        type="button"
        onClick={() => onChange(1)}
        aria-label={`Adicionar ${label}`}
        className={`press flex ${dimension} shrink-0 items-center justify-center rounded-full bg-white text-orange-base shadow-card ring-1 ring-gray-200 transition-colors hover:bg-orange-base hover:text-white`}
      >
        <PlusIcon className="h-4 w-4" strokeWidth={2.5} />
      </button>
    )
  }

  // no 1, o "−" vira lixeira: tirar o item é o próximo passo
  const showTrash = collapseAtZero && value === 1 && min === 0

  return (
    <div className="flex shrink-0 animate-scale-in items-center gap-1 rounded-full bg-white p-0.5 shadow-card ring-1 ring-gray-200">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={showTrash ? `Remover ${label}` : `Diminuir ${label}`}
        className={`press flex ${dimension} items-center justify-center rounded-full text-orange-base transition-colors hover:bg-orange-base/10 disabled:text-gray-300 disabled:hover:bg-transparent`}
      >
        {showTrash ? <TrashIcon className="h-4 w-4" /> : <MinusIcon className="h-4 w-4" strokeWidth={2.5} />}
      </button>
      {editable ? (
        <input
          type="number"
          min={min}
          inputMode="numeric"
          value={value}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const next = Number(e.target.value)
            onChange(Number.isFinite(next) ? Math.max(min, Math.floor(next)) : min)
          }}
          aria-label={`Quantidade de ${label}`}
          className="w-12 [appearance:textfield] bg-transparent text-center text-sm font-bold text-gray-900 tabular-nums focus:outline-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      ) : (
        <span className="min-w-6 text-center text-sm font-bold text-gray-900 tabular-nums" aria-live="polite">
          {value}
        </span>
      )}
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        aria-label={`Aumentar ${label}`}
        className={`press flex ${dimension} items-center justify-center rounded-full text-orange-base transition-colors hover:bg-orange-base/10`}
      >
        <PlusIcon className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </div>
  )
}
