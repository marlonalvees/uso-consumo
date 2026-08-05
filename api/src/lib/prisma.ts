// Conexão única com o banco, reaproveitada em todo o backend
import { PrismaClient } from '../generated/prisma/client';

export const prisma = new PrismaClient();
