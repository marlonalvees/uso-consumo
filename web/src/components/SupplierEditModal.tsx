import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { useToast } from '../context/ToastContext'
import type { Supplier } from '../types'
import { btnPrimary, btnSecondary, inputClass, labelClass } from '../lib/ui'
import Sheet from './ui/Sheet'

interface SupplierEditModalProps {
  supplier: Supplier | null
  mode?: 'create' | 'edit'
  onClose: () => void
  onSaved: (supplier: Supplier) => void
}

interface FormState {
  name: string
  cnpj: string
  phone: string
  email: string
  leadTimeDays: string
}

function emptyForm(): FormState {
  return { name: '', cnpj: '', phone: '', email: '', leadTimeDays: '' }
}

function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export default function SupplierEditModal({ supplier, mode = 'edit', onClose, onSaved }: SupplierEditModalProps) {
  const toast = useToast()
  const isCreate = mode === 'create'
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isCreate) {
      setForm(emptyForm())
      return
    }
    if (!supplier) {
      setForm(null)
      return
    }
    setForm({
      name: supplier.name,
      cnpj: supplier.cnpj ? formatCnpj(supplier.cnpj) : '',
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      leadTimeDays: supplier.leadTimeDays !== null ? String(supplier.leadTimeDays) : '',
    })
  }, [supplier, isCreate])

  if ((!isCreate && !supplier) || !form) return null

  function set(change: Partial<FormState>) {
    setForm((prev) => (prev ? { ...prev, ...change } : prev))
  }

  async function handleSave() {
    if (!form!.name.trim()) {
      toast.error('Informe o nome do fornecedor')
      return
    }
    const leadTime = form!.leadTimeDays.trim() === '' ? null : Number(form!.leadTimeDays)
    if (leadTime !== null && (!Number.isInteger(leadTime) || leadTime < 0 || leadTime > 365)) {
      toast.error('O prazo de entrega deve ser um número de dias')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: form!.name.trim(),
        cnpj: form!.cnpj.trim() || null,
        phone: form!.phone.trim() || null,
        email: form!.email.trim() || null,
        leadTimeDays: leadTime,
      }
      const saved = isCreate ? await api.post<Supplier>('/suppliers', payload) : await api.patch<Supplier>(`/suppliers/${supplier!.id}`, payload)
      toast.success(isCreate ? `Fornecedor "${saved.name}" adicionado` : `Fornecedor "${saved.name}" atualizado`)
      onSaved(saved)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível salvar o fornecedor')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      dismissible={false}
      title={isCreate ? 'Novo fornecedor' : 'Editar fornecedor'}
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={`${btnSecondary} flex-1`}>
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className={`${btnPrimary} flex-1`}>
            {saving ? 'Salvando...' : isCreate ? 'Adicionar' : 'Salvar'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="supplier-name" className={labelClass}>
            Nome
          </label>
          <input id="supplier-name" type="text" value={form.name} onChange={(e) => set({ name: e.target.value })} className={inputClass} placeholder="Ex: Distribuidora ABC" />
        </div>
        <div>
          <label htmlFor="supplier-cnpj" className={labelClass}>
            CNPJ
          </label>
          <input
            id="supplier-cnpj"
            type="text"
            inputMode="numeric"
            value={form.cnpj}
            onChange={(e) => set({ cnpj: formatCnpj(e.target.value) })}
            className={inputClass}
            placeholder="00.000.000/0000-00"
            maxLength={18}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="supplier-phone" className={labelClass}>
              Telefone / WhatsApp
            </label>
            <input id="supplier-phone" type="text" value={form.phone} onChange={(e) => set({ phone: e.target.value })} className={inputClass} placeholder="(00) 00000-0000" />
          </div>
          <div>
            <label htmlFor="supplier-lead" className={labelClass}>
              Prazo de entrega (dias)
            </label>
            <input
              id="supplier-lead"
              type="number"
              min={0}
              inputMode="numeric"
              value={form.leadTimeDays}
              onChange={(e) => set({ leadTimeDays: e.target.value })}
              className={inputClass}
              placeholder="7"
            />
          </div>
        </div>
        <div>
          <label htmlFor="supplier-email" className={labelClass}>
            Email
          </label>
          <input id="supplier-email" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} className={inputClass} placeholder="contato@fornecedor.com" />
        </div>
        <p className="text-xs text-gray-500">O prazo de entrega entra na sugestão de estoque mínimo pelo consumo.</p>
      </div>
    </Sheet>
  )
}
