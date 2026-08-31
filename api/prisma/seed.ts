import { prisma } from '../src/lib/prisma';
import { ITEMS_CATALOG } from './itemsCatalog';

async function main() {
  const packagingNames = [...new Set(ITEMS_CATALOG.map((item) => item.packagingName))];
  const packagingByName = new Map<string, string>();
  for (const name of packagingNames) {
    const packaging = await prisma.packaging.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    packagingByName.set(name, packaging.id);
  }

  for (const item of ITEMS_CATALOG) {
    const packagingId = packagingByName.get(item.packagingName)!;
    await prisma.item.upsert({
      where: { name: item.name },
      update: { packagingId, categoryId: item.categoryId },
      create: { name: item.name, packagingId, categoryId: item.categoryId },
    });
  }

  console.log('Seed concluído.');
}

main().finally(() => prisma.$disconnect());
