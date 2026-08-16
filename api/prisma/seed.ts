import { prisma } from '../src/lib/prisma';
import { ITEMS_CATALOG } from './itemsCatalog';

async function main() {
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
