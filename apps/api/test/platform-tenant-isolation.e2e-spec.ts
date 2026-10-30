import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Platform Owner vs Tenant User Strict Route & Lifecycle Isolation E2E', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;

  let platformToken: string;
  let tenantId: string;
  let tenantOwnerEmail: string;
  let tenantOwnerToken: string;
  let starterPlanId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    await app.init();
    prisma = moduleRef.get<PrismaService>(PrismaService);

    // Retrieve starter plan
    const plan = await prisma.plan.findFirst({
      where: {
        OR: [{ code: 'STARTER' }, { code: 'starter' }],
      },
    });
    if (!plan) {
      throw new Error('Starter plan not found in database. Please run seed first.');
    }
    starterPlanId = plan.id;
  });

  afterAll(async () => {
    // Clean up created tenant if any
    if (tenantId) {
      await prisma.subscription.deleteMany({ where: { tenantId } });
      await prisma.membership.deleteMany({ where: { tenantId } });
      await prisma.branch.deleteMany({ where: { tenantId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
    if (tenantOwnerEmail) {
      await prisma.user.deleteMany({ where: { email: tenantOwnerEmail } });
    }
    await app.close();
  });

  // Test A: Platform Owner login returns isSuperAdmin: true, activeRole SUPER_ADMIN
  it('Test A: Platform Owner login returns isSuperAdmin: true, activeRole SUPER_ADMIN', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'admin@business-suite.local',
        password: 'Admin123456!',
      })
      .expect(201);

    expect(res.body).toHaveProperty('accessToken');
    platformToken = res.body.accessToken;

    expect(res.body.user).toBeDefined();
    expect(res.body.user.isSuperAdmin).toBe(true);
    expect(res.body.user.activeRole).toBe('SUPER_ADMIN');
    expect(res.body.user.activeTenantId).toBeFalsy();
    expect(res.body.memberships).toEqual([]);
  });

  // Test B: Platform Owner has no tenant context and cannot invoke tenant operational API without X-Tenant-Id
  it('Test B: Platform Owner has no tenant context and cannot invoke tenant operational API without X-Tenant-Id', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/inventory/items')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(403);

    expect(res.body.message).toMatch(/No active tenant context provided/i);
  });

  // Test C: Platform Owner provisions new tenant via /platform/tenants, assigns plan
  it('Test C: Platform Owner provisions new tenant via /platform/tenants, assigns plan', async () => {
    const unique = Date.now();
    tenantOwnerEmail = `tenant-admin-${unique}@acmetest.local`;
    const slug = `acme-corp-${unique}`;

    const res = await request(app.getHttpServer())
      .post('/api/platform/tenants')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        companyName: 'Acme Test Corp',
        slug,
        ownerName: 'Acme Owner',
        ownerEmail: tenantOwnerEmail,
        ownerPassword: 'TenantPassword123!',
        planId: starterPlanId,
        subscriptionStatus: 'ACTIVE',
        durationDays: 30,
        currencyCode: 'SAR',
      })
      .expect(201);

    expect(res.body).toBeDefined();
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Acme Test Corp');
    tenantId = res.body.id;

    // Verify subscription created
    const sub = await prisma.subscription.findFirst({
      where: { tenantId },
    });
    expect(sub).toBeDefined();
    expect(sub?.status).toBe('ACTIVE');
    expect(sub?.planId).toBe(starterPlanId);
  });

  // Test D: Platform Owner renews subscription via /platform/tenants/:id/subscription using extensionDays
  it('Test D: Platform Owner renews subscription via /platform/tenants/:id/subscription using extensionDays', async () => {
    const subBefore = await prisma.subscription.findFirst({
      where: { tenantId },
    });
    expect(subBefore).toBeDefined();
    const oldEndDate = new Date(subBefore!.endDate).getTime();

    const res = await request(app.getHttpServer())
      .post(`/api/platform/tenants/${tenantId}/subscription`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        planId: starterPlanId,
        extensionDays: 60,
        status: 'ACTIVE',
        paymentAmount: 500,
        paymentMethod: 'BANK_TRANSFER',
        notes: 'Extended by 60 days via Platform Admin',
      })
      .expect(201);

    expect(res.body).toBeDefined();
    expect(res.body.status).toBe('ACTIVE');

    const subAfter = await prisma.subscription.findFirst({
      where: { tenantId },
    });
    expect(subAfter).toBeDefined();
    const newEndDate = new Date(subAfter!.endDate).getTime();

    // Verify endDate incremented by approximately 60 days (within small tolerance)
    const diffDays = Math.round((newEndDate - oldEndDate) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(60);
  });

  // Test E: New tenant owner logs in independently, receives isSuperAdmin: false, activeTenantId, and can access tenant endpoints
  it('Test E: New tenant owner logs in independently, receives isSuperAdmin: false, activeTenantId, and accesses tenant endpoints', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: tenantOwnerEmail,
        password: 'TenantPassword123!',
      })
      .expect(201);

    expect(res.body).toHaveProperty('accessToken');
    tenantOwnerToken = res.body.accessToken;

    expect(res.body.user).toBeDefined();
    expect(res.body.user.isSuperAdmin).toBe(false);
    expect(res.body.user.activeTenantId).toBe(tenantId);
    expect(res.body.memberships.length).toBeGreaterThan(0);
    expect(res.body.memberships[0].tenantId).toBe(tenantId);

    // Tenant owner accesses operational endpoint successfully (returns empty array of items, HTTP 200)
    const itemsRes = await request(app.getHttpServer())
      .get('/api/inventory/items')
      .set('Authorization', `Bearer ${tenantOwnerToken}`)
      .set('X-Tenant-Id', tenantId)
      .expect(200);

    expect(Array.isArray(itemsRes.body)).toBe(true);
  });

  // Test F: Tenant user attempting to access /platform/* endpoints receives 403 Forbidden
  it('Test F: Tenant user attempting to access /platform/* endpoints receives 403 Forbidden', async () => {
    // Attempt to access platform overview
    const overviewRes = await request(app.getHttpServer())
      .get('/api/platform/overview')
      .set('Authorization', `Bearer ${tenantOwnerToken}`)
      .expect(403);

    expect(overviewRes.body.message).toMatch(/SuperAdmin privileges required/i);

    // Attempt to list tenants
    const tenantsRes = await request(app.getHttpServer())
      .get('/api/platform/tenants')
      .set('Authorization', `Bearer ${tenantOwnerToken}`)
      .expect(403);

    expect(tenantsRes.body.message).toMatch(/SuperAdmin privileges required/i);

    // Attempt to renew a subscription
    const renewRes = await request(app.getHttpServer())
      .post(`/api/platform/tenants/${tenantId}/subscription`)
      .set('Authorization', `Bearer ${tenantOwnerToken}`)
      .send({
        extensionDays: 30,
      })
      .expect(403);

    expect(renewRes.body.message).toMatch(/SuperAdmin privileges required/i);
  });
});
