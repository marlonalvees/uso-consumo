import jwt from 'jsonwebtoken'

export interface AuthUser {
  sub: number
  permissions: { module: string; access: string }[]
  branchs: { id: number }[]
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET não definido nas variáveis de ambiente')
  }
  return secret
}

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, getSecret()) as unknown as AuthUser
}
