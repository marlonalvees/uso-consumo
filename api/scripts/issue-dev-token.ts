import 'dotenv/config'
import jwt from 'jsonwebtoken'

const isAdmin = process.argv.includes('--admin')
const branchIds = (process.argv.find((a) => a.startsWith('--branches='))?.split('=')[1] ?? '1')
  .split(',')
  .map(Number)
const userId = Number(process.argv.find((a) => a.startsWith('--user='))?.split('=')[1] ?? '1')

if (!process.env.JWT_SECRET) {
  throw new Error('Defina JWT_SECRET no .env antes de gerar um token de dev')
}

const payload = {
  sub: userId,
  permissions: [{ module: 'uso_consumo', access: isAdmin ? 'admin' : 'read' }],
  branchs: branchIds.map((id) => ({ id })),
}

console.log(jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }))
