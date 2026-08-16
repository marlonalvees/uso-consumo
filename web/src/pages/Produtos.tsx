import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { Item, ItemCategory } from '../types'
import { CheckIcon, CloseIcon, EditIcon, TrashIcon } from '../components/icons'

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  PAPELARIA: 'Papelaria',
  LIMPEZA: 'Limpeza',
}

const CATEGORY_OPTIONS: ItemCategory[] = ['PAPELARIA', 'LIMPEZA']

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

interface ItemFormState {
  name: string
  unit: string
  price: string
  category: ItemCategory
}

function emptyForm(): ItemFormState {
  return { name: '', unit: '', price: '', category: 'LIMPEZA' }
}

interface ProdutosProps {
  hideTitle?: boolean
}

export default function Produtos({ hideTitle = false }: ProdutosProps = {}) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newItem, setNewItem] = useState<ItemFormState>(emptyForm())
  const [creating, setCreating] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ItemFormState>(emptyForm())
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function loadItems() {
    setLoading(true)
    api
      .get<Item[]>('/items')
      .then(setItems)
      .catch(() => setError('Não foi possível carregar os produtos'))
      .finally(() => setLoading(false))
  }

  useEffect(loadItems, [])

  async function handleCreate() {
    setError(null)
    if (!newItem.name.trim() || !newItem.unit.trim()) {
      setError('Preencha nome e unidade')
      return
    }
    const price = newItem.price.trim() === '' ? 0 : Number(newItem.price)
    if (!Number.isFinite(price) || price < 0) {
      setError('Informe um valor válido')
      return
    }
    setCreating(true)
    try {
      const created = await api.post<Item>('/items', {
        name: newItem.name.trim(),
        unit: newItem.unit.trim(),
        category: newItem.category,
        price,
      })
      setItems((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setNewItem(emptyForm())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar o produto')
    } finally {
      setCreating(false)
    }
  }

  function startEdit(item: Item) {
    setEditingId(item.id)
    setEditForm({ name: item.name, unit: item.unit, price: String(item.price), category: item.category })
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleSaveEdit(id: string) {
    setError(null)
    if (!editForm.name.trim() || !editForm.unit.trim()) {
      setError('Preencha nome e unidade')
      return
    }
    const price = editForm.price.trim() === '' ? 0 : Number(editForm.price)
    if (!Number.isFinite(price) || price < 0) {
      setError('Informe um valor válido')
      return
    }
    setSavingId(id)
    try {
      const updated = await api.patch<Item>(`/items/${id}`, {
        name: editForm.name.trim(),
        unit: editForm.unit.trim(),
        category: editForm.category,
        price,
      })
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)))
      setEditingId(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o produto')
    } finally {
      setSavingId(null)
    }
  }

  async function handleToggleActive(item: Item) {
    setError(null)
    setSavingId(item.id)
    try {
      const updated = await api.patch<Item>(`/items/${item.id}`, { active: !item.active })
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível atualizar o produto')
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete(item: Item) {
    if (!window.confirm(`Apagar "${item.name}"?`)) return
    setError(null)
    setDeletingId(item.id)
    try {
      const result = await api.delete<(Item & { warning?: string }) | null>(`/items/${item.id}`)
      if (result?.warning) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? result : i)))
        setError(result.warning)
      } else {
        setItems((prev) => prev.filter((i) => i.id !== item.id))
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível apagar o produto')
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

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-novamix-teal-dark">
          Novo produto
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
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
            <label className="mb-1 block text-xs font-medium text-gray-500">Unidade</label>
            <input
              type="text"
              value={newItem.unit}
              onChange={(e) => setNewItem((prev) => ({ ...prev, unit: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
              placeholder="Ex: pacote"
            />
          </div>
          <div className="sm:w-32">
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
              value={newItem.category}
              onChange={(e) =>
                setNewItem((prev) => ({ ...prev, category: e.target.value as ItemCategory }))
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
            >
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
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

      {items.length === 0 ? (
        <p className="text-gray-500">Nenhum produto cadastrado.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Nome</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Unidade</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Valor</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Categoria</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item) => {
                const isEditing = editingId === item.id
                return (
                  <tr key={item.id} className={item.active ? '' : 'opacity-50'}>
                    {isEditing ? (
                      <>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, name: e.target.value }))
                            }
                            className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={editForm.unit}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, unit: e.target.value }))
                            }
                            className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <div className="relative">
                            <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-gray-400">
                              R$
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editForm.price}
                              onChange={(e) =>
                                setEditForm((prev) => ({ ...prev, price: e.target.value }))
                              }
                              className="w-full rounded-lg border border-gray-300 bg-white py-1 pr-2 pl-7 text-sm"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={editForm.category}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                category: e.target.value as ItemCategory,
                              }))
                            }
                            className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm"
                          >
                            {CATEGORY_OPTIONS.map((category) => (
                              <option key={category} value={category}>
                                {CATEGORY_LABELS[category]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2 text-gray-500">
                          {item.active ? 'Ativo' : 'Inativo'}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(item.id)}
                            disabled={savingId === item.id}
                            aria-label="Salvar"
                            className="mr-3 inline-flex items-center justify-center rounded-lg p-1.5 text-novamix-teal transition hover:bg-novamix-teal/10 disabled:opacity-60"
                          >
                            <CheckIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            aria-label="Cancelar"
                            className="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100"
                          >
                            <CloseIcon className="h-4 w-4" />
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                        <td className="px-4 py-3 text-gray-600">{item.unit}</td>
                        <td className="px-4 py-3 text-gray-600">{formatCurrency(item.price)}</td>
                        <td className="px-4 py-3 text-gray-600">{CATEGORY_LABELS[item.category]}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(item)}
                            disabled={savingId === item.id}
                            className={`inline-block rounded-full px-3 py-1 text-xs font-medium disabled:opacity-60 ${
                              item.active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {item.active ? 'Ativo' : 'Inativo'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            aria-label="Editar"
                            className="mr-3 inline-flex items-center justify-center rounded-lg p-1.5 text-novamix-orange transition hover:bg-novamix-orange/10"
                          >
                            <EditIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            disabled={deletingId === item.id}
                            aria-label="Apagar"
                            className="inline-flex items-center justify-center rounded-lg p-1.5 text-black transition hover:bg-gray-100 disabled:opacity-60"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
