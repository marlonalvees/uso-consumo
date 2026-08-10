import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';

async function main() {
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  await prisma.admin.create({
    data: { username: 'admin', passwordHash: adminPasswordHash },
  });

  const branchPasswordHash = await bcrypt.hash('filial123', 10);
  await prisma.branch.create({
    data: {
      name: 'Centro',
      username: 'filial-centro',
      passwordHash: branchPasswordHash,
    },
  });

  const items = [
    { name: 'Papel A4', unit: 'pacote' },
    { name: 'Cloro', unit: 'litro' },
    { name: 'Espanador', unit: 'unidade' },
  ];

  for (const item of items) {
    await prisma.item.create({ data: item });
  }

  console.log('Seed concluído.');
}

main().finally(() => prisma.$disconnect());
