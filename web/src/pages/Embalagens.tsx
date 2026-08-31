import { useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { Packaging } from '../types'
import { CheckIcon, CloseIcon, EditIcon, TrashIcon } from '../components/icons'
import { useToast } from '../context/ToastContext'
import { usePackaging } from '../context/PackagingContext'
import ConfirmDialog from '../components/ConfirmDialog'

interface EmbalagensProps {
  hideTitle?: boolean
}

export default function Embalagens({ hideTitle = false }: EmbalagensProps = {}) {
  const { packagingList, loadingPackaging, refreshPackaging } = usePackaging()
  const toast = useToast()

  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Packaging | null>(null)

  async function handleCreate() {
    if (!name.trim()) {
      toast.error('Informe o nome da embalagem')
      return
    }
    setCreating(true)
    try {
      await api.post<Packaging>('/packaging', { name: name.trim() })
      await refreshPackaging()
      setName('')
      toast.success('Embalagem adicionada')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível criar a embalagem')
    } finally {
      setCreating(false)
    }
  }

  function startEdit(packaging: Packaging) {
    setEditingId(packaging.id)
    setEditName(packaging.name)
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) {
      toast.error('Informe o nome da embalagem')
      return
    }
    setSavingId(id)
    try {
      await api.patch<Packaging>(`/packaging/${id}`, { name: editName.trim() })
      await refreshPackaging()
      setEditingId(null)
      toast.success('Embalagem atualizada')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível salvar a embalagem')
    } finally {
      setSavingId(null)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeletingId(deleteTarget.id)
    try {
      await api.delete(`/packaging/${deleteTarget.id}`)
      await refreshPackaging()
      toast.success('Embalagem apagada')
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível apagar a embalagem')
    } finally {
      setDeletingId(null)
    }
  }

  if (loadingPackaging) {
    return <p className="text-gray-500">Carregando embalagens...</p>
  }

  return (
    <div>
      {!hideTitle && <h1 className="mb-4 text-2xl font-semibold text-gray-900">Embalagens</h1>}

      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-500">Nova embalagem</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Galão"
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

      {packagingList.length === 0 ? (
        <p className="text-gray-500">Nenhuma embalagem cadastrada.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
          {packagingList.map((packaging) => {
            const isEditing = editingId === packaging.id
            return (
              <li key={packaging.id} className="flex items-center gap-3 px-4 py-3">
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
                      onClick={() => handleSaveEdit(packaging.id)}
                      disabled={savingId === packaging.id}
                      aria-label="Salvar"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-novamix-teal text-white transition hover:bg-novamix-teal-dark disabled:opacity-60"
                    >
                      <CheckIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      aria-label="Cancelar"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-400 text-white transition hover:bg-gray-500"
                    >
                      <CloseIcon className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-medium text-gray-900">{packaging.name}</span>
                    <button
                      type="button"
                      onClick={() => startEdit(packaging)}
                      aria-label="Editar"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-novamix-orange text-white transition hover:bg-novamix-orange-dark"
                    >
                      <EditIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(packaging)}
                      disabled={deletingId === packaging.id}
                      aria-label="Apagar"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-base text-white transition hover:bg-red-base/90 disabled:opacity-60"
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
        title="Apagar embalagem"
        message={
          <>
            Tem certeza que deseja apagar <strong>"{deleteTarget?.name}"</strong>? Não é possível
            apagar embalagens que já têm produtos.
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
