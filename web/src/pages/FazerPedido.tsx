import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, ApiError, assetUrl } from '../lib/api'
import type { Branch, BranchPar, BranchSummary, Item, Order, PendingItem } from '../types'
import { useOrders } from '../context/OrdersContext'
import { useItems } from '../context/ItemsContext'
import { useToast } from '../context/ToastContext'
import { normalizeText } from '../lib/text'
import { formatCurrency, formatShortDate, plural } from '../lib/format'
import { btnPrimary, btnSecondary, cardClass, inputClass, labelClass, sectionTitle } from '../lib/ui'
import Sheet from '../components/ui/Sheet'
import QuantityStepper from '../components/ui/QuantityStepper'
import EmptyState from '../components/ui/EmptyState'
import { SkeletonCards } from '../components/ui/Skeleton'
import PhotoLightbox from '../components/PhotoLightbox'
import {
  AlertIcon,
  ArrowRightIcon,
  BagIcon,
  ClipboardCheckIcon,
  CloseIcon,
  ImageIcon,
  PackageSearchIcon,
  PlusIcon,
  RepeatIcon,
  SearchIcon,
  TargetIcon,
  WalletIcon,
} from '../components/icons'

interface ExtraLine {
  id: string
  name: string
  quantity: number
}

interface FazerPedidoProps {
  branches: Branch[]
  /** a central faz pedidos pra qualquer filial, sem a trava de um pedido aberto */
  asAdmin?: boolean
}

const PENDING_REASON = (pending: PendingItem) =>
  pending.cutQuantity > 0 && pending.missingQuantity > 0
    ? 'Cortado e faltou na entrega'
    : pending.cutQuantity > 0
      ? `Cortado pela central${pending.adjustReason ? ` (${pending.adjustReason})` : ''}`
      : pending.receiptIssue === 'AVARIADO'
        ? 'Chegou avariado'
        : 'Faltou na entrega'

