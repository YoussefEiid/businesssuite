'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '../../../src/components/layout/DashboardLayout';
import { ApiService } from '../../../src/services/api';
import { useLanguage } from '../../../src/hooks/use-language';
import { useToast } from '../../../src/hooks/use-toast';
import { useCompany } from '../../../src/hooks/use-company';
import { Button } from '../../../src/components/ui/Button';
import { Input } from '../../../src/components/ui/Input';
import { Select } from '../../../src/components/ui/Select';
import { Badge } from '../../../src/components/ui/Badge';
import { PrintableInvoiceModal } from '../../../src/components/ui/PrintableInvoiceModal';
import {
  Barcode,
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  Printer,
  RotateCcw,
  User,
  Clock,
  Layers,
  CheckCircle2,
  Store,
  PauseCircle,
  PlayCircle,
  Keyboard,
} from 'lucide-react';

interface CartLine {
  itemId: string;
  name: string;
  nameAr?: string;
  code: string;
  barcode?: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountPercent: number;
  availableStock?: number;
}

export default function POSPage() {
  const { isRtl } = useLanguage();
  const toast = useToast();
  const { formatMoney, company: currentCompany } = useCompany();

  const [items, setItems] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [companyProfile, setCompanyProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // POS State
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [tenderedAmount, setTenderedAmount] = useState<string>('');

  // Cart Lines
  const [cart, setCart] = useState<CartLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<any | null>(null);
  const [heldCarts, setHeldCarts] = useState<{ id: string; time: string; lines: CartLine[]; partyId: string }[]>([]);

  const barcodeRef = useRef<HTMLInputElement>(null);
  const tenderedRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [itms, pts, whs, accs, prof] = await Promise.all([
        ApiService.listItems(),
        ApiService.listParties('CUSTOMER'),
        ApiService.listWarehouses(),
        ApiService.listAccounts().catch(() => []),
        ApiService.getCompanyProfile().catch(() => null),
      ]);
      setItems(itms || []);
      setParties(pts || []);
      setWarehouses(whs || []);
      setAccounts(accs || []);
      setCompanyProfile(prof);

      if (whs.length > 0) setSelectedWarehouseId(whs[0].id);
      if (accs.length > 0) setSelectedAccountId(accs[0].id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load POS data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Auto-focus barcode scanner input
    if (barcodeRef.current) barcodeRef.current.focus();
  }, []);

  // Filter items for product grid
  const categories = Array.from(
    new Set(items.map((i) => i.category?.name || (isRtl ? 'عام' : 'General'))),
  );

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.nameAr?.includes(searchQuery) ||
      item.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.barcode?.includes(searchQuery);

    const matchesCat =
      selectedCategory === 'ALL' ||
      (item.category?.name || (isRtl ? 'عام' : 'General')) === selectedCategory;

    return matchesSearch && matchesCat;
  });

  // Add Item to Cart (either from grid click or barcode scan)
  const addItemToCart = (item: any) => {
    setCart((prev) => {
      const existingIdx = prev.findIndex((l) => l.itemId === item.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].quantity += 1;
        return updated;
      }

      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          nameAr: item.nameAr,
          code: item.code,
          barcode: item.barcode,
          quantity: 1,
          unitPrice: Number(item.sellingPrice || 0),
          taxRate: Number(item.taxRate ?? 0),
          discountPercent: 0,
          availableStock: item.totalStock,
        },
      ];
    });

    toast.info(
      isRtl ? `تمت إضافة "${item.nameAr || item.name}"` : `Added "${item.name}"`,
    );
  };

  // Comprehensive barcode scanner resolver: direct barcode, code, and unit conversions
  const handleScanCode = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    // 1. Direct item match
    const direct = items.find(
      (i) => i.barcode === trimmed || i.code?.toLowerCase() === trimmed.toLowerCase(),
    );
    if (direct) {
      addItemToCart(direct);
      return;
    }

    // 2. Unit conversions match
    for (const it of items) {
      if (Array.isArray(it.conversions)) {
        const conv = it.conversions.find((c: any) => c.barcode === trimmed);
        if (conv) {
          addItemToCart({
            ...it,
            sellingPrice: conv.sellingPrice || it.sellingPrice,
            name: `${it.name} (${conv.unit?.name || 'Unit'})`,
            nameAr: `${it.nameAr || it.name} (${conv.unit?.nameAr || conv.unit?.name || 'وحدة'})`,
          });
          return;
        }
      }
    }

    toast.warning(
      isRtl ? `لم يتم العثور على صنف بالباركود: ${trimmed}` : `No product found for barcode: ${trimmed}`,
    );
  };

  // Barcode Enter Handler from UI Input
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    handleScanCode(barcodeInput);
    setBarcodeInput('');
  };

  // Hold / Resume Sale toggle
  const handleToggleHoldSale = () => {
    if (cart.length > 0) {
      const newHold = {
        id: String(Date.now()),
        time: new Date().toLocaleTimeString(isRtl ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
        lines: [...cart],
        partyId: selectedPartyId,
      };
      setHeldCarts((prev) => [newHold, ...prev]);
      setCart([]);
      setTenderedAmount('');
      toast.info(isRtl ? 'تم تعليق الفاتورة الحالية [F4]' : 'Current sale held [F4]');
    } else if (heldCarts.length > 0) {
      const [latest, ...rest] = heldCarts;
      setCart(latest.lines);
      setSelectedPartyId(latest.partyId);
      setHeldCarts(rest);
      toast.success(isRtl ? 'تم استئناف الفاتورة المعلقة' : 'Resumed held sale');
    } else {
      toast.warning(isRtl ? 'السلة فارغة ولا توجد فواتير معلقة' : 'Cart is empty and no held sales');
    }
  };

  // Global Keyboard Shortcuts (F1, F2, F4, F8, F9) & USB HID Scanner Burst Detector
  useEffect(() => {
    let burstBuffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Functional Hotkeys
      if (e.key === 'F1') {
        e.preventDefault();
        barcodeRef.current?.focus();
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        setSelectedPartyId('');
        toast.info(isRtl ? 'تم اختيار عميل نقدي عام' : 'Walk-in customer selected');
        return;
      }
      if (e.key === 'F4') {
        e.preventDefault();
        handleToggleHoldSale();
        return;
      }
      if (e.key === 'F8') {
        e.preventDefault();
        tenderedRef.current?.focus();
        return;
      }
      if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0 && !submitting) {
          handleCheckout();
        }
        return;
      }

      // USB HID Barcode Scanner Burst Detector
      const now = Date.now();
      const isPrintable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

      if (isPrintable) {
        if (now - lastKeyTime > 60) {
          burstBuffer = '';
        }
        burstBuffer += e.key;
        lastKeyTime = now;
      } else if (e.key === 'Enter') {
        if (burstBuffer.length >= 3 && now - lastKeyTime < 60) {
          e.preventDefault();
          handleScanCode(burstBuffer);
          burstBuffer = '';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, cart, heldCarts, submitting, isRtl]);

  // Adjust Cart Item Quantity
  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.itemId === itemId) {
            const newQty = l.quantity + delta;
            return newQty > 0 ? { ...l, quantity: newQty } : null;
          }
          return l;
        })
        .filter(Boolean) as CartLine[],
    );
  };

  const updateTaxRate = (itemId: string, taxRate: number) => {
    setCart((prev) =>
      prev.map((l) => (l.itemId === itemId ? { ...l, taxRate } : l)),
    );
  };

  const removeCartItem = (itemId: string) => {
    setCart((prev) => prev.filter((l) => l.itemId !== itemId));
  };

  const clearCart = () => {
    setCart([]);
    setTenderedAmount('');
  };

  // Computations
  const subtotal = cart.reduce((sum, line) => {
    const lineSub = line.quantity * line.unitPrice * (1 - line.discountPercent / 100);
    return sum + lineSub;
  }, 0);

  const taxAmount = cart.reduce((sum, line) => {
    const lineSub = line.quantity * line.unitPrice * (1 - line.discountPercent / 100);
    return sum + lineSub * (line.taxRate / 100);
  }, 0);

  const grandTotal = subtotal + taxAmount;
  const tendered = parseFloat(tenderedAmount) || 0;
  const changeDue = Math.max(0, tendered - grandTotal);

  // Complete POS Sale
  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.warning(isRtl ? 'السلة فارغة' : 'Cart is empty');
      return;
    }
    if (!selectedWarehouseId) {
      toast.error(isRtl ? 'يرجى اختيار المستودع' : 'Please select warehouse');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        partyId: selectedPartyId || undefined,
        warehouseId: selectedWarehouseId,
        postImmediately: true,
        isCashSale: true,
        treasuryAccountId: selectedAccountId || undefined,
        items: cart.map((line) => ({
          itemId: line.itemId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountPercent: line.discountPercent,
          taxRate: line.taxRate,
        })),
        notes: `POS Cashier Checkout (${paymentMethod})`,
      };

      const res = await ApiService.createInvoice(payload);
      toast.success(
        isRtl
          ? `تم اعتماد الفاتورة #${res.invoiceNumber || res.id} بنجاح!`
          : `Invoice #${res.invoiceNumber || res.id} completed successfully!`,
      );

      // Ensure line items have populated item names for printing
      const enrichedItems = (res.items || []).map((line: any) => {
        if (line.item?.name || line.item?.nameAr) return line;
        const originalCartItem = cart.find((c) => c.itemId === line.itemId);
        return {
          ...line,
          item: {
            ...(line.item || {}),
            name: originalCartItem?.name || line.item?.name,
            nameAr: originalCartItem?.nameAr || line.item?.nameAr,
            code: originalCartItem?.code || line.item?.code,
          },
        };
      });

      const finalInvoice = { ...res, items: enrichedItems };

      // Desktop hardware actions: Kick cash drawer on cash sales
      if (paymentMethod === 'CASH' && typeof window !== 'undefined' && window.businessSuiteDesktop?.openCashDrawer) {
        window.businessSuiteDesktop.openCashDrawer().catch(() => {});
      }

      // Desktop silent printing if configured
      if (typeof window !== 'undefined' && window.businessSuiteDesktop?.printReceipt) {
        const desktop = window.businessSuiteDesktop;
        desktop.getDesktopConfig().then((cfg) => {
          if (cfg?.silentPrinting) {
            desktop.printReceipt({
              invoiceNumber: String(finalInvoice.invoiceNumber || finalInvoice.id),
              date: new Date().toLocaleString(isRtl ? 'ar-SA' : 'en-US'),
              companyName: companyProfile?.nameAr || companyProfile?.name || currentCompany?.name || 'BusinessSuite',
              companyTaxNumber: companyProfile?.taxNumber || currentCompany?.taxNumber,
              companyPhone: companyProfile?.phone || currentCompany?.phone,
              companyAddress: companyProfile?.address || currentCompany?.address,
              currency: currentCompany?.currencyCode || 'SAR',
              items: enrichedItems.map((line: any) => ({
                name: line.item?.name || 'صنف',
                nameAr: line.item?.nameAr || line.item?.name || 'صنف',
                quantity: Number(line.quantity || 1),
                unitPrice: Number(line.unitPrice || 0),
                total: Number(line.totalAmount || (line.quantity * line.unitPrice) || 0),
                taxRate: Number(line.taxRate || 0),
              })),
              subtotal: Number(finalInvoice.subtotal || subtotal),
              taxTotal: Number(finalInvoice.taxTotal || taxAmount),
              discountTotal: Number(finalInvoice.discountTotal || 0),
              grandTotal: Number(finalInvoice.grandTotal || grandTotal),
              tenderedAmount: tendered > 0 ? tendered : undefined,
              changeDue: changeDue > 0 ? changeDue : undefined,
              paymentMethod: paymentMethod,
              notes: finalInvoice.notes,
              paperWidth: cfg.receiptPaperWidth || '80mm',
              silent: true,
            }).catch((err) => console.error('Silent print failed:', err));
          }
        }).catch(() => {});
      }

      setCompletedInvoice(finalInvoice);
      clearCart();
    } catch (err: any) {
      toast.error(err.message || 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-5.5rem)] gap-3 select-none">
        {/* POS Header Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 shadow-xs flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>{isRtl ? 'شاشة الكاشير السريعة' : 'High-Speed Cashier POS'}</span>
                <Badge variant="success" size="sm">
                  {isRtl ? 'الوردية نشطة' : 'Shift Active'}
                </Badge>
              </h2>
              <p className="text-2xs text-slate-500 dark:text-slate-400">
                {companyProfile?.name || 'BusinessSuite'} &bull; {new Date().toLocaleTimeString(isRtl ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Hold Sale Button [F4] */}
            <button
              type="button"
              onClick={handleToggleHoldSale}
              className={`h-8 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border ${
                heldCarts.length > 0
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-100'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
              }`}
              title={isRtl ? 'تعليق / استئناف الفاتورة [F4]' : 'Hold / Resume Sale [F4]'}
            >
              {heldCarts.length > 0 ? (
                <>
                  <PlayCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>{isRtl ? `استئناف (${heldCarts.length})` : `Resume (${heldCarts.length})`}</span>
                  <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-bold">[F4]</span>
                </>
              ) : (
                <>
                  <PauseCircle className="w-4 h-4 text-slate-500" />
                  <span>{isRtl ? 'تعليق' : 'Hold'}</span>
                  <span className="text-[10px] font-mono text-slate-400 font-bold">[F4]</span>
                </>
              )}
            </button>

            {/* Keyboard Hotkeys Hint */}
            <div className="hidden xl:flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700">
              <Keyboard className="w-3.5 h-3.5 text-slate-400" />
              <span>F1: {isRtl ? 'باركود' : 'Scan'}</span> &bull;
              <span>F2: {isRtl ? 'نقدي' : 'Cash'}</span> &bull;
              <span>F4: {isRtl ? 'تعليق' : 'Hold'}</span> &bull;
              <span>F8: {isRtl ? 'المستلم' : 'Tendered'}</span> &bull;
              <span>F9: {isRtl ? 'إتمام' : 'Pay'}</span>
            </div>

            {/* Customer Selector */}
            <div className="w-44">
              <Select
                value={selectedPartyId}
                onChange={(e) => setSelectedPartyId(e.target.value)}
                className="h-8 text-xs"
              >
                <option value="">{isRtl ? 'عميل نقدي عام (افتراضي)' : 'Walk-in Cash Customer'}</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameAr || p.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Warehouse Selector */}
            <div className="w-36">
              <Select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="h-8 text-xs"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.nameAr || w.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {/* POS Work Area */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
          {/* Left Column: Product Selection Grid */}
          <div className="lg:col-span-7 flex flex-col gap-2.5 min-h-0">
            {/* Barcode & Search Controls */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs flex items-center gap-2 flex-shrink-0">
              <form onSubmit={handleBarcodeSubmit} className="flex-1 relative">
                <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-slate-400">
                  <Barcode className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                </div>
                <input
                  ref={barcodeRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder={isRtl ? 'مسح الباركود (Enter للإضافة)...' : 'Scan barcode (Enter to add)...'}
                  className="block w-full h-9 ps-9 pe-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                />
              </form>

              <div className="relative w-44">
                <div className="absolute inset-y-0 start-0 ps-2.5 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isRtl ? 'بحث بالأسم...' : 'Search name...'}
                  className="block w-full h-9 ps-8 pe-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/30"
                />
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === 'ALL'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                {isRtl ? 'جميع الأصناف' : 'All Items'}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    selectedCategory === cat
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Products Grid */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
              {filteredItems.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  {isRtl ? 'لا توجد أصناف مطابقة' : 'No items found'}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
                  {filteredItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addItemToCart(item)}
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-sky-50/60 dark:hover:bg-sky-950/40 hover:border-sky-300 dark:hover:border-sky-700 transition text-start flex flex-col justify-between h-24 group"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-2 leading-tight">
                          {isRtl ? item.nameAr || item.name : item.name || item.nameAr}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                          {item.barcode || item.code}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                        <span className="text-xs font-extrabold text-sky-600 dark:text-sky-400 tabular-nums">
                          {formatMoney(item.sellingPrice || 0)}
                        </span>
                        <span className="text-[10px] text-slate-500 tabular-nums">
                          {isRtl ? `مخزون: ${item.totalStock}` : `Stock: ${item.totalStock}`}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Active Cart & Checkout */}
          <div className="lg:col-span-5 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden min-h-0">
            {/* Cart Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {isRtl ? 'سلة المبيعات' : 'Sales Cart'} ({cart.length})
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-2xs text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1 font-semibold"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{isRtl ? 'تفريغ السلة' : 'Clear'}</span>
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-2">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <ShoppingCart className="w-10 h-10 stroke-[1.2] opacity-40 mb-2" />
                  <p className="text-xs font-medium">{isRtl ? 'السلة فارغة' : 'Cart is empty'}</p>
                  <p className="text-2xs mt-0.5">{isRtl ? 'امسح الباركود أو اضغط على صنف للإضافة' : 'Scan barcode or tap an item'}</p>
                </div>
              ) : (
                cart.map((line) => (
                  <div key={line.itemId} className="p-2.5 flex items-center justify-between gap-2 text-xs">
                    <div className="flex-1 min-w-0">
                      <h5 className="font-bold text-slate-800 dark:text-slate-200 truncate">
                        {isRtl ? line.nameAr || line.name : line.name}
                      </h5>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-2xs text-slate-400 tabular-nums">
                          {formatMoney(line.unitPrice)}
                        </span>
                        {line.taxRate > 0 ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            {isRtl ? `ضريبة ${line.taxRate}%` : `VAT ${line.taxRate}%`}
                            <button
                              type="button"
                              onClick={() => updateTaxRate(line.itemId, 0)}
                              className="text-amber-600 hover:text-rose-600 dark:text-amber-400 dark:hover:text-rose-400 font-bold leading-none cursor-pointer"
                              title={isRtl ? 'إلغاء الضريبة' : 'Remove tax'}
                            >
                              &times;
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => updateTaxRate(line.itemId, 15)}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-3xs text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 border border-transparent hover:border-sky-200 transition cursor-pointer"
                            title={isRtl ? 'تطبيق ضريبة 15%' : 'Apply 15% VAT'}
                          >
                            + {isRtl ? 'ضريبة 15%' : 'VAT 15%'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => updateQuantity(line.itemId, -1)}
                        className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 transition"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center font-bold font-mono text-xs tabular-nums text-slate-900 dark:text-slate-100">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(line.itemId, 1)}
                        className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 transition"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Line Total & Remove */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="w-16 text-end font-bold text-slate-900 dark:text-slate-100 tabular-nums text-xs">
                        {formatMoney(line.quantity * line.unitPrice)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeCartItem(line.itemId)}
                        className="text-slate-400 hover:text-rose-500 p-1 rounded transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart Financial Summary & Checkout */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex-shrink-0 space-y-3">
              {/* Totals Breakdown */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>{isRtl ? 'المجموع الفرعي' : 'Subtotal'}:</span>
                  <span className="font-mono tabular-nums">{formatMoney(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span>{isRtl ? 'ضريبة القيمة المضافة (VAT)' : 'VAT'}:</span>
                    {cart.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const anyTax = cart.some((l) => l.taxRate > 0);
                          const targetRate = anyTax ? 0 : 15;
                          setCart((prev) => prev.map((l) => ({ ...l, taxRate: targetRate })));
                        }}
                        className="text-3xs text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                      >
                        {cart.some((l) => l.taxRate > 0)
                          ? (isRtl ? '(إلغاء الكل)' : '(Clear all)')
                          : (isRtl ? '(تطبيق 15%)' : '(Apply 15%)')}
                      </button>
                    )}
                  </div>
                  <span className="font-mono tabular-nums">{formatMoney(taxAmount)}</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-slate-900 dark:text-slate-100 pt-1.5 border-t border-slate-200 dark:border-slate-700">
                  <span>{isRtl ? 'الإجمالي النهائي' : 'Grand Total'}:</span>
                  <span className="text-sky-600 dark:text-sky-400 font-mono tabular-nums">
                    {formatMoney(grandTotal)}
                  </span>
                </div>
              </div>

              {/* Payment Method Switcher */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition border ${
                    paymentMethod === 'CASH'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>{isRtl ? 'نقداً (Cash)' : 'Cash'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CARD')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition border ${
                    paymentMethod === 'CARD'
                      ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>{isRtl ? 'شبكة / بطاقة (Card)' : 'Card'}</span>
                </button>
              </div>

              {/* Cash Tendered & Change */}
              {paymentMethod === 'CASH' && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                      {isRtl ? 'المبلغ المستلم' : 'Cash Received'}
                    </label>
                    <input
                      ref={tenderedRef}
                      type="number"
                      step="0.01"
                      value={tenderedAmount}
                      onChange={(e) => setTenderedAmount(e.target.value)}
                      placeholder={grandTotal.toFixed(2)}
                      className="block w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                      {isRtl ? 'المتبقي للعميل' : 'Change Due'}
                    </label>
                    <div className="h-8 px-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 flex items-center font-bold font-mono text-xs tabular-nums">
                      {formatMoney(changeDue)}
                    </div>
                  </div>
                </div>
              )}

              {/* Big Checkout Button */}
              <Button
                variant="primary"
                size="lg"
                loading={submitting}
                disabled={cart.length === 0}
                onClick={handleCheckout}
                className="w-full font-bold shadow-md h-11"
                icon={<CheckCircle2 className="w-5 h-5" />}
              >
                {isRtl
                  ? `إتمام البيع (${formatMoney(grandTotal)})`
                  : `Complete Checkout (${formatMoney(grandTotal)})`}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Printable Receipt Modal */}
      {completedInvoice && (
        <PrintableInvoiceModal
          isOpen={!!completedInvoice}
          onClose={() => setCompletedInvoice(null)}
          invoice={completedInvoice}
          companyInfo={companyProfile || currentCompany}
          type="sales"
        />
      )}
    </DashboardLayout>
  );
}
