import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { Supplier } from '../types'
import { CheckIcon, CloseIcon, EditIcon, TrashIcon } from '../components/icons'
import { useToast } from '../context/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'

interface SupplierFormState {
  name: string
  cnpj: string
  phone: string
  email: string
}

function emptyForm(): SupplierFormState {
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

interface FornecedoresProps {
  hideTitle?: boolean
}

export default function Fornecedores({ hideTitle = false }: FornecedoresProps = {}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const [newSupplier, setNewSupplier] = useState<SupplierFormState>(emptyForm())
  const [creating, setCreating] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<SupplierFormState>(emptyForm())
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null)

  function loadSuppliers() {
    setLoading(true)
    api
      .get<Supplier[]>('/suppliers')
      .then(setSuppliers)
      .catch(() => toast.error('Não foi possível carregar os fornecedores'))
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadSuppliers, [])

  async function handleCreate() {
    if (!newSupplier.name.trim()) {
      toast.error('Informe o nome do fornecedor')
      return
    }
    setCreating(true)
    try {
      const created = await api.post<Supplier>('/suppliers', {
        name: newSupplier.name.trim(),
        cnpj: newSupplier.cnpj.trim() || undefined,
        phone: newSupplier.phone.trim() || undefined,
        email: newSupplier.email.trim() || undefined,
      })
      setSuppliers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setNewSupplier(emptyForm())
      toast.success(`Fornecedor "${created.name}" adicionado`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível criar o fornecedor')
    } finally {
      setCreating(false)
    }
  }

  function startEdit(supplier: Supplier) {
    setEditingId(supplier.id)
    setEditForm({
      name: supplier.name,
      cnpj: supplier.cnpj ?? '',
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
    })
  }

  async function handleSaveEdit(id: string) {
    if (!editForm.name.trim()) {
      toast.error('Informe o nome do fornecedor')
      return
    }
    setSavingId(id)
    try {
      const updated = await api.patch<Supplier>(`/suppliers/${id}`, {
        name: editForm.name.trim(),
        cnpj: editForm.cnpj.trim() || null,
        phone: editForm.phone.trim() || null,
        email: editForm.email.trim() || null,
      })
      setSuppliers((prev) => prev.map((s) => (s.id === id ? updated : s)))
      setEditingId(null)
      toast.success(`Fornecedor "${updated.name}" atualizado`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível salvar o fornecedor')
    } finally {
      setSavingId(null)
    }
  }

  async function handleToggleActive(supplier: Supplier) {
    setSavingId(supplier.id)
    try {
      const updated = await api.patch<Supplier>(`/suppliers/${supplier.id}`, { active: !supplier.active })
      setSuppliers((prev) => prev.map((s) => (s.id === supplier.id ? updated : s)))
      toast.success(`Fornecedor "${updated.name}" marcado como ${updated.active ? 'ativo' : 'inativo'}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível atualizar o fornecedor')
    } finally {
      setSavingId(null)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    const supplier = deleteTarget
    setDeletingId(supplier.id)
    try {
      const result = await api.delete<(Supplier & { warning?: string }) | null>(`/suppliers/${supplier.id}`)
      if (result?.warning) {
        setSuppliers((prev) => prev.map((s) => (s.id === supplier.id ? result : s)))
        toast.error(result.warning)
      } else {
        setSuppliers((prev) => prev.filter((s) => s.id !== supplier.id))
        toast.success(`Fornecedor "${supplier.name}" apagado`)
      }
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível apagar o fornecedor')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return <p className="text-gray-500">Carregando fornecedores...</p>
  }

  return (
    <div>
      {!hideTitle && <h1 className="mb-4 text-2xl font-semibold text-gray-900">Fornecedores</h1>}

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-novamix-teal-dark">
          Novo fornecedor
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500">Nome</label>
            <input
              type="text"
              value={newSupplier.name}
              onChange={(e) => setNewSupplier((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
              placeholder="Ex: Distribuidora ABC"
            />
          </div>
          <div className="sm:w-44">
            <label className="mb-1 block text-xs font-medium text-gray-500">CNPJ</label>
            <input
              type="text"
              inputMode="numeric"
              value={newSupplier.cnpj}
              onChange={(e) => setNewSupplier((prev) => ({ ...prev, cnpj: formatCnpj(e.target.value) }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
              placeholder="00.000.000/0000-00"
              maxLength={18}
            />
          </div>
          <div className="sm:w-40">
            <label className="mb-1 block text-xs font-medium text-gray-500">Telefone</label>
            <input
              type="text"
              value={newSupplier.phone}
              onChange={(e) => setNewSupplier((prev) => ({ ...prev, phone: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className="sm:w-56">
            <label className="mb-1 block text-xs font-medium text-gray-500">Email</label>
            <input
              type="email"
              value={newSupplier.email}
              onChange={(e) => setNewSupplier((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal"
              placeholder="contato@fornecedor.com"
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

      {suppliers.length === 0 ? (
        <p className="text-gray-500">Nenhum fornecedor cadastrado.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Nome</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">CNPJ</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Telefone</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Email</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {suppliers.map((supplier) => {
                const isEditing = editingId === supplier.id
                return (
                  <tr key={supplier.id} className={supplier.active ? '' : 'opacity-50'}>
                    {isEditing ? (
                      <>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                            className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={editForm.cnpj}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, cnpj: formatCnpj(e.target.value) }))
                            }
                            className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm"
                            maxLength={18}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={editForm.phone}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                            className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="email"
                            value={editForm.email}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                            className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2 text-gray-500">
                          {supplier.active ? 'Ativo' : 'Inativo'}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(supplier.id)}
                            disabled={savingId === supplier.id}
                            aria-label="Salvar"
                            className="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-novamix-teal text-white transition hover:bg-novamix-teal-dark disabled:opacity-60"
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
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium text-gray-900">{supplier.name}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {supplier.cnpj ? formatCnpj(supplier.cnpj) : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{supplier.phone ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{supplier.email ?? '—'}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(supplier)}
                            disabled={savingId === supplier.id}
                            className={`inline-block rounded-full px-3 py-1 text-xs font-medium disabled:opacity-60 ${
                              supplier.active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {supplier.active ? 'Ativo' : 'Inativo'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => startEdit(supplier)}
                            aria-label="Editar"
                            className="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-novamix-orange text-white transition hover:bg-novamix-orange-dark"
                          >
                            <EditIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(supplier)}
                            disabled={deletingId === supplier.id}
                            aria-label="Apagar"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-base text-white transition hover:bg-red-base/90 disabled:opacity-60"
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

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Apagar fornecedor"
        message={
          <>
            Tem certeza que deseja apagar <strong>"{deleteTarget?.name}"</strong>? Se ele já estiver
            vinculado a produtos ou compras, será apenas desativado.
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
