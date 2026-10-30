import { ValidationPipe, BadRequestException } from '@nestjs/common';
import {
  CreateSalesInvoiceDto,
  CreateSalesQuotationDto,
  CreateSalesReturnDto,
} from '../src/sales/dto/sales.dto';
import {
  CreatePurchaseInvoiceDto,
  CreatePurchaseReturnDto,
} from '../src/purchases/dto/purchases.dto';
import { UpdateCompanyProfileDto, CreateBranchDto } from '../src/tenants/dto/tenant.dto';
import { CreateWarehouseDto, UpdateItemDto } from '../src/inventory/dto/inventory.dto';
import { ManageSubscriptionDto } from '../src/platform/dto/platform.dto';

describe('API Contract Drift & DTO Validation Regression Suite', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    transformOptions: { enableImplicitConversion: true },
  });

  describe('Sales Invoices Contract', () => {
    it('should REJECT legacy payload containing "lines" with "property lines should not exist"', async () => {
      const legacyPayload = {
        partyId: '11111111-1111-1111-1111-111111111111',
        warehouseId: '22222222-2222-2222-2222-222222222222',
        postImmediately: true,
        lines: [
          {
            itemId: '33333333-3333-3333-3333-333333333333',
            quantity: 2,
            unitPrice: 100,
          },
        ],
      };

      try {
        await validationPipe.transform(legacyPayload, {
          type: 'body',
          metatype: CreateSalesInvoiceDto,
        });
        fail('Should have thrown BadRequestException for non-whitelisted property "lines"');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = err.getResponse();
        const messages = Array.isArray(res.message) ? res.message : [res.message];
        expect(messages.some((m: string) => m.includes('property lines should not exist'))).toBe(true);
        expect(messages.some((m: string) => m.includes('items must be an array'))).toBe(true);
      }
    });

    it('should PASS updated contract with "items" and selected partyId', async () => {
      const validPayload = {
        partyId: '11111111-1111-1111-1111-111111111111',
        warehouseId: '22222222-2222-2222-2222-222222222222',
        postImmediately: true,
        items: [
          {
            itemId: '33333333-3333-3333-3333-333333333333',
            quantity: 2,
            unitPrice: 100,
            discountPercent: 0,
            taxRate: 15,
          },
        ],
      };

      const transformed = await validationPipe.transform(validPayload, {
        type: 'body',
        metatype: CreateSalesInvoiceDto,
      });

      expect(transformed).toBeInstanceOf(CreateSalesInvoiceDto);
      expect(transformed.items.length).toBe(1);
      expect(transformed.partyId).toBe(validPayload.partyId);
    });

    it('should PASS cash sale without partyId (auto-resolved to walk-in customer)', async () => {
      const posPayload = {
        warehouseId: '22222222-2222-2222-2222-222222222222',
        isCashSale: true,
        postImmediately: true,
        items: [
          {
            itemId: '33333333-3333-3333-3333-333333333333',
            quantity: 1,
            unitPrice: 50,
          },
        ],
      };

      const transformed = await validationPipe.transform(posPayload, {
        type: 'body',
        metatype: CreateSalesInvoiceDto,
      });

      expect(transformed).toBeInstanceOf(CreateSalesInvoiceDto);
      expect(transformed.partyId).toBeUndefined();
      expect(transformed.items.length).toBe(1);
    });
  });

  describe('Purchases Contract', () => {
    it('should REJECT legacy bill payload containing "lines"', async () => {
      const legacyPayload = {
        partyId: 'supplier-uuid',
        warehouseId: 'wh-uuid',
        lines: [
          {
            itemId: 'item-uuid',
            quantity: 10,
            unitPrice: 45,
          },
        ],
      };

      try {
        await validationPipe.transform(legacyPayload, {
          type: 'body',
          metatype: CreatePurchaseInvoiceDto,
        });
        fail('Should have thrown BadRequestException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = err.getResponse();
        const messages = Array.isArray(res.message) ? res.message : [res.message];
        expect(messages.some((m: string) => m.includes('property lines should not exist'))).toBe(true);
      }
    });

    it('should PASS valid purchase bill with "items"', async () => {
      const validPayload = {
        partyId: 'supplier-uuid',
        warehouseId: 'wh-uuid',
        items: [
          {
            itemId: 'item-uuid',
            quantity: 10,
            unitPrice: 45,
            taxRate: 15,
          },
        ],
      };

      const transformed = await validationPipe.transform(validPayload, {
        type: 'body',
        metatype: CreatePurchaseInvoiceDto,
      });

      expect(transformed).toBeInstanceOf(CreatePurchaseInvoiceDto);
      expect(transformed.items.length).toBe(1);
    });
  });

  describe('Returns Contracts', () => {
    it('should REJECT legacy sales return with "invoiceId" and "lines"', async () => {
      const legacySalesReturn = {
        invoiceId: 'inv-123',
        lines: [{ invoiceLineId: 'line-1', quantity: 2 }],
      };

      try {
        await validationPipe.transform(legacySalesReturn, {
          type: 'body',
          metatype: CreateSalesReturnDto,
        });
        fail('Should fail on legacy fields');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = err.getResponse();
        const messages = Array.isArray(res.message) ? res.message : [res.message];
        expect(messages.some((m: string) => m.includes('property lines should not exist'))).toBe(true);
      }
    });

    it('should PASS corrected sales return with "salesInvoiceId" and "items"', async () => {
      const validSalesReturn = {
        salesInvoiceId: 'inv-123',
        items: [{ itemId: 'item-123', quantity: 2 }],
      };

      const transformed = await validationPipe.transform(validSalesReturn, {
        type: 'body',
        metatype: CreateSalesReturnDto,
      });

      expect(transformed).toBeInstanceOf(CreateSalesReturnDto);
      expect(transformed.salesInvoiceId).toBe('inv-123');
      expect(transformed.items.length).toBe(1);
    });

    it('should PASS corrected purchase return with "items"', async () => {
      const validPurchaseReturn = {
        purchaseInvoiceId: 'purch-inv-123',
        items: [{ itemId: 'item-123', quantity: 3 }],
      };

      const transformed = await validationPipe.transform(validPurchaseReturn, {
        type: 'body',
        metatype: CreatePurchaseReturnDto,
      });

      expect(transformed).toBeInstanceOf(CreatePurchaseReturnDto);
      expect(transformed.items.length).toBe(1);
    });
  });

  describe('Company Settings & Inventory Drift Fixes', () => {
    it('should PASS UpdateCompanyProfileDto with flattened fields and currencyCode', async () => {
      const payload = {
        name: 'My Enterprise',
        taxNumber: '310000000000003',
        currencyCode: 'SAR',
        invoiceHeader: 'Welcome to Our Store',
        invoiceFooter: 'Thank you for your business',
        invoiceFooterAr: 'شكراً لتعاملكم معنا',
        termsAndConditions: 'All sales final',
        themeColor: '#0284c7',
      };

      const transformed = await validationPipe.transform(payload, {
        type: 'body',
        metatype: UpdateCompanyProfileDto,
      });

      expect(transformed).toBeInstanceOf(UpdateCompanyProfileDto);
      expect(transformed.currencyCode).toBe('SAR');
      expect(transformed.invoiceHeader).toBe('Welcome to Our Store');
    });

    it('should PASS CreateWarehouseDto and CreateBranchDto with isDefault', async () => {
      const whPayload = {
        code: 'WH-09',
        name: 'Central Hub',
        nameAr: 'المستودع المركزي',
        isDefault: true,
      };

      const whTransformed = await validationPipe.transform(whPayload, {
        type: 'body',
        metatype: CreateWarehouseDto,
      });
      expect(whTransformed.isDefault).toBe(true);

      const brPayload = {
        code: 'BR-09',
        name: 'Main HQ',
        nameAr: 'الفرع الرئيسي',
        isDefault: true,
      };

      const brTransformed = await validationPipe.transform(brPayload, {
        type: 'body',
        metatype: CreateBranchDto,
      });
      expect(brTransformed.isDefault).toBe(true);
    });

    it('should PASS UpdateItemDto with baseUnitId', async () => {
      const itemUpdate = {
        name: 'Updated Product Name',
        baseUnitId: 'unit-uuid-123',
        sellingPrice: 250,
      };

      const transformed = await validationPipe.transform(itemUpdate, {
        type: 'body',
        metatype: UpdateItemDto,
      });

      expect(transformed.baseUnitId).toBe('unit-uuid-123');
      expect(transformed.sellingPrice).toBe(250);
    });
  });

  describe('Platform Admin Subscription Renewal Contract', () => {
    it('should PASS subscription renewal containing extensionDays without "property extensionDays should not exist"', async () => {
      const renewalPayload = {
        planId: 'plan-growth-uuid',
        status: 'ACTIVE',
        extensionDays: 365,
        paymentAmount: 2490,
        paymentMethod: 'MANUAL_BANK_TRANSFER',
        notes: 'Annual renewal approved by Platform Owner',
      };

      const transformed = await validationPipe.transform(renewalPayload, {
        type: 'body',
        metatype: ManageSubscriptionDto,
      });

      expect(transformed).toBeInstanceOf(ManageSubscriptionDto);
      expect(transformed.planId).toBe('plan-growth-uuid');
      expect(transformed.extensionDays).toBe(365);
      expect(transformed.status).toBe('ACTIVE');
    });

    it('should PASS subscription renewal with customEndDate', async () => {
      const renewalPayload = {
        planId: 'plan-business-uuid',
        status: 'ACTIVE',
        customEndDate: '2028-01-01T00:00:00.000Z',
      };

      const transformed = await validationPipe.transform(renewalPayload, {
        type: 'body',
        metatype: ManageSubscriptionDto,
      });

      expect(transformed).toBeInstanceOf(ManageSubscriptionDto);
      expect(transformed.customEndDate).toBe('2028-01-01T00:00:00.000Z');
    });

    it('should REJECT unexpected properties under forbidNonWhitelisted: true', async () => {
      const invalidPayload = {
        planId: 'plan-uuid',
        invalidRandomField: 12345,
      };

      try {
        await validationPipe.transform(invalidPayload, {
          type: 'body',
          metatype: ManageSubscriptionDto,
        });
        fail('Should reject non-whitelisted property');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = err.getResponse();
        const messages = Array.isArray(res.message) ? res.message : [res.message];
        expect(messages.some((m: string) => m.includes('property invalidRandomField should not exist'))).toBe(true);
      }
    });
  });
});
