import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';
import { ITEMS_CATALOG } from './itemsCatalog';

const BRANCHES = [
  { name: 'Matriz Prado', username: 'filial-matriz-prado' },
  { name: 'Centro', username: 'filial-centro' },
  { name: 'Olaria', username: 'filial-olaria' },
  { name: 'Teresópolis', username: 'filial-teresopolis' },
]

async function main() {
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash: adminPasswordHash },
  });

  const branchPasswordHash = await bcrypt.hash('filial123', 10);
  for (const branch of BRANCHES) {
    await prisma.branch.upsert({
      where: { username: branch.username },
      update: {},
      create: {
        name: branch.name,
        username: branch.username,
        passwordHash: branchPasswordHash,
      },
    })
  }

  for (const item of ITEMS_CATALOG) {
    await prisma.item.upsert({
      where: { name: item.name },
      update: { unit: item.unit, category: item.category },
      create: item,
    });
  }

  console.log('Seed concluído.');
}

main().finally(() => prisma.$disconnect());
