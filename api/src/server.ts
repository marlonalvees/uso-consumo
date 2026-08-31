import dotenv from 'dotenv';
dotenv.config({ quiet: true });

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { prisma } from './lib/prisma';
import { UPLOADS_ROOT } from './middlewares/upload';
import authRoutes from './routes/auth.routes';
import itemsRoutes from './routes/items.routes';
import ordersRoutes from './routes/orders.routes';
import branchesRoutes from './routes/branches.routes';
import categoriesRoutes from './routes/categories.routes';
import suppliersRoutes from './routes/suppliers.routes';
import purchasesRoutes from './routes/purchases.routes';
import stockRoutes from './routes/stock.routes';
import packagingRoutes from './routes/packaging.routes';

const app = express();
const PORT = process.env.PORT ?? 3001;

const defaultOrigins = [
  'https://hub.lojanovamix.com.br',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : defaultOrigins;

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use('/api/uploads', express.static(UPLOADS_ROOT));

app.get('/health', async (_req, res) => {
  const itemCount = await prisma.item.count();
  res.json({ status: 'ok', items: itemCount });
});

app.use('/api/auth', authRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/branches', branchesRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/packaging', packagingRoutes);

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
