import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { useToast } from '../context/ToastContext'
import type { Category, Item, Packaging, Supplier } from '../types'
import { btnPrimary, btnSecondary, inputClass, labelClass, selectClass } from '../lib/ui'
import Sheet from './ui/Sheet'
import { CheckIcon, PlusIcon } from './icons'

interface ProductEditModalProps {
  item: Item | null
  mode?: 'create' | 'edit'
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
  targetStock: string
}

function emptyForm(defaultCategoryId: string, defaultPackagingId: string): FormState {
  return { name: '', packagingId: defaultPackagingId, price: '', categoryId: defaultCategoryId, supplierId: '', minStock: '0', targetStock: '' }
}

/** Cria categoria ou embalagem sem sair do cadastro do produto (são listas só com nome). */
function InlineCreate({ label, endpoint, onCreated }: { label: string; endpoint: string; onCreated: (created: { id: string; name: string }) => void }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function create() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const created = await api.post<{ id: string; name: string }>(endpoint, { name: name.trim() })
      onCreated(created)
      setName('')
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `Não foi possível criar ${label.toLowerCase()}`)
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-orange-base">
        <PlusIcon className="h-3.5 w-3.5" /> Nova {label.toLowerCase()}
      </button>
    )
  }
  return (
    <div className="mt-1.5 flex gap-1.5">
      <input
        type="text"
        value={name}
        autoFocus
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), create())}
        placeholder={`Nome da ${label.toLowerCase()}`}
        aria-label={`Nome da nova ${label.toLowerCase()}`}
        className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm"
      />
      <button type="button" onClick={create} disabled={saving} aria-label="Criar" className="press rounded-lg bg-gray-900 px-2.5 text-white">
        <CheckIcon className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function ProductEditModal({ item, mode = 'edit', categories, packagingList, suppliers, onClose, onSaved }: ProductEditModalProps) {
  const toast = useToast()
  const isCreate = mode === 'create'
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [categoryOptions, setCategoryOptions] = useState(categories)
  const [packagingOptions, setPackagingOptions] = useState(packagingList)

  useEffect(() => setCategoryOptions(categories), [categories])
  useEffect(() => setPackagingOptions(packagingList), [packagingList])

  useEffect(() => {
    if (isCreate) {
      setForm(emptyForm(categories[0]?.id ?? '', packagingList[0]?.id ?? ''))
      return
    }
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
      targetStock: item.targetStock !== null ? String(item.targetStock) : '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, isCreate])

  if ((!isCreate && !item) || !form) return null

  function set(change: Partial<FormState>) {
    setForm((prev) => (prev ? { ...prev, ...change } : prev))
  }

  async function handleSave() {
    if (!form!.name.trim()) {
      toast.error('Preencha o nome')
      return
    }
    if (!form!.packagingId || !form!.categoryId) {
      toast.error('Selecione a embalagem e a categoria')
      return
    }
    const price = form!.price.trim() === '' ? 0 : Number(form!.price.replace(',', '.'))
    if (!Number.isFinite(price) || price < 0) {
      toast.error('Informe um valor válido')
      return
    }
    const minStock = form!.minStock.trim() === '' ? 0 : Number(form!.minStock)
    const targetStock = form!.targetStock.trim() === '' ? null : Number(form!.targetStock)
    if (!Number.isInteger(minStock) || minStock < 0 || (targetStock !== null && (!Number.isInteger(targetStock) || targetStock < 0))) {
      toast.error('Estoque mínimo e ideal devem ser números inteiros')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: form!.name.trim(),
        packagingId: form!.packagingId,
        categoryId: form!.categoryId,
        supplierId: form!.supplierId || null,
        price,
        minStock,
        targetStock,
      }
      const saved = isCreate ? await api.post<Item>('/items', payload) : await api.patch<Item>(`/items/${item!.id}`, payload)
      toast.success(isCreate ? `Produto "${saved.name}" adicionado` : `Produto "${saved.name}" atualizado`)
      onSaved(saved)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível salvar o produto')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      dismissible={false}
      title={isCreate ? 'Novo produto' : 'Editar produto'}
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
          <label htmlFor="product-name" className={labelClass}>
            Nome
          </label>
          <input id="product-name" type="text" value={form.name} onChange={(e) => set({ name: e.target.value })} className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="product-packaging" className={labelClass}>
              Embalagem
            </label>
            <select id="product-packaging" value={form.packagingId} onChange={(e) => set({ packagingId: e.target.value })} className={`${selectClass} w-full`}>
              {packagingOptions.map((packaging) => (
                <option key={packaging.id} value={packaging.id}>
                  {packaging.name}
                </option>
              ))}
            </select>
            <InlineCreate
              label="Embalagem"
              endpoint="/packaging"
              onCreated={(created) => {
                setPackagingOptions((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
                set({ packagingId: created.id })
              }}
            />
          </div>
          <div>
            <label htmlFor="product-category" className={labelClass}>
              Categoria
            </label>
            <select id="product-category" value={form.categoryId} onChange={(e) => set({ categoryId: e.target.value })} className={`${selectClass} w-full`}>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <InlineCreate
              label="Categoria"
              endpoint="/categories"
              onCreated={(created) => {
                setCategoryOptions((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
                set({ categoryId: created.id })
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="product-price" className={labelClass}>
              Custo médio (R$)
            </label>
            <input
              id="product-price"
              type="text"
              inputMode="decimal"
              value={form.price}
              onChange={(e) => set({ price: e.target.value })}
              className={inputClass}
              placeholder="0,00"
            />
          </div>
          <div>
            <label htmlFor="product-supplier" className={labelClass}>
              Fornecedor
            </label>
            <select id="product-supplier" value={form.supplierId} onChange={(e) => set({ supplierId: e.target.value })} className={`${selectClass} w-full`}>
              <option value="">Sem fornecedor</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="-mt-2 text-xs text-gray-500">O custo médio se atualiza sozinho a cada compra recebida com custo. Aqui é só o valor inicial.</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="product-min" className={labelClass}>
              Estoque mínimo
            </label>
            <input id="product-min" type="number" min={0} step={1} value={form.minStock} onChange={(e) => set({ minStock: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="product-target" className={labelClass}>
              Estoque ideal
            </label>
            <input
              id="product-target"
              type="number"
              min={0}
              step={1}
              value={form.targetStock}
              onChange={(e) => set({ targetStock: e.target.value })}
              placeholder="2× o mínimo"
              className={inputClass}
            />
          </div>
        </div>
      </div>
    </Sheet>
  )
}
