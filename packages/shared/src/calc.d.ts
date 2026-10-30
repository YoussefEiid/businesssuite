export declare function round(value: number, decimals?: number): number;
export declare function formatMoney(value: number, decimals?: number): string;
export interface LineCalculationInput {
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
    discountAmount?: number;
    taxRate?: number;
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
export declare function calculateLineAmounts(input: LineCalculationInput): LineCalculationResult;
export declare function calculateWeightedAverageCost(currentStock: number, currentAverageCost: number, incomingQuantity: number, incomingUnitPrice: number): number;
