import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { useToast } from '../context/ToastContext'
import type { Category, Item, Packaging, Supplier } from '../types'
import { CloseIcon } from './icons'

interface ProductEditModalProps {
  item: Item | null
  categories: Category[]
  packagingList: Packaging[]
  suppliers: Supplier[]
  onClose: () => void
  onSaved: (item: Item) => void
}

interface FormState {
  name: string
  packagingId: string
  price: string
  categoryId: string
  supplierId: string
  minStock: string
}

export default function ProductEditModal({
  item,
  categories,
  packagingList,
  suppliers,
  onClose,
  onSaved,
}: ProductEditModalProps) {
  const toast = useToast()
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!item) {
      setForm(null)
      return
    }
    setForm({
      name: item.name,
      packagingId: item.packagingId,
      price: String(item.price),
      categoryId: item.categoryId,
      supplierId: item.supplierId ?? '',
      minStock: String(item.minStock),
    })
  }, [item])

  if (!item || !form) return null

  async function handleSave() {
    if (!form!.name.trim()) {
      toast.error('Preencha o nome')
      return
    }
    if (!form!.packagingId) {
      toast.error('Selecione uma embalagem')
      return
    }
    if (!form!.categoryId) {
      toast.error('Selecione uma categoria')
      return
    }
    const price = form!.price.trim() === '' ? 0 : Number(form!.price)
    if (!Number.isFinite(price) || price < 0) {
      toast.error('Informe um valor válido')
      return
    }
    const minStock = form!.minStock.trim() === '' ? 0 : Number(form!.minStock)
    if (!Number.isInteger(minStock) || minStock < 0) {
      toast.error('Estoque mínimo deve ser um número inteiro maior ou igual a 0')
      return
    }

    setSaving(true)
    try {
      const updated = await api.patch<Item>(`/items/${item!.id}`, {
        name: form!.name.trim(),
        packagingId: form!.packagingId,
        categoryId: form!.categoryId,
        supplierId: form!.supplierId || null,
        price,
        minStock,
      })
      toast.success(`Produto "${updated.name}" atualizado`)
      onSaved(updated)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível salvar o produto')
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
          <h2 className="text-base font-semibold text-gray-900">Editar produto</h2>
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
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Embalagem</label>
              <select
                value={form.packagingId}
                onChange={(e) =>
                  setForm((prev) => (prev ? { ...prev, packagingId: e.target.value } : prev))
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
              >
                {packagingList.map((packaging) => (
                  <option key={packaging.id} value={packaging.id}>
                    {packaging.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Valor</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400">
                  R$
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) =>
                    setForm((prev) => (prev ? { ...prev, price: e.target.value } : prev))
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pr-3 pl-9 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Categoria</label>
              <select
                value={form.categoryId}
                onChange={(e) =>
                  setForm((prev) => (prev ? { ...prev, categoryId: e.target.value } : prev))
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Fornecedor</label>
              <select
                value={form.supplierId}
                onChange={(e) =>
                  setForm((prev) => (prev ? { ...prev, supplierId: e.target.value } : prev))
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
              >
                <option value="">Sem fornecedor</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="w-1/2 pr-1.5">
            <label className="mb-1 block text-xs font-medium text-gray-500">Estoque mínimo</label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.minStock}
              onChange={(e) =>
                setForm((prev) => (prev ? { ...prev, minStock: e.target.value } : prev))
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
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
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
