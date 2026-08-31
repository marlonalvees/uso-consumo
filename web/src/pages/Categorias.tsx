import { useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { Category } from '../types'
import { CheckIcon, CloseIcon, EditIcon, TrashIcon } from '../components/icons'
import { useToast } from '../context/ToastContext'
import { useCategories } from '../context/CategoriesContext'
import ConfirmDialog from '../components/ConfirmDialog'

interface CategoriasProps {
  hideTitle?: boolean
}

export default function Categorias({ hideTitle = false }: CategoriasProps = {}) {
  const { categories, loadingCategories, refreshCategories } = useCategories()
  const toast = useToast()

  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)

  async function handleCreate() {
    if (!name.trim()) {
      toast.error('Informe o nome da categoria')
      return
    }
    setCreating(true)
    try {
      await api.post<Category>('/categories', { name: name.trim() })
      await refreshCategories()
      setName('')
      toast.success('Categoria adicionada')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível criar a categoria')
    } finally {
      setCreating(false)
    }
  }

  function startEdit(category: Category) {
    setEditingId(category.id)
    setEditName(category.name)
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) {
      toast.error('Informe o nome da categoria')
      return
    }
    setSavingId(id)
    try {
      await api.patch<Category>(`/categories/${id}`, { name: editName.trim() })
      await refreshCategories()
      setEditingId(null)
      toast.success('Categoria atualizada')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível salvar a categoria')
    } finally {
      setSavingId(null)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeletingId(deleteTarget.id)
    try {
      await api.delete(`/categories/${deleteTarget.id}`)
      await refreshCategories()
      toast.success('Categoria apagada')
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível apagar a categoria')
    } finally {
      setDeletingId(null)
    }
  }

  if (loadingCategories) {
    return <p className="text-gray-500">Carregando categorias...</p>
  }

  return (
    <div>
      {!hideTitle && <h1 className="mb-4 text-2xl font-semibold text-gray-900">Categorias</h1>}

      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-500">Nova categoria</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Papelaria"
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

      {categories.length === 0 ? (
        <p className="text-gray-500">Nenhuma categoria cadastrada.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
          {categories.map((category) => {
            const isEditing = editingId === category.id
            return (
              <li key={category.id} className="flex items-center gap-3 px-4 py-3">
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(category.id)}
                      disabled={savingId === category.id}
                      aria-label="Salvar"
                      className="inline-flex items-center justify-center rounded-lg p-2 text-novamix-teal transition hover:bg-novamix-teal/10 disabled:opacity-60"
                    >
                      <CheckIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      aria-label="Cancelar"
                      className="inline-flex items-center justify-center rounded-lg p-2 text-gray-500 transition hover:bg-gray-100"
                    >
                      <CloseIcon className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-medium text-gray-900">{category.name}</span>
                    <button
                      type="button"
                      onClick={() => startEdit(category)}
                      aria-label="Editar"
                      className="inline-flex items-center justify-center rounded-lg p-2 text-novamix-orange transition hover:bg-novamix-orange/10"
                    >
                      <EditIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(category)}
                      disabled={deletingId === category.id}
                      aria-label="Apagar"
                      className="inline-flex items-center justify-center rounded-lg p-2 text-black transition hover:bg-gray-100 disabled:opacity-60"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Apagar categoria"
        message={
          <>
            Tem certeza que deseja apagar <strong>"{deleteTarget?.name}"</strong>? Não é possível
            apagar categorias que já têm produtos.
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
