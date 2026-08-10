import dotenv from 'dotenv';
dotenv.config({ quiet: true });

import express from 'express';
import cors from 'cors';
import { prisma } from './lib/prisma';
import authRoutes from './routes/auth.routes';
import itemsRoutes from './routes/items.routes';
import ordersRoutes from './routes/orders.routes';
import branchesRoutes from './routes/branches.routes';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/health', async (_req, res) => {
  const branchCount = await prisma.branch.count();
  res.json({ status: 'ok', branches: branchCount });
});

app.use('/api/auth', authRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/branches', branchesRoutes);

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
