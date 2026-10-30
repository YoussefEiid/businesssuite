import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PartiesService } from '../src/parties/parties.service';
import { InventoryService } from '../src/inventory/inventory.service';
import { EntitlementsService } from '../src/entitlements/entitlements.service';
import { StockMovementService } from '../src/inventory/stock-movement.service';
import { PartyType, ItemType } from '@business-suite/shared';

describe('Multi-Tenancy Isolation & Cross-Tenant Leakage Prevention', () => {
  let prisma: PrismaService;
  let partiesService: PartiesService;
  let inventoryService: InventoryService;

  let tenantAId: string;
  let tenantBId: string;
  let userAId: string;
  let userBId: string;
  let itemAId: string;
  let partyAId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', 'apps/api/.env'] }),
        PrismaModule,
      ],
      providers: [
        PartiesService,
        InventoryService,
        EntitlementsService,
        StockMovementService,
      ],
    }).compile();

    prisma = moduleRef.get<PrismaService>(PrismaService);
    partiesService = moduleRef.get<PartiesService>(PartiesService);
    inventoryService = moduleRef.get<InventoryService>(InventoryService);

    // Create Tenant A
    const tenantA = await prisma.tenant.create({
      data: { name: 'Alpha Corp', slug: `alpha-${Date.now()}` },
    });
    tenantAId = tenantA.id;

    // Create Tenant B
    const tenantB = await prisma.tenant.create({
      data: { name: 'Beta Industries', slug: `beta-${Date.now()}` },
    });
    tenantBId = tenantB.id;

    // Create User A
    const userA = await prisma.user.create({
      data: { email: `user-alpha-${Date.now()}@alpha.com`, name: 'User Alpha', passwordHash: 'hash' },
    });
    userAId = userA.id;

    // Create User B
    const userB = await prisma.user.create({
      data: { email: `user-beta-${Date.now()}@beta.com`, name: 'User Beta', passwordHash: 'hash' },
    });
    userBId = userB.id;

    // Create Party & Item in Tenant A
    const partyA = await partiesService.createParty(
      tenantAId,
      {
        type: PartyType.CUSTOMER,
        code: 'ALPHA-CUST-1',
        name: 'Alpha Customer',
        nameAr: 'عميل ألفا',
      },
      userAId,
    );
    partyAId = partyA.id;

    const itemA = await inventoryService.createItem(
      tenantAId,
      {
        code: 'ALPHA-ITEM-1',
        name: 'Alpha Item',
        nameAr: 'صنف ألفا',
        type: ItemType.STOCK,
        sellingPrice: 100,
      },
      userAId,
    );
    itemAId = itemA.id;
  });

  afterAll(async () => {
    if (tenantAId) {
      await prisma.party.deleteMany({ where: { tenantId: tenantAId } });
      await prisma.item.deleteMany({ where: { tenantId: tenantAId } });
      await prisma.tenant.delete({ where: { id: tenantAId } });
    }
    if (tenantBId) {
      await prisma.tenant.delete({ where: { id: tenantBId } });
    }
    if (userAId) await prisma.user.delete({ where: { id: userAId } });
    if (userBId) await prisma.user.delete({ where: { id: userBId } });
    await prisma.$disconnect();
  });

  it('1. Tenant B querying parties list must NOT see Tenant A party', async () => {
    const listB = await partiesService.listParties(tenantBId);
    const foundAInB = listB.find((p) => p.id === partyAId || p.code === 'ALPHA-CUST-1');
    expect(foundAInB).toBeUndefined();
    expect(listB.length).toBe(0);
  });

  it('2. Tenant B attempting to fetch Tenant A party by direct ID must be rejected with 404', async () => {
    await expect(partiesService.getParty(tenantBId, partyAId)).rejects.toThrow();
  });

  it('3. Tenant B querying items list must NOT see Tenant A items', async () => {
    const itemsB = await inventoryService.listItems(tenantBId);
    const foundItemInB = itemsB.find((i) => i.id === itemAId || i.code === 'ALPHA-ITEM-1');
    expect(foundItemInB).toBeUndefined();
    expect(itemsB.length).toBe(0);
  });

  it('4. Tenant B attempting to fetch Tenant A item by direct ID must be rejected with 404', async () => {
    await expect(inventoryService.getItem(tenantBId, itemAId)).rejects.toThrow();
  });

  it('5. Tenant B attempting to update Tenant A item must be rejected with 404', async () => {
    await expect(
      inventoryService.updateItem(tenantBId, itemAId, { name: 'Hacked Name' }, userBId),
    ).rejects.toThrow();
  });
});