export default function FazerPedido({ branches, asAdmin = false }: FazerPedidoProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { orders, addOrder, updateOrder, openOrderFor, refreshOrders } = useOrders()
  const { items, loadingItems } = useItems()
  const toast = useToast()

  const [branchId, setBranchId] = useState<number | null>(asAdmin ? null : (branches[0]?.id ?? null))
  const [cart, setCart] = useState<Record<string, number>>({})
  const [extras, setExtras] = useState<ExtraLine[]>([])
  const [newExtra, setNewExtra] = useState('')
  const [notes, setNotes] = useState('')
  const [pendingIds, setPendingIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [parsOpen, setParsOpen] = useState(false)
  const [pendingOpen, setPendingOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<{ order: Order; addedToOpen: boolean } | null>(null)
  const [preview, setPreview] = useState<Item | null>(null)
  const [pending, setPending] = useState<PendingItem[]>([])
  const [summary, setSummary] = useState<BranchSummary | null>(null)
  const [cartBump, setCartBump] = useState(0)

  useEffect(() => {
    if (!branchId) return
    setSummary(null)
    api.get<PendingItem[]>(`/orders/pending-items?branchId=${branchId}`).then(setPending).catch(() => setPending([]))
    api.get<BranchSummary>(`/branches/${branchId}/summary`).then(setSummary).catch(() => setSummary(null))
  }, [branchId])

  const openOrder = !asAdmin && branchId ? openOrderFor(branchId) : undefined
  const addingToOpen = openOrder?.status === 'RECEBIDO'
  const blockedBySeparation = openOrder?.status === 'EM_ANDAMENTO'
  const lastOrder = branchId ? orders.find((o) => o.branchId === branchId && o.status !== 'CANCELADO') : undefined
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])

  const cartLines = Object.entries(cart).filter(([itemId, quantity]) => quantity > 0 && itemById.has(itemId))
  const validExtras = extras.filter((extra) => extra.name.trim() && extra.quantity > 0)
  const cartCount = cartLines.length + validExtras.length
  const cartValue = cartLines.reduce((sum, [itemId, quantity]) => sum + quantity * (itemById.get(itemId)?.price ?? 0), 0)

  function setQuantity(itemId: string, quantity: number) {
    setCart((prev) => {
      const next = { ...prev, [itemId]: quantity }
      if (quantity <= 0) delete next[itemId]
      return next
    })
    setCartBump((n) => n + 1)
  }

  function resetCart() {
    setCart({})
    setExtras([])
    setNotes('')
    setPendingIds([])
  }

  function repeatOrder(order: Order) {
    const next: Record<string, number> = {}
    for (const orderItem of order.items) {
      if (orderItem.requestedQuantity > 0 && itemById.get(orderItem.itemId)?.active) next[orderItem.itemId] = orderItem.requestedQuantity
    }
    setCart(next)
    setExtras(
      order.extraItems
        .filter((extra) => extra.requestedQuantity > 0)
        .map((extra) => ({ id: crypto.randomUUID(), name: extra.name, quantity: extra.requestedQuantity })),
    )
    setCartBump((n) => n + 1)
    toast.success(`Itens do pedido de ${formatShortDate(order.createdAt)} na sacola`)
  }

  // "Pedir de novo" no histórico chega aqui com o pedido a repetir
  useEffect(() => {
    const repeatId = (location.state as { repeatOrderId?: string } | null)?.repeatOrderId
    if (!repeatId || items.length === 0) return
    const order = orders.find((o) => o.id === repeatId)
    if (!order) return
    if (branches.some((b) => b.id === order.branchId)) setBranchId(order.branchId)
    repeatOrder(order)
    navigate(location.pathname, { replace: true, state: null })
    // só ao chegar com o pedido a repetir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, items.length])

  function addPending(list: PendingItem[]) {
    setCart((prev) => {
      const next = { ...prev }
      for (const p of list) next[p.item.id] = (next[p.item.id] ?? 0) + p.quantity
      return next
    })
    setPendingIds((prev) => [...new Set([...prev, ...list.map((p) => p.id)])])
    setPending((prev) => prev.filter((p) => !list.some((added) => added.id === p.id)))
    setCartBump((n) => n + 1)
    toast.success(list.length === 1 ? `${list[0].item.name} na sacola` : `${list.length} pendências na sacola`)
  }

  async function dismissPending(p: PendingItem) {
    try {
      await api.post('/orders/pending-items/dismiss', { ids: [p.id] })
      setPending((prev) => prev.filter((x) => x.id !== p.id))
    } catch {
      toast.error('Não foi possível dispensar a pendência')
    }
  }

  async function submit() {
    if (!branchId) {
      toast.error('Escolha para qual filial é o pedido')
      return
    }
    const itemsPayload = cartLines.map(([itemId, quantity]) => ({ itemId, quantity }))
    const extrasPayload = validExtras.map((extra) => ({ name: extra.name.trim(), quantity: extra.quantity }))
    if (itemsPayload.length === 0 && extrasPayload.length === 0) {
      toast.error('Adicione ao menos um item')
      return
    }

    setSubmitting(true)
    try {
      let saved: Order
      if (addingToOpen && openOrder) {
        // junta com o que já está no pedido aberto
        const merged = new Map(openOrder.items.map((oi) => [oi.itemId, oi.requestedQuantity]))
        for (const line of itemsPayload) merged.set(line.itemId, (merged.get(line.itemId) ?? 0) + line.quantity)
        saved = await api.patch<Order>(`/orders/${openOrder.id}/edit`, {
          items: [...merged.entries()].filter(([, q]) => q > 0).map(([itemId, quantity]) => ({ itemId, quantity })),
          extras: [...openOrder.extraItems.map((e) => ({ name: e.name, quantity: e.requestedQuantity })), ...extrasPayload],
          notes: notes.trim() ? [openOrder.notes, notes.trim()].filter(Boolean).join('\n') : undefined,
          resolvePendingIds: pendingIds,
        })
        updateOrder(saved)
      } else {
        saved = await api.post<Order>('/orders', {
          branchId,
          items: itemsPayload,
          extras: extrasPayload,
          notes: notes.trim() || undefined,
          resolvePendingIds: pendingIds,
        })
        addOrder(saved)
      }
      resetCart()
      setCartOpen(false)
      setDone({ order: saved, addedToOpen: Boolean(addingToOpen) })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) refreshOrders()
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível enviar o pedido')
    } finally {
      setSubmitting(false)
    }
  }

  // categorias com produtos, na ordem alfabética; a busca vira uma lista única
  const normalizedSearch = normalizeText(search)
  const visibleItems = items.filter((item) => item.active && (!normalizedSearch || normalizeText(item.name).includes(normalizedSearch)))
  const groups = useMemo(() => {
    const byCategory = new Map<string, { id: string; name: string; items: Item[] }>()
    for (const item of visibleItems) {
      const group = byCategory.get(item.categoryId) ?? { id: item.categoryId, name: item.category.name, items: [] }
      group.items.push(item)
      byCategory.set(item.categoryId, group)
    }
    return [...byCategory.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [visibleItems])

  // destaca a categoria que está passando na tela, como o cardápio do iFood
  const sectionRefs = useRef(new Map<string, HTMLElement>())
  useEffect(() => {
    if (normalizedSearch) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveCategory(visible[0].target.getAttribute('data-category'))
      },
      { rootMargin: '-160px 0px -55% 0px' },
    )
    for (const element of sectionRefs.current.values()) observer.observe(element)
    return () => observer.disconnect()
  }, [groups, normalizedSearch])

  function scrollToCategory(categoryId: string) {
    setActiveCategory(categoryId)
    sectionRefs.current.get(categoryId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!asAdmin && branches.length === 0) {
    return <EmptyState icon={AlertIcon} title="Nenhuma filial liberada" description="Fale com o administrador do hub para liberar sua filial." />
  }

  const budget = summary?.monthlyBudget ?? null
  const budgetUsed = summary ? summary.monthConsumption : 0
  const budgetPct = budget ? Math.min(100, ((budgetUsed + cartValue) / budget) * 100) : 0

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">{asAdmin ? 'Pedido para uma filial' : 'Fazer pedido'}</h1>
          <p className="text-sm text-gray-500">
            {asAdmin ? 'A central pede em nome da filial, sem a trava de um pedido por vez.' : 'Escolha os itens e envie para a central.'}
          </p>
        </div>
      </div>

      {(asAdmin || branches.length > 1) && (
        <div className="mb-4">
          <p className={`${sectionTitle} mb-2`}>Pedido para</p>
          <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4">
            {branches.map((branch) => (
              <button
                key={branch.id}
                type="button"
                onClick={() => setBranchId(branch.id)}
                className={`press shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                  branchId === branch.id ? 'bg-orange-base text-white shadow-sm' : 'bg-white text-gray-700 ring-1 ring-gray-200'
                }`}
              >
                {branch.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {blockedBySeparation && openOrder ? (
        <div className={`${cardClass} p-5`}>
          <EmptyState
            icon={PackageSearchIcon}
            title="A central está separando o pedido"
            description={`O pedido da filial ${openOrder.branch.name} já está em separação. Você poderá fazer outro assim que ele for enviado.`}
            action={
              <button type="button" onClick={() => navigate('/acompanhar', { state: { focusOrderId: openOrder.id } })} className={btnPrimary}>
                Acompanhar pedido <ArrowRightIcon className="h-4 w-4" />
              </button>
            }
          />
        </div>
      ) : (
        <>
          {addingToOpen && openOrder && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl bg-blue-50 p-3.5 ring-1 ring-blue-100">
              <ClipboardCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
              <p className="text-sm text-blue-900">
                A filial <strong>{openOrder.branch.name}</strong> já tem um pedido aberto. O que você escolher agora{' '}
                <strong>entra nele</strong>, enquanto a central não começa a separar.
              </p>
            </div>
          )}

          {branchId && (
            <div className="scrollbar-none -mx-4 mb-4 flex gap-3 overflow-x-auto px-4 pb-1">
              {/* pendências primeiro: é o que a filial mais esquece de pedir de novo */}
              {pending.length > 0 && (
                <button type="button" onClick={() => setPendingOpen(true)} className={`press ${cardClass} flex w-56 shrink-0 items-center gap-3 p-3 text-left ring-2 ring-amber-300`}>
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <AlertIcon className="h-5 w-5" />
                    <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-base px-1 text-[10px] font-extrabold text-white">
                      {pending.length}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-gray-900">Pendências</span>
                    <span className="block text-xs text-gray-500">Cortados ou que faltaram</span>
                  </span>
                </button>
              )}
              {lastOrder && (
                <button type="button" onClick={() => repeatOrder(lastOrder)} className={`press ${cardClass} flex w-56 shrink-0 items-center gap-3 p-3 text-left`}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-base/10 text-orange-base">
                    <RepeatIcon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-gray-900">Repetir último pedido</span>
                    <span className="block truncate text-xs text-gray-500">
                      {formatShortDate(lastOrder.createdAt)} · {plural(lastOrder.items.length + lastOrder.extraItems.length, 'item', 'itens')}
                    </span>
                  </span>
                </button>
              )}
              <button type="button" onClick={() => setParsOpen(true)} className={`press ${cardClass} flex w-56 shrink-0 items-center gap-3 p-3 text-left`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-novamix-teal/10 text-novamix-teal">
                  <TargetIcon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-gray-900">Pedir pelo estoque ideal</span>
                  <span className="block text-xs text-gray-500">Conte o que tem e eu calculo</span>
                </span>
              </button>
              {budget !== null && (
                <div className={`${cardClass} flex w-60 shrink-0 items-center gap-3 p-3`}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <WalletIcon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-gray-900">Cota do mês</span>
                    <span className="block text-xs text-gray-500">
                      {formatCurrency(budgetUsed)} de {formatCurrency(budget)}
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <span
                        className={`block h-full rounded-full ${budgetPct >= 100 ? 'bg-red-base' : budgetPct >= 80 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                        style={{ width: `${budgetPct}%` }}
                      />
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="sticky top-[calc(3.6rem+env(safe-area-inset-top))] z-20 -mx-4 bg-gray/95 px-4 pt-1 pb-3 backdrop-blur lg:top-0 lg:-mx-8 lg:px-8">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto"
                aria-label="Buscar produto"
                className={`${inputClass} pl-10 shadow-card`}
              />
            </div>
            {!normalizedSearch && groups.length > 1 && (
              <div className="scrollbar-none -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => scrollToCategory(group.id)}
                    className={`press shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold transition-colors ${
                      activeCategory === group.id ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200'
                    }`}
                  >
                    {group.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loadingItems ? (
            <SkeletonCards count={5} className="h-20" />
          ) : groups.length === 0 ? (
            <EmptyState
              icon={SearchIcon}
              title="Nada encontrado"
              description={`Nenhum produto com "${search.trim()}". Peça como item extra na sacola.`}
              compact
            />
          ) : (
            <div className="space-y-6">
              {groups.map((group) => (
                <section
                  key={group.id}
                  data-category={group.id}
                  ref={(element) => {
                    if (element) sectionRefs.current.set(group.id, element)
                    else sectionRefs.current.delete(group.id)
                  }}
                  className="scroll-mt-44 lg:scroll-mt-32"
                >
                  <h2 className="mb-2 text-lg font-extrabold text-gray-900">{group.name}</h2>
                  <ul className={`${cardClass} divide-y divide-gray-100 overflow-hidden`}>
                    {group.items.map((item) => {
                      const quantity = cart[item.id] ?? 0
                      return (
                        <li
                          key={item.id}
                          className={`flex items-center gap-3 p-3 transition-colors ${quantity > 0 ? 'bg-orange-base/4' : ''}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-gray-900">{item.name}</p>
                            <p className="text-xs text-gray-500">{item.packaging.name}</p>
                            {quantity > 0 && (
                              <span className="mt-1 inline-block rounded-full bg-orange-base px-2 py-0.5 text-[11px] font-extrabold text-white">
                                {quantity} na sacola
                              </span>
                            )}
                          </div>
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              onClick={() => item.photoPath && setPreview(item)}
                              aria-label={item.photoPath ? `Ver foto de ${item.name}` : undefined}
                              className={`flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-gray-100 text-gray-300 ${
                                item.photoPath ? '' : 'pointer-events-none'
                              }`}
                            >
                              {item.photoPath ? (
                                <img src={assetUrl(item.photoPath)} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
                              ) : (
                                <ImageIcon className="h-6 w-6" />
                              )}
                            </button>
                            <div className="absolute -right-1.5 -bottom-2">
                              <QuantityStepper
                                value={quantity}
                                onChange={(value) => setQuantity(item.id, value)}
                                label={item.name}
                                size="sm"
                                collapseAtZero
                              />
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}

          <div className="h-24" />

          {/* sacola flutuante: sobe acima da barra de navegação no celular */}
          {cartCount > 0 && (
            <div className="fixed inset-x-0 bottom-[calc(4.4rem+env(safe-area-inset-bottom))] z-30 px-4 lg:bottom-6 lg:left-64">
              <button
                key={cartBump}
                type="button"
                onClick={() => setCartOpen(true)}
                className="press mx-auto flex w-full max-w-xl animate-pop items-center gap-3 rounded-2xl bg-orange-base px-4 py-3.5 text-white shadow-float"
              >
                <span className="relative">
                  <BagIcon className="h-6 w-6" />
                  <span className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-extrabold text-orange-base">
                    {cartCount}
                  </span>
                </span>
                <span className="flex-1 text-center text-base font-extrabold">Ver pedido</span>
                <span className="text-sm font-bold tabular-nums opacity-90">{cartValue > 0 ? `≈ ${formatCurrency(cartValue)}` : plural(cartCount, 'item', 'itens')}</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* sacola */}
      <Sheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        title="Seu pedido"
        subtitle={branchId ? branches.find((b) => b.id === branchId)?.name : 'Escolha a filial'}
        footer={
          <div className="space-y-2">
            {cartValue > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Valor estimado (custo da central)</span>
                <span className="font-extrabold text-gray-900 tabular-nums">{formatCurrency(cartValue)}</span>
              </div>
            )}
            <button type="button" onClick={submit} disabled={submitting || cartCount === 0} className={`${btnPrimary} w-full py-3.5 text-base`}>
              {submitting ? 'Enviando...' : addingToOpen ? `Adicionar ao pedido aberto · ${plural(cartCount, 'item', 'itens')}` : `Enviar pedido · ${plural(cartCount, 'item', 'itens')}`}
            </button>
          </div>
        }
      >
        {asAdmin && !branchId && (
          <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">Escolha a filial no topo da página antes de enviar.</p>
        )}
        <ul className="divide-y divide-gray-100">
          {cartLines.map(([itemId, quantity]) => {
            const item = itemById.get(itemId)!
            return (
              <li key={itemId} className="flex items-center gap-3 py-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 text-gray-300">
                  {item.photoPath ? <img src={assetUrl(item.photoPath)} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-500">
                    {item.packaging.name}
                    {item.price > 0 && ` · ${formatCurrency(item.price * quantity)}`}
                  </p>
                </div>
                <QuantityStepper value={quantity} onChange={(value) => setQuantity(itemId, value)} label={item.name} size="sm" collapseAtZero editable />
              </li>
            )
          })}
          {extras.map((extra) => (
            <li key={extra.id} className="flex items-center gap-3 py-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-xs font-extrabold text-amber-700">EXTRA</span>
              <p className="min-w-0 flex-1 text-sm font-bold text-gray-900">{extra.name}</p>
              <QuantityStepper
                value={extra.quantity}
                onChange={(value) =>
                  setExtras((prev) => (value <= 0 ? prev.filter((e) => e.id !== extra.id) : prev.map((e) => (e.id === extra.id ? { ...e, quantity: value } : e))))
                }
                label={extra.name}
                size="sm"
                collapseAtZero
              />
            </li>
          ))}
        </ul>

        <div className="mt-4 rounded-2xl bg-gray-50 p-3">
          <p className="mb-2 text-sm font-bold text-gray-900">Não achou o que precisa?</p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!newExtra.trim()) return
              setExtras((prev) => [...prev, { id: crypto.randomUUID(), name: newExtra.trim(), quantity: 1 }])
              setNewExtra('')
            }}
          >
            <input
              type="text"
              value={newExtra}
              onChange={(e) => setNewExtra(e.target.value)}
              placeholder="Ex.: pilha AA"
              aria-label="Nome do item extra"
              className={`${inputClass} min-w-0 flex-1`}
            />
            <button type="submit" className={btnSecondary} aria-label="Adicionar item extra">
              <PlusIcon className="h-4 w-4" />
            </button>
          </form>
        </div>

        <div className="mt-4">
          <label htmlFor="order-notes" className={labelClass}>
            Alguma observação para a central?
          </label>
          <textarea
            id="order-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Ex.: urgente, acabou o papel do caixa"
            className={inputClass}
          />
        </div>

        {budget !== null && cartValue > 0 && (
          <p className={`mt-3 text-xs font-semibold ${budgetUsed + cartValue > budget ? 'text-red-600' : 'text-gray-500'}`}>
            Com este pedido, a filial fica em {formatCurrency(budgetUsed + cartValue)} de {formatCurrency(budget)} da cota do mês.
          </p>
        )}
      </Sheet>

      {branchId && (
        <ParOrderSheet
          open={parsOpen}
          branchId={branchId}
          onClose={() => setParsOpen(false)}
          onApply={(quantities) => {
            setCart((prev) => ({ ...prev, ...quantities }))
            setCartBump((n) => n + 1)
            setParsOpen(false)
            const count = Object.values(quantities).filter((q) => q > 0).length
            toast.success(count ? `${plural(count, 'item', 'itens')} na sacola pelo estoque ideal` : 'Tudo no estoque ideal')
          }}
        />
      )}

      <Sheet open={pendingOpen} onClose={() => setPendingOpen(false)} title="Pendências da filial" subtitle="Itens cortados pela central ou que faltaram na entrega">
        {pending.length === 0 ? (
          <EmptyState icon={ClipboardCheckIcon} title="Nenhuma pendência" compact />
        ) : (
          <>
            <ul className="divide-y divide-gray-100">
              {pending.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900">
                      {p.quantity}× {p.item.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {PENDING_REASON(p)} · pedido de {formatShortDate(p.orderCreatedAt)}
                    </p>
                  </div>
                  <button type="button" onClick={() => dismissPending(p)} aria-label="Dispensar pendência" className="rounded-full p-2 text-gray-400 hover:bg-gray-100">
                    <CloseIcon className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => addPending([p])} className={`${btnSecondary} px-3 py-2`}>
                    <PlusIcon className="h-4 w-4" /> Pedir
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                addPending(pending)
                setPendingOpen(false)
              }}
              className={`${btnPrimary} mt-4 w-full`}
            >
              Pedir todas
            </button>
          </>
        )}
      </Sheet>

      <Sheet open={done !== null} onClose={() => setDone(null)} size="sm">
        {done && (
          <div className="flex flex-col items-center py-4 text-center">
            <svg viewBox="0 0 52 52" className="mb-4 h-20 w-20" aria-hidden>
              <circle cx="26" cy="26" r="25" className="fill-emerald-500" />
              <path
                d="M15 27l7 7 15-15"
                fill="none"
                stroke="white"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="48"
                className="animate-check"
              />
            </svg>
            <h2 className="text-xl font-extrabold text-gray-900">{done.addedToOpen ? 'Itens adicionados!' : 'Pedido enviado!'}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {asAdmin
                ? `Pedido criado para a filial ${done.order.branch.name}.`
                : 'A central já recebeu. Você acompanha cada etapa por aqui e recebe um aviso quando sair.'}
            </p>
            <button
              type="button"
              onClick={() => {
                const target = asAdmin ? '/gestao' : '/acompanhar'
                const state = asAdmin ? { focusStatus: 'RECEBIDO' } : { focusOrderId: done.order.id }
                setDone(null)
                navigate(target, { state })
              }}
              className={`${btnPrimary} mt-6 w-full py-3`}
            >
              {asAdmin ? 'Ver na gestão de pedidos' : 'Acompanhar pedido'} <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </Sheet>

      <PhotoLightbox src={preview?.photoPath ? assetUrl(preview.photoPath) : null} alt={preview?.name ?? ''} onClose={() => setPreview(null)} />
    </div>
  )
}

/** A filial conta o que tem e o pedido sugere o que falta pra chegar no estoque ideal. */
function ParOrderSheet({
  open,
  branchId,
  onClose,
  onApply,
}: {
  open: boolean
  branchId: number
  onClose: () => void
  onApply: (quantities: Record<string, number>) => void
}) {
  const [pars, setPars] = useState<BranchPar[] | null>(null)
  const [onHand, setOnHand] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setPars(null)
    setOnHand({})
    api.get<BranchPar[]>(`/branches/${branchId}/pars`).then(setPars).catch(() => setPars([]))
  }, [open, branchId])

  const need = (par: BranchPar) => {
    const value = onHand[par.itemId]
    if (value === undefined || value === '') return null
    return Math.max(0, par.quantity - Math.max(0, Math.floor(Number(value) || 0)))
  }
  const filled = (pars ?? []).filter((par) => need(par) !== null)
  const toOrder = filled.filter((par) => (need(par) ?? 0) > 0)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      dismissible={false}
      title="Pedir pelo estoque ideal"
      subtitle="Digite quanto a filial tem de cada item agora"
      footer={
        <button
          type="button"
          disabled={filled.length === 0}
          onClick={() => onApply(Object.fromEntries(filled.map((par) => [par.itemId, need(par) ?? 0])))}
          className={`${btnPrimary} w-full py-3`}
        >
          {toOrder.length ? `Colocar ${plural(toOrder.length, 'item', 'itens')} na sacola` : 'Calcular pedido'}
        </button>
      }
    >
      {pars === null ? (
        <SkeletonCards count={4} className="h-14" />
      ) : pars.length === 0 ? (
        <EmptyState
          icon={TargetIcon}
          title="Estoque ideal ainda não definido"
          description="A central define quanto a filial deve ter de cada item em Cadastros → Filiais."
          compact
        />
      ) : (
        <ul className="divide-y divide-gray-100">
          {pars.map((par) => {
            const missing = need(par)
            return (
              <li key={par.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900">{par.item.name}</p>
                  <p className="text-xs text-gray-500">
                    Ideal: {par.quantity} {par.item.packaging.name}
                  </p>
                </div>
                <label className="flex flex-col items-end gap-1">
                  <span className="text-[11px] font-semibold text-gray-500">Tem</span>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={onHand[par.itemId] ?? ''}
                    onChange={(e) => setOnHand((prev) => ({ ...prev, [par.itemId]: e.target.value }))}
                    aria-label={`Quanto tem de ${par.item.name}`}
                    className="w-16 rounded-xl border border-gray-200 px-2 py-2 text-center text-sm font-bold focus:border-orange-base focus:ring-2 focus:ring-orange-base/20 focus:outline-none"
                  />
                </label>
                <span
                  className={`w-16 shrink-0 rounded-xl px-2 py-2 text-center text-sm font-extrabold tabular-nums ${
                    missing === null ? 'bg-gray-50 text-gray-300' : missing > 0 ? 'bg-orange-base text-white' : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {missing === null ? '—' : missing > 0 ? `+${missing}` : 'ok'}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}
