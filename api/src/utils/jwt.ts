import jwt from 'jsonwebtoken'

export type Role = 'ADMIN' | 'FILIAL'

export interface AuthPayload {
  id: string
  role: Role
  name: string
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET não definido nas variáveis de ambiente')
  }
  return secret
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: '7d' })
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, getSecret()) as AuthPayload
}
