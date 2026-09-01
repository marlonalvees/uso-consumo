import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { Supplier } from '../types'
import { EditIcon, PlusIcon, SearchIcon, TrashIcon } from '../components/icons'
import { useToast } from '../context/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'
import SupplierEditModal from '../components/SupplierEditModal'
import { normalizeText } from '../lib/text'

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

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'ativo' | 'inativo'>('')

  const [creating, setCreating] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
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

  function handleSaved(saved: Supplier) {
    setSuppliers((prev) => {
      const exists = prev.some((s) => s.id === saved.id)
      const next = exists ? prev.map((s) => (s.id === saved.id ? saved : s)) : [...prev, saved]
      return next.sort((a, b) => a.name.localeCompare(b.name))
    })
    setEditingSupplier(null)
    setCreating(false)
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

  const normalizedSearch = normalizeText(search)
  const filteredSuppliers = suppliers.filter((supplier) => {
    if (normalizedSearch && !normalizeText(supplier.name).includes(normalizedSearch)) return false
    if (statusFilter === 'ativo' && !supplier.active) return false
    if (statusFilter === 'inativo' && supplier.active) return false
    return true
  })

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        {!hideTitle && <h1 className="text-2xl font-semibold text-gray-900">Fornecedores</h1>}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-novamix-orange px-4 py-2 text-sm font-semibold text-white transition hover:bg-novamix-orange-dark"
        >
          <PlusIcon className="h-4 w-4" />
          Novo fornecedor
        </button>
      </div>

      {suppliers.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
              <SearchIcon className="h-4 w-4" />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar fornecedor por nome..."
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pr-3 pl-9 text-sm text-gray-900 focus:border-novamix-teal focus:outline-none focus:ring-1 focus:ring-novamix-teal sm:max-w-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
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

      {suppliers.length === 0 ? (
        <p className="text-gray-500">Nenhum fornecedor cadastrado.</p>
      ) : filteredSuppliers.length === 0 ? (
        <p className="text-gray-500">Nenhum fornecedor encontrado com esses filtros.</p>
      ) : (
        <>
          {/* Mobile: stacked cards, no horizontal scroll */}
          <ul className="space-y-3 md:hidden">
            {filteredSuppliers.map((supplier) => (
              <li
                key={supplier.id}
                className={`rounded-xl border border-gray-200 bg-white p-4 ${supplier.active ? '' : 'opacity-50'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 font-medium wrap-break-word text-gray-900">{supplier.name}</p>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(supplier)}
                    disabled={savingId === supplier.id}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium disabled:opacity-60 ${
                      supplier.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {supplier.active ? 'Ativo' : 'Inativo'}
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-y-2 border-t border-gray-100 pt-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">CNPJ</p>
                    <p className="text-gray-900">{supplier.cnpj ? formatCnpj(supplier.cnpj) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Telefone</p>
                    <p className="text-gray-900">{supplier.phone ?? '—'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400">Email</p>
                    <p className="wrap-break-word text-gray-900">{supplier.email ?? '—'}</p>
                  </div>
                </div>

                <div className="mt-3 flex justify-end gap-2 border-t border-gray-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setEditingSupplier(supplier)}
                    aria-label="Editar"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-novamix-orange text-white transition hover:bg-novamix-orange-dark"
                  >
                    <EditIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(supplier)}
                    disabled={deletingId === supplier.id}
                    aria-label="Apagar"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-base text-white transition hover:bg-red-base/90 disabled:opacity-60"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
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
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className={supplier.active ? '' : 'opacity-50'}>
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
                          supplier.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {supplier.active ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingSupplier(supplier)}
                        aria-label="Editar"
                        className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-novamix-orange text-white transition hover:bg-novamix-orange-dark"
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <SupplierEditModal
        supplier={editingSupplier}
        mode="edit"
        onClose={() => setEditingSupplier(null)}
        onSaved={handleSaved}
      />

      {creating && (
        <SupplierEditModal supplier={null} mode="create" onClose={() => setCreating(false)} onSaved={handleSaved} />
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
