import dotenv from 'dotenv';
dotenv.config({ quiet: true });

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { prisma } from './lib/prisma';
import authRoutes from './routes/auth.routes';
import itemsRoutes from './routes/items.routes';
import ordersRoutes from './routes/orders.routes';
import branchesRoutes from './routes/branches.routes';

const app = express();
const PORT = process.env.PORT ?? 3001;

const allowedOrigins = (process.env.CORS_ORIGINS ?? 'https://hub.lojanovamix.com.br').split(',');

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.get('/health', async (_req, res) => {
  const itemCount = await prisma.item.count();
  res.json({ status: 'ok', items: itemCount });
});

app.use('/api/auth', authRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/branches', branchesRoutes);

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
