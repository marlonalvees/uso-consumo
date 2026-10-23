import { prisma } from './prisma'
import { StockMovementType } from '../generated/prisma/client'

export const DEFAULT_LEAD_TIME_DAYS = 7
export const CONSUMPTION_WINDOW_DAYS = 90

/** Consumo médio diário de cada produto: saídas por pedido menos devoluções de ajuste, na janela de dias. */
export async function dailyConsumptionByItem(days = CONSUMPTION_WINDOW_DAYS): Promise<Map<string, number>> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const rows = await prisma.stockMovement.groupBy({
    by: ['itemId', 'type'],
    where: { orderId: { not: null }, createdAt: { gte: since } },
    _sum: { quantity: true },
  })

  const net = new Map<string, number>()
  for (const row of rows) {
    const quantity = row._sum.quantity ?? 0
    const signed = row.type === StockMovementType.SAIDA ? quantity : -quantity
    net.set(row.itemId, (net.get(row.itemId) ?? 0) + signed)
  }

  const daily = new Map<string, number>()
  for (const [itemId, total] of net) daily.set(itemId, Math.max(0, total) / days)
  return daily
}

/**
 * Custo médio ponderado depois de uma entrada. Sem custo anterior (preço zerado) ou sem
 * saldo positivo, o custo da compra vira o novo custo.
 */
export function weightedAverageCost(stock: number, currentCost: number, quantity: number, unitCost: number): number {
  const base = Math.max(stock, 0)
  if (base === 0 || currentCost <= 0) return round(unitCost, 4)
  return round((base * currentCost + quantity * unitCost) / (base + quantity), 4)
}

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

const monthFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
})

/** "2026-10" no fuso de Brasília — o servidor roda em UTC. */
export function monthKey(date: Date): string {
  return monthFormatter.format(date).slice(0, 7)
}

/** Primeiro instante do mês (fuso de Brasília) que contém a data, `offset` meses antes ou depois. */
export function monthStart(date: Date, offset = 0): Date {
  const [year, month] = monthKey(date).split('-').map(Number)
  // 03:00 UTC = meia-noite em Brasília (sem horário de verão desde 2019)
  return new Date(Date.UTC(year, month - 1 + offset, 1, 3, 0, 0))
}
