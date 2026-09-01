import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { useToast } from '../context/ToastContext'
import type { Supplier } from '../types'
import { CloseIcon } from './icons'

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
}

function emptyForm(): FormState {
  return { name: '', cnpj: '', phone: '', email: '' }
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
    })
  }, [supplier, isCreate])

  if ((!isCreate && !supplier) || !form) return null

  async function handleSave() {
    if (!form!.name.trim()) {
      toast.error('Informe o nome do fornecedor')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: form!.name.trim(),
        cnpj: form!.cnpj.trim() || null,
        phone: form!.phone.trim() || null,
        email: form!.email.trim() || null,
      }
      const saved = isCreate
        ? await api.post<Supplier>('/suppliers', payload)
        : await api.patch<Supplier>(`/suppliers/${supplier!.id}`, payload)
      toast.success(isCreate ? `Fornecedor "${saved.name}" adicionado` : `Fornecedor "${saved.name}" atualizado`)
      onSaved(saved)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível salvar o fornecedor')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden"
      onClick={() => !saving && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <h2 className="text-base font-semibold text-gray-900">
            {isCreate ? 'Novo fornecedor' : 'Editar fornecedor'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-400 text-white transition hover:bg-gray-500 disabled:opacity-60"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Nome</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
              placeholder="Ex: Distribuidora ABC"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">CNPJ</label>
            <input
              type="text"
              inputMode="numeric"
              value={form.cnpj}
              onChange={(e) =>
                setForm((prev) => (prev ? { ...prev, cnpj: formatCnpj(e.target.value) } : prev))
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
              placeholder="00.000.000/0000-00"
              maxLength={18}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Telefone</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm((prev) => (prev ? { ...prev, phone: e.target.value } : prev))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
              placeholder="(00) 00000-0000"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => (prev ? { ...prev, email: e.target.value } : prev))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
              placeholder="contato@fornecedor.com"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-9 items-center justify-center rounded-lg bg-gray-400 px-4 text-sm font-semibold text-white transition hover:bg-gray-500 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex h-9 items-center justify-center rounded-lg bg-novamix-teal px-4 text-sm font-semibold text-white transition hover:bg-novamix-teal-dark disabled:opacity-60"
          >
            {saving ? 'Salvando...' : isCreate ? 'Adicionar' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
