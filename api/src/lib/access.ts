import type { Request } from 'express'
import { isModuleAdmin } from '../middlewares/auth'

export function isAdmin(req: Request): boolean {
  return isModuleAdmin(req.moduleAccess)
}

export function userIdOf(req: Request): number {
  return req.auth!.sub
}

export function branchIdsOf(req: Request): number[] {
  return (req.auth?.branchs ?? []).map((b) => b.id)
}

// o admin enxerga todas as filiais; o supervisor só as que vêm no token
export function canAccessBranch(req: Request, branchId: number): boolean {
  return isAdmin(req) || branchIdsOf(req).includes(branchId)
}

export function trimOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
