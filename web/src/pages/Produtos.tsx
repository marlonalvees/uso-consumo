import { useEffect, useRef, useState } from 'react'
import { api, ApiError, assetUrl } from '../lib/api'
import type { Item, Supplier } from '../types'
import { CameraIcon, EditIcon, PlusIcon, SearchIcon, TrashIcon } from '../components/icons'
import { useToast } from '../context/ToastContext'
import { useCategories } from '../context/CategoriesContext'
import { usePackaging } from '../context/PackagingContext'
import ConfirmDialog from '../components/ConfirmDialog'
import ProductEditModal from '../components/ProductEditModal'
import PhotoLightbox from '../components/PhotoLightbox'
import { normalizeText } from '../lib/text'

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

interface PhotoCellProps {
  item: Item
  size?: 'sm' | 'lg'
  uploading: boolean
  onSelect: (item: Item, file: File) => void
  onRemove: (item: Item) => void
}

function PhotoCell({ item, size = 'sm', uploading, onSelect, onRemove }: PhotoCellProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [showLightbox, setShowLightbox] = useState(false)
  const dimension = size === 'lg' ? 'h-16 w-16' : 'h-12 w-12'

  function handleClick() {
    if (item.photoPath) {
      setShowLightbox(true)
    } else {
      inputRef.current?.click()
    }
  }

  return (
    <div className={`${dimension} shrink-0`}>
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
        onClick={handleClick}
        disabled={uploading}
        aria-label={item.photoPath ? `Ver foto de ${item.name}` : 'Adicionar foto'}
        className={`flex ${dimension} items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 text-gray-400 transition hover:border-novamix-teal disabled:opacity-60`}
      >
        {item.photoPath ? (
          <img src={assetUrl(item.photoPath)} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <CameraIcon className="h-5 w-5" />
        )}
      </button>

      <PhotoLightbox
        src={showLightbox && item.photoPath ? assetUrl(item.photoPath) : null}
        alt={item.name}
        onClose={() => setShowLightbox(false)}
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                setShowLightbox(false)
                inputRef.current?.click()
              }}
              className="rounded-lg bg-novamix-teal px-4 py-2 text-sm font-semibold text-white transition hover:bg-novamix-teal-dark"
            >
              Trocar foto
            </button>
            <button
              type="button"
              onClick={() => {
                setShowLightbox(false)
                onRemove(item)
              }}
              className="rounded-lg bg-red-base px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-base/90"
            >
              Remover foto
            </button>
          </>
        }
      />
    </div>
  )
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
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'ativo' | 'inativo'>('')

  const [creating, setCreating] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null)
  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null)

  function loadItems() {
    setLoading(true)
    Promise.all([api.get<Item[]>('/items'), api.get<Supplier[]>('/suppliers')])
      .then(([itemsData, suppliersData]) => {
        setItems(itemsData)
        setSuppliers(suppliersData)
      })
      .catch(() => toast.error('Não foi possível carregar os produtos'))
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadItems, [])

  function handleSaved(saved: Item) {
    setItems((prev) => {
      const exists = prev.some((i) => i.id === saved.id)
      const next = exists ? prev.map((i) => (i.id === saved.id ? saved : i)) : [...prev, saved]
      return next.sort((a, b) => a.name.localeCompare(b.name))
    })
    setEditingItem(null)
    setCreating(false)
  }

  async function handleToggleActive(item: Item) {
    setSavingId(item.id)
    try {
      const updated = await api.patch<Item>(`/items/${item.id}`, { active: !item.active })
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)))
      toast.success(`Produto "${updated.name}" marcado como ${updated.active ? 'ativo' : 'inativo'}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível atualizar o produto')
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

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    const item = deleteTarget
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

  const normalizedSearch = normalizeText(search)
  const filteredItems = items.filter((item) => {
    if (normalizedSearch && !normalizeText(item.name).includes(normalizedSearch)) return false
    if (categoryFilter && item.categoryId !== categoryFilter) return false
    if (supplierFilter && item.supplierId !== supplierFilter) return false
    if (statusFilter === 'ativo' && !item.active) return false
    if (statusFilter === 'inativo' && item.active) return false
    return true
  })

  const canCreate = categories.length > 0 && packagingList.length > 0

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        {!hideTitle && <h1 className="text-2xl font-semibold text-gray-900">Produtos</h1>}
        <button
          type="button"
          onClick={() => setCreating(true)}
          disabled={!canCreate}
          title={canCreate ? undefined : 'Cadastre ao menos uma categoria e uma embalagem antes de criar produtos'}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-novamix-orange px-4 py-2 text-sm font-semibold text-white transition hover:bg-novamix-orange-dark disabled:opacity-50"
        >
          <PlusIcon className="h-4 w-4" />
          Novo produto
        </button>
      </div>

      {!canCreate && (
        <p className="mb-4 text-sm text-amber-700">
          Cadastre ao menos uma categoria e uma embalagem antes de criar produtos.
        </p>
      )}

      {items.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
              <SearchIcon className="h-4 w-4" />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto por nome..."
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pr-3 pl-9 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal sm:max-w-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            >
              <option value="">Todas as categorias</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            >
              <option value="">Todos os fornecedores</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as '' | 'ativo' | 'inativo')}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            >
              <option value="">Ativos e inativos</option>
              <option value="ativo">Somente ativos</option>
              <option value="inativo">Somente inativos</option>
            </select>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-gray-500">Nenhum produto cadastrado.</p>
      ) : filteredItems.length === 0 ? (
        <p className="text-gray-500">Nenhum produto encontrado com esses filtros.</p>
      ) : (
        <>
          {/* Mobile: stacked cards, no horizontal scroll */}
          <ul className="space-y-3 md:hidden">
            {filteredItems.map((item) => {
              const lowStock = item.stockQuantity <= item.minStock
              return (
                <li
                  key={item.id}
                  className={`rounded-xl border border-gray-200 bg-white p-4 ${item.active ? '' : 'opacity-50'}`}
                >
                  <div className="flex items-start gap-3">
                    <PhotoCell
                      item={item}
                      size="lg"
                      uploading={uploadingPhotoId === item.id}
                      onSelect={handlePhotoSelect}
                      onRemove={handlePhotoRemove}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium wrap-break-word text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-500">{item.packaging.name}</p>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(item)}
                        disabled={savingId === item.id}
                        className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-medium disabled:opacity-60 ${
                          item.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {item.active ? 'Ativo' : 'Inativo'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-y-2 border-t border-gray-100 pt-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-400">Valor</p>
                      <p className="text-gray-900">{formatCurrency(item.price)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Estoque</p>
                      <p className={lowStock ? 'font-medium text-red-base' : 'text-gray-900'}>
                        {item.stockQuantity} <span className="text-gray-400">/ mín. {item.minStock}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Categoria</p>
                      <p className="wrap-break-word text-gray-900">{item.category.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Fornecedor</p>
                      <p className="wrap-break-word text-gray-900">{item.supplier?.name ?? '—'}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end gap-2 border-t border-gray-100 pt-3">
                    <button
                      type="button"
                      onClick={() => setEditingItem(item)}
                      aria-label="Editar"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-novamix-orange text-white transition hover:bg-novamix-orange-dark"
                    >
                      <EditIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      disabled={deletingId === item.id}
                      aria-label="Apagar"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-base text-white transition hover:bg-red-base/90 disabled:opacity-60"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
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
                {filteredItems.map((item) => {
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
                        <span className={`font-medium ${lowStock ? 'text-red-base' : 'text-gray-900'}`}>
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
                          onClick={() => setDeleteTarget(item)}
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
        </>
      )}

      <ProductEditModal
        item={editingItem}
        mode="edit"
        categories={categories}
        packagingList={packagingList}
        suppliers={suppliers}
        onClose={() => setEditingItem(null)}
        onSaved={handleSaved}
      />

      {creating && (
        <ProductEditModal
          item={null}
          mode="create"
          categories={categories}
          packagingList={packagingList}
          suppliers={suppliers}
          onClose={() => setCreating(false)}
          onSaved={handleSaved}
        />
      )}

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
