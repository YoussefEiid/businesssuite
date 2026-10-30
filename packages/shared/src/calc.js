"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.round = round;
exports.formatMoney = formatMoney;
exports.calculateLineAmounts = calculateLineAmounts;
exports.calculateWeightedAverageCost = calculateWeightedAverageCost;
function round(value, decimals = 4) {
    const factor = Math.pow(10, decimals);
    return Math.round((value + Number.EPSILON) * factor) / factor;
}
function formatMoney(value, decimals = 2) {
    return round(value, decimals).toFixed(decimals);
}
function calculateLineAmounts(input) {
    const quantity = Math.max(0, input.quantity);
    const unitPrice = Math.max(0, input.unitPrice);
    const grossAmount = round(quantity * unitPrice, 4);
    let discountAmount = 0;
    if (input.discountPercent && input.discountPercent > 0) {
        discountAmount = round((grossAmount * input.discountPercent) / 100, 4);
    }
    else if (input.discountAmount && input.discountAmount > 0) {
        discountAmount = round(Math.min(grossAmount, input.discountAmount), 4);
    }
    const netAfterDiscount = round(Math.max(0, grossAmount - discountAmount), 4);
    const taxRate = input.taxRate || 0;
    let netBeforeTax = netAfterDiscount;
    let taxAmount = 0;
    let totalAmount = netAfterDiscount;
    if (taxRate > 0) {
        if (input.isTaxInclusive) {
            netBeforeTax = round(netAfterDiscount / (1 + taxRate / 100), 4);
            taxAmount = round(netAfterDiscount - netBeforeTax, 4);
            totalAmount = netAfterDiscount;
        }
        else {
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
function calculateWeightedAverageCost(currentStock, currentAverageCost, incomingQuantity, incomingUnitPrice) {
    if (incomingQuantity <= 0)
        return currentAverageCost;
    const validCurrentStock = Math.max(0, currentStock);
    const validCurrentCost = Math.max(0, currentAverageCost);
    const currentTotalValue = validCurrentStock * validCurrentCost;
    const incomingTotalValue = incomingQuantity * Math.max(0, incomingUnitPrice);
    const totalQuantity = validCurrentStock + incomingQuantity;
    if (totalQuantity <= 0)
        return 0;
    return round((currentTotalValue + incomingTotalValue) / totalQuantity, 4);
}
//# sourceMappingURL=calc.js.map