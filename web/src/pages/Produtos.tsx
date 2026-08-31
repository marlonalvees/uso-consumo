import { useEffect, useRef, useState } from 'react'
import { api, ApiError, assetUrl } from '../lib/api'
import type { Item, Supplier } from '../types'
import { CameraIcon, CloseIcon, EditIcon, TrashIcon } from '../components/icons'
import { useToast } from '../context/ToastContext'
import { useCategories } from '../context/CategoriesContext'
import { usePackaging } from '../context/PackagingContext'
import ConfirmDialog from '../components/ConfirmDialog'
import ProductEditModal from '../components/ProductEditModal'

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

interface PhotoCellProps {
  item: Item
  uploading: boolean
  onSelect: (item: Item, file: File) => void
  onRemove: (item: Item) => void
}

function PhotoCell({ item, uploading, onSelect, onRemove }: PhotoCellProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="group relative h-12 w-12 shrink-0">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onSelect(item, file)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label={item.photoPath ? 'Trocar foto' : 'Adicionar foto'}
        className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 text-gray-400 transition hover:border-novamix-teal disabled:opacity-60"
      >
        {item.photoPath ? (
          <img src={assetUrl(item.photoPath)} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <CameraIcon className="h-5 w-5" />
        )}
      </button>
      {item.photoPath && !uploading && (
        <button
          type="button"
          onClick={() => onRemove(item)}
          aria-label="Remover foto"
          className="absolute -top-1.5 -right-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-red-base text-white shadow-sm group-hover:flex"
        >
          <CloseIcon className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

interface ItemFormState {
  name: string
  packagingId: string
  price: string
  categoryId: string
  supplierId: string
  minStock: string
}

function emptyForm(defaultCategoryId: string, defaultPackagingId: string): ItemFormState {
  return {
    name: '',
    packagingId: defaultPackagingId,
    price: '',
    categoryId: defaultCategoryId,
    supplierId: '',
    minStock: '0',
  }
}

interface ProdutosProps {
  hideTitle?: boolean
}

export default function Produtos({ hideTitle = false }: ProdutosProps = {}) {
  const { categories } = useCategories()
  const { packagingList } = usePackaging()
  const [items, setItems] = useState<Item[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newItem, setNewItem] = useState<ItemFormState>(emptyForm('', ''))
  const [creating, setCreating] = useState(false)

  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null)
  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null)
  const toast = useToast()

  function loadItems() {
    setLoading(true)
    Promise.all([api.get<Item[]>('/items'), api.get<Supplier[]>('/suppliers')])
      .then(([itemsData, suppliersData]) => {
        setItems(itemsData)
        setSuppliers(suppliersData)
      })
      .catch(() => setError('Não foi possível carregar os produtos'))
      .finally(() => setLoading(false))
  }

  useEffect(loadItems, [])

  useEffect(() => {
    if (categories.length > 0 && !newItem.categoryId) {
      setNewItem((prev) => ({ ...prev, categoryId: categories[0].id }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories])

  useEffect(() => {
    if (packagingList.length > 0 && !newItem.packagingId) {
      setNewItem((prev) => ({ ...prev, packagingId: packagingList[0].id }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packagingList])

  function parseAndValidate(form: ItemFormState): { name: string; price: number; minStock: number } | null {
    if (!form.name.trim()) {
      setError('Preencha o nome')
      return null
    }
    if (!form.packagingId) {
      setError('Selecione uma embalagem')
      return null
    }
    const price = form.price.trim() === '' ? 0 : Number(form.price)
    if (!Number.isFinite(price) || price < 0) {
      setError('Informe um valor válido')
      return null
    }
    const minStock = form.minStock.trim() === '' ? 0 : Number(form.minStock)
    if (!Number.isInteger(minStock) || minStock < 0) {
      setError('Estoque mínimo deve ser um número inteiro maior ou igual a 0')
      return null
    }
    if (!form.categoryId) {
      setError('Selecione uma categoria')
      return null
    }
    return { name: form.name.trim(), price, minStock }
  }

  async function handleCreate() {
    setError(null)
    const parsed = parseAndValidate(newItem)
    if (!parsed) return

    setCreating(true)
    try {
      const created = await api.post<Item>('/items', {
        ...parsed,
        categoryId: newItem.categoryId,
        packagingId: newItem.packagingId,
        supplierId: newItem.supplierId || undefined,
      })
      setItems((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setNewItem(emptyForm(newItem.categoryId, newItem.packagingId))
      toast.success(`Produto "${created.name}" adicionado`)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Não foi possível criar o produto'
      setError(message)
      toast.error(message)
    } finally {
      setCreating(false)
    }
  }

  function handleEditSaved(updated: Item) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
    setEditingItem(null)
  }

  async function handleToggleActive(item: Item) {
    setError(null)
    setSavingId(item.id)
    try {
      const updated = await api.patch<Item>(`/items/${item.id}`, { active: !item.active })
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)))
      toast.success(`Produto "${updated.name}" marcado como ${updated.active ? 'ativo' : 'inativo'}`)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Não foi possível atualizar o produto'
      setError(message)
      toast.error(message)
    } finally {
      setSavingId(null)
    }
  }

  async function handlePhotoSelect(item: Item, file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande — máximo 5MB')
      return
    }
    setUploadingPhotoId(item.id)
    try {
      const formData = new FormData()
      formData.append('photo', file)
      const updated = await api.upload<Item>(`/items/${item.id}/photo`, formData)
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)))
      toast.success('Foto atualizada')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível enviar a foto')
    } finally {
      setUploadingPhotoId(null)
    }
  }

  async function handlePhotoRemove(item: Item) {
    setUploadingPhotoId(item.id)
    try {
      const updated = await api.delete<Item>(`/items/${item.id}/photo`)
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)))
      toast.success('Foto removida')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível remover a foto')
    } finally {
      setUploadingPhotoId(null)
    }
  }

  function handleDelete(item: Item) {
    setDeleteTarget(item)
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    const item = deleteTarget
    setError(null)
    setDeletingId(item.id)
    try {
      const result = await api.delete<(Item & { warning?: string }) | null>(`/items/${item.id}`)
      if (result?.warning) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? result : i)))
        toast.error(result.warning)
      } else {
        setItems((prev) => prev.filter((i) => i.id !== item.id))
        toast.success(`Produto "${item.name}" apagado`)
      }
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível apagar o produto')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return <p className="text-gray-500">Carregando produtos...</p>
  }

  return (
    <div>
      {!hideTitle && <h1 className="mb-4 text-2xl font-semibold text-gray-900">Produtos</h1>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {categories.length === 0 || packagingList.length === 0 ? (
        <p className="mb-4 text-sm text-amber-700">
          Cadastre ao menos uma categoria e uma embalagem antes de criar produtos.
        </p>
      ) : (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-novamix-teal-dark">
            Novo produto
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex-1 sm:min-w-40">
              <label className="mb-1 block text-xs font-medium text-gray-500">Nome</label>
              <input
                type="text"
                value={newItem.name}
                onChange={(e) => setNewItem((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
                placeholder="Ex: Papel A4"
              />
            </div>
            <div className="sm:w-32">
              <label className="mb-1 block text-xs font-medium text-gray-500">Embalagem</label>
              <select
                value={newItem.packagingId}
                onChange={(e) => setNewItem((prev) => ({ ...prev, packagingId: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
              >
                {packagingList.map((packaging) => (
                  <option key={packaging.id} value={packaging.id}>
                    {packaging.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:w-28">
              <label className="mb-1 block text-xs font-medium text-gray-500">Valor</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400">
                  R$
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newItem.price}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, price: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pr-3 pl-9 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
                  placeholder="0,00"
                />
              </div>
            </div>
            <div className="sm:w-40">
              <label className="mb-1 block text-xs font-medium text-gray-500">Categoria</label>
              <select
                value={newItem.categoryId}
                onChange={(e) => setNewItem((prev) => ({ ...prev, categoryId: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:w-40">
              <label className="mb-1 block text-xs font-medium text-gray-500">Fornecedor</label>
              <select
                value={newItem.supplierId}
                onChange={(e) => setNewItem((prev) => ({ ...prev, supplierId: e.target.value }))}
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
            <div className="sm:w-28">
              <label className="mb-1 block text-xs font-medium text-gray-500">Estoque mín.</label>
              <input
                type="number"
                min="0"
                step="1"
                value={newItem.minStock}
                onChange={(e) => setNewItem((prev) => ({ ...prev, minStock: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
              />
            </div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="rounded-lg bg-novamix-orange px-4 py-2 text-sm font-semibold text-white transition hover:bg-novamix-orange-dark disabled:opacity-60"
            >
              {creating ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-gray-500">Nenhum produto cadastrado.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Foto</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Nome</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Embalagem</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Valor</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Categoria</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Fornecedor</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Estoque</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item) => {
                const lowStock = item.stockQuantity <= item.minStock
                return (
                  <tr key={item.id} className={item.active ? '' : 'opacity-50'}>
                    <td className="px-4 py-3">
                      <PhotoCell
                        item={item}
                        uploading={uploadingPhotoId === item.id}
                        onSelect={handlePhotoSelect}
                        onRemove={handlePhotoRemove}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                    <td className="px-4 py-3 text-gray-600">{item.packaging.name}</td>
                    <td className="px-4 py-3 text-gray-600">{formatCurrency(item.price)}</td>
                    <td className="px-4 py-3 text-gray-600">{item.category.name}</td>
                    <td className="px-4 py-3 text-gray-600">{item.supplier?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-medium ${lowStock ? 'text-red-base' : 'text-gray-900'}`}
                      >
                        {item.stockQuantity}
                      </span>
                      <span className="text-gray-400"> / mín. {item.minStock}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(item)}
                        disabled={savingId === item.id}
                        className={`inline-block rounded-full px-3 py-1 text-xs font-medium disabled:opacity-60 ${
                          item.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {item.active ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingItem(item)}
                        aria-label="Editar"
                        className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-novamix-orange text-white transition hover:bg-novamix-orange-dark"
                      >
                        <EditIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        disabled={deletingId === item.id}
                        aria-label="Apagar"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-base text-white transition hover:bg-red-base/90 disabled:opacity-60"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ProductEditModal
        item={editingItem}
        categories={categories}
        packagingList={packagingList}
        suppliers={suppliers}
        onClose={() => setEditingItem(null)}
        onSaved={handleEditSaved}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Apagar produto"
        message={
          <>
            Tem certeza que deseja apagar <strong>"{deleteTarget?.name}"</strong>? Se o produto já
            foi usado em algum pedido, ele será apenas desativado.
          </>
        }
        confirmLabel="Apagar"
        danger
        loading={deletingId === deleteTarget?.id}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
