import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { prisma } from './lib/prisma';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/health', async (_req, res) => {
  const branchCount = await prisma.branch.count();
  res.json({ status: 'ok', branches: branchCount });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
