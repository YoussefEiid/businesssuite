import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- RESETTING ITEMS WITH LEGACY 15% TAX TO 0% ---');

  // Find all items with taxRate = 15
  const affectedItems = await prisma.item.findMany({
    where: {
      taxRate: new Prisma.Decimal(15),
    },
    select: {
      id: true,
      code: true,
      name: true,
      nameAr: true,
      sellingPrice: true,
      taxRate: true,
      tenantId: true,
    },
  });

  console.log(`Found ${affectedItems.length} item(s) with taxRate = 15:`);
  console.table(
    affectedItems.map((i) => ({
      code: i.code,
      name: i.name,
      price: Number(i.sellingPrice),
      taxRate: Number(i.taxRate),
    })),
  );

  if (affectedItems.length > 0) {
    const updateResult = await prisma.item.updateMany({
      where: {
        taxRate: new Prisma.Decimal(15),
      },
      data: {
        taxRate: new Prisma.Decimal(0),
      },
    });

    console.log(`Successfully updated ${updateResult.count} item(s) to taxRate = 0.`);
  } else {
    console.log('No items required updating.');
  }

  // Verify all items in the database now
  const allItems = await prisma.item.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      nameAr: true,
      sellingPrice: true,
      taxRate: true,
    },
  });

  console.log('--- ALL ITEMS IN DATABASE AFTER RESET ---');
  console.table(
    allItems.map((i) => ({
      code: i.code,
      name: i.name,
      price: Number(i.sellingPrice),
      taxRate: Number(i.taxRate),
    })),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
