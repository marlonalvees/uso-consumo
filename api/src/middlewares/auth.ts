import type { NextFunction, Request, Response } from 'express'
import { verifyToken, type AuthUser } from '../utils/jwt'

const MODULE_SLUG = 'uso_consumo'
const ADMIN_ACCESS = 'admin'

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser
      moduleAccess?: string
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  // O front-end usa só o cookie. O header Bearer fica disponível como via alternativa pra testar
  // a API diretamente (curl/Postman); tem prioridade sobre o cookie pra evitar que um cookie
  // "token" antigo em localhost atrapalhe esses testes manuais.
  const token = (header?.startsWith('Bearer ') ? header.slice(7) : undefined) ?? req.cookies?.token

  if (!token) {
    res.status(401).json({ error: 'Autorização não encontrada' })
    return
  }

  try {
    req.auth = verifyToken(token)
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' })
  }
}

export function requireModule(req: Request, res: Response, next: NextFunction) {
  const permission = req.auth?.permissions.find((p) => p.module === MODULE_SLUG)
  if (!permission) {
    res.status(401).json({ error: 'Módulo não liberado para esse usuário' })
    return
  }
  req.moduleAccess = permission.access
  next()
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.moduleAccess !== ADMIN_ACCESS) {
    res.status(403).json({ error: 'Sem permissão para acessar este recurso' })
    return
  }
  next()
}

export function requireBranches(req: Request, res: Response, next: NextFunction) {
  if (req.moduleAccess !== ADMIN_ACCESS && (req.auth?.branchs ?? []).length === 0) {
    res.status(401).json({ error: 'Nenhuma filial liberada para esse usuário' })
    return
  }
  next()
}

export function isModuleAdmin(access?: string): boolean {
  return access === ADMIN_ACCESS
}
