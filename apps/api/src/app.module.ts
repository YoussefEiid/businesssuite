import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { PlatformModule } from './platform/platform.module';
import { TenantsModule } from './tenants/tenants.module';
import { PartiesModule } from './parties/parties.module';
import { InventoryModule } from './inventory/inventory.module';
import { SalesModule } from './sales/sales.module';
import { PurchasesModule } from './purchases/purchases.module';
import { TreasuryModule } from './treasury/treasury.module';
import { CRMModule } from './crm/crm.module';
import { ReportsModule } from './reports/reports.module';
import { HealthController } from './common/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'apps/api/.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120,
      },
    ]),
    PrismaModule,
    AuthModule,
    EntitlementsModule,
    PlatformModule,
    TenantsModule,
    PartiesModule,
    InventoryModule,
    SalesModule,
    PurchasesModule,
    TreasuryModule,
    CRMModule,
    ReportsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
