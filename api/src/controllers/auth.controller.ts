import type { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { signToken } from '../utils/jwt'

export async function login(req: Request, res: Response) {
  const { username, password } = req.body as { username?: string; password?: string }

  if (!username || !password) {
    res.status(400).json({ error: 'Usuário e senha são obrigatórios' })
    return
  }

  const admin = await prisma.admin.findUnique({ where: { username } })
  if (admin && (await bcrypt.compare(password, admin.passwordHash))) {
    const token = signToken({ id: admin.id, role: 'ADMIN', name: admin.username })
    res.json({ token, user: { id: admin.id, role: 'ADMIN', name: admin.username } })
    return
  }

  const branch = await prisma.branch.findUnique({ where: { username } })
  if (branch && (await bcrypt.compare(password, branch.passwordHash))) {
    const token = signToken({ id: branch.id, role: 'FILIAL', name: branch.name })
    res.json({ token, user: { id: branch.id, role: 'FILIAL', name: branch.name } })
    return
  }

  res.status(401).json({ error: 'Usuário ou senha inválidos' })
}
