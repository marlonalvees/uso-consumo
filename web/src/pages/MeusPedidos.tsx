import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { Order } from '../types';
import { usePendingOrders } from '../context/PendingOrdersContext';
import OrderStatusTimeline from '../components/OrderStatusTimeline';
import OrderPrintSheet from '../components/OrderPrintSheet';
import { usePrintOrder } from '../hooks/usePrintOrder';

interface OrderCardProps {
  order: Order;
  highlighted?: boolean;
  confirmingId: string | null;
  onConfirm: (orderId: string) => void;
  onPrint: (order: Order) => void;
  readOnly?: boolean;
}

function OrderCard({ order, highlighted, confirmingId, onConfirm, onPrint, readOnly }: OrderCardProps) {
  return (
    <li
      className={`rounded-xl border p-4 ${
        highlighted
          ? 'border-novamix-orange/40 bg-novamix-orange/5 ring-1 ring-novamix-orange/20'
          : 'border-gray-200'
      }`}
    >
      <div className="mb-4">
        <p className="font-medium text-gray-900">{order.branch.name}</p>
        <span className="text-sm text-gray-500">
          {new Date(order.createdAt).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })}
        </span>
      </div>
      <div className="mb-4 overflow-x-auto">
        <OrderStatusTimeline
          status={order.status}
          createdAt={order.createdAt}
          deliveredAt={order.deliveredAt}
        />
      </div>
      <ul className="mb-3 space-y-1 text-sm text-gray-700">
        {order.items.map((orderItem) => (
          <li key={orderItem.id}>
            {orderItem.quantity}x {orderItem.item.name} ({orderItem.item.unit})
          </li>
        ))}
        {order.extraItems.map((extraItem) => (
          <li key={extraItem.id}>
            {extraItem.quantity}x {extraItem.name} <span className="text-gray-400">(extra)</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        {!readOnly && order.status === 'ENVIADO' && (
          <button
            type="button"
            onClick={() => onConfirm(order.id)}
            disabled={confirmingId === order.id}
            className="rounded-lg bg-novamix-teal px-4 py-2 text-sm font-semibold text-white transition hover:bg-novamix-teal-dark disabled:opacity-60"
          >
            {confirmingId === order.id ? 'Confirmando...' : 'Confirmar recebimento'}
          </button>
        )}
        <button
          type="button"
          onClick={() => onPrint(order)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          Imprimir
        </button>
      </div>
    </li>
  );
}

function monthKey(dateIso: string) {
  const date = new Date(dateIso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(dateIso: string) {
  const label = new Date(dateIso).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function groupOrdersByMonth(orders: Order[]) {
  const groups: { key: string; label: string; orders: Order[] }[] = [];
  for (const order of orders) {
    const key = monthKey(order.createdAt);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.key === key) {
      lastGroup.orders.push(order);
    } else {
      groups.push({ key, label: monthLabel(order.createdAt), orders: [order] });
    }
  }
  return groups;
}

interface MeusPedidosProps {
  branchId?: string;
  readOnly?: boolean;
  hideTitle?: boolean;
}

export default function MeusPedidos({ branchId, readOnly = false, hideTitle = false }: MeusPedidosProps = {}) {
  const { refreshPendingCount } = usePendingOrders();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const { printingOrder, printOrder } = usePrintOrder();

  useEffect(() => {
    api
      .get<Order[]>('/orders')
      .then(setOrders)
      .catch(() => setError('Não foi possível carregar os pedidos'))
      .finally(() => setLoading(false));
  }, []);

  async function handleConfirm(orderId: string) {
    setConfirmingId(orderId);
    setError(null);
    try {
      const updated = await api.patch<Order>(
        `/orders/${orderId}/confirm-delivery`,
      );
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      refreshPendingCount();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Não foi possível confirmar a entrega',
      );
    } finally {
      setConfirmingId(null);
    }
  }

  if (loading) {
    return <p className="text-gray-500">Carregando pedidos...</p>;
  }

  const scopedOrders = branchId ? orders.filter((order) => order.branchId === branchId) : orders;
  const awaitingConfirmation = scopedOrders.filter((order) => order.status === 'ENVIADO');
  const remainingOrders = scopedOrders.filter((order) => order.status !== 'ENVIADO');
  const monthGroups = groupOrdersByMonth(remainingOrders);

  return (
    <div>
      <div className="print:hidden">
        {!hideTitle && (
          <h1 className="mb-4 text-2xl font-semibold text-gray-900">
            Meus pedidos
          </h1>
        )}
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        {scopedOrders.length === 0 && (
          <p className="text-gray-500">Nenhum pedido feito ainda.</p>
        )}

        {awaitingConfirmation.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-novamix-orange-dark">
              Aguardando confirmação
              <span className="rounded-full bg-novamix-orange/15 px-2 py-0.5 text-xs font-medium text-novamix-orange-dark">
                {awaitingConfirmation.length}
              </span>
            </h2>
            <ul className="space-y-4">
              {awaitingConfirmation.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  highlighted
                  confirmingId={confirmingId}
                  onConfirm={handleConfirm}
                  onPrint={printOrder}
                  readOnly={readOnly}
                />
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-4">
          {monthGroups.map((group, index) => (
            <details key={group.key} className="group" open={index === 0}>
              <summary className="mb-3 flex cursor-pointer list-none items-center gap-2 text-sm font-semibold uppercase tracking-wide text-novamix-teal-dark">
                <span className="transition-transform group-open:rotate-90">
                  ▸
                </span>
                {group.label}
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                  {group.orders.length}
                </span>
              </summary>
              <ul className="space-y-4">
                {group.orders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    confirmingId={confirmingId}
                    onConfirm={handleConfirm}
                    onPrint={printOrder}
                    readOnly={readOnly}
                  />
                ))}
              </ul>
            </details>
          ))}
        </div>
      </div>

      <div className="hidden print:block">
        {printingOrder && <OrderPrintSheet order={printingOrder} />}
      </div>
    </div>
  );
}
