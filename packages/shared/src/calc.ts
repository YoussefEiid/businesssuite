/**
 * Financial and Inventory Arithmetic Helpers
 * Uses integer/fixed precision principles to prevent floating point inaccuracies.
 */

export function round(value: number, decimals: number = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function formatMoney(value: number, decimals: number = 2): string {
  return round(value, decimals).toFixed(decimals);
}

export interface LineCalculationInput {
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  discountAmount?: number;
  taxRate?: number; // e.g. 15 for 15%
  isTaxInclusive?: boolean;
}

export interface LineCalculationResult {
  quantity: number;
  unitPrice: number;
  grossAmount: number;
  discountAmount: number;
  netBeforeTax: number;
  taxAmount: number;
  totalAmount: number;
}

export function calculateLineAmounts(input: LineCalculationInput): LineCalculationResult {
  const quantity = Math.max(0, input.quantity);
  const unitPrice = Math.max(0, input.unitPrice);
  const grossAmount = round(quantity * unitPrice, 4);

  let discountAmount = 0;
  if (input.discountPercent && input.discountPercent > 0) {
    discountAmount = round((grossAmount * input.discountPercent) / 100, 4);
  } else if (input.discountAmount && input.discountAmount > 0) {
    discountAmount = round(Math.min(grossAmount, input.discountAmount), 4);
  }

  const netAfterDiscount = round(Math.max(0, grossAmount - discountAmount), 4);
  const taxRate = input.taxRate || 0;

  let netBeforeTax = netAfterDiscount;
  let taxAmount = 0;
  let totalAmount = netAfterDiscount;

  if (taxRate > 0) {
    if (input.isTaxInclusive) {
      // price includes tax: net = total / (1 + rate/100)
      netBeforeTax = round(netAfterDiscount / (1 + taxRate / 100), 4);
      taxAmount = round(netAfterDiscount - netBeforeTax, 4);
      totalAmount = netAfterDiscount;
    } else {
      // price excludes tax: tax = net * rate/100
      netBeforeTax = netAfterDiscount;
      taxAmount = round((netBeforeTax * taxRate) / 100, 4);
      totalAmount = round(netBeforeTax + taxAmount, 4);
    }
  }

  return {
    quantity,
    unitPrice,
    grossAmount,
    discountAmount,
    netBeforeTax,
    taxAmount,
    totalAmount,
  };
}

/**
 * Calculates the Moving Weighted Average Cost (WAC)
 * New WAC = (Current Stock * Current Cost + Incoming Qty * Incoming Unit Price) / (Current Stock + Incoming Qty)
 */
export function calculateWeightedAverageCost(
  currentStock: number,
  currentAverageCost: number,
  incomingQuantity: number,
  incomingUnitPrice: number,
): number {
  if (incomingQuantity <= 0) return currentAverageCost;
  
  const validCurrentStock = Math.max(0, currentStock);
  const validCurrentCost = Math.max(0, currentAverageCost);
  const currentTotalValue = validCurrentStock * validCurrentCost;
  const incomingTotalValue = incomingQuantity * Math.max(0, incomingUnitPrice);
  const totalQuantity = validCurrentStock + incomingQuantity;

  if (totalQuantity <= 0) return 0;

  return round((currentTotalValue + incomingTotalValue) / totalQuantity, 4);
}
