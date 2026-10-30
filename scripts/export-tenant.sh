#!/usr/bin/env bash
set -e

TENANT_ID=$1
EXPORT_DIR=${EXPORT_DIR:-"./tenant_exports"}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

if [ -z "$TENANT_ID" ]; then
  echo "Usage: ./export-tenant.sh <tenant-id>"
  exit 1
fi

mkdir -p "$EXPORT_DIR"
OUTPUT_FILE="$EXPORT_DIR/tenant_${TENANT_ID}_${TIMESTAMP}.json"

echo "==> Exporting isolated data for Tenant $TENANT_ID..."
# Exports tenant parties, items, invoices, and vouchers via direct query
npx ts-node -e "
  const { PrismaClient } = require('@prisma/client');
  const fs = require('fs');
  const prisma = new PrismaClient();
  async function run() {
    const tenant = await prisma.tenant.findUnique({
      where: { id: '$TENANT_ID' },
      include: {
        parties: true,
        items: true,
        salesInvoices: { include: { items: true } },
        purchaseInvoices: { include: { items: true } },
        treasuryVouchers: { include: { allocations: true } },
      }
    });
    fs.writeFileSync('$OUTPUT_FILE', JSON.stringify(tenant, null, 2));
    console.log('Saved tenant export to $OUTPUT_FILE');
  }
  run().finally(() => prisma.\$disconnect());
"

echo "==> Isolated export complete: $OUTPUT_FILE"
