'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../src/components/layout/DashboardLayout';
import { ApiService } from '../../../src/services/api';
import { useLanguage } from '../../../src/hooks/use-language';
import { useCompany } from '../../../src/hooks/use-company';
import { useToast } from '../../../src/hooks/use-toast';
import { useConfirm } from '../../../src/hooks/use-confirm';
import { useDebounce } from '../../../src/hooks/use-debounce';
import { DataTable, Column } from '../../../src/components/ui/DataTable';
import { Modal } from '../../../src/components/ui/Modal';
import { Button } from '../../../src/components/ui/Button';
import { Input } from '../../../src/components/ui/Input';
import { Select } from '../../../src/components/ui/Select';
import { Badge } from '../../../src/components/ui/Badge';
import {
  Plus,
  Package,
  Layers,
  ArrowLeftRight,
  Sliders,
  Upload,
  Pencil,
  Trash2,
  Barcode,
  Boxes,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export default function InventoryPage() {
  const { isRtl } = useLanguage();
  const { formatMoney } = useCompany();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'LOW_STOCK' | 'STOCK' | 'SERVICE'>('ALL');

  // Modals
  const [showItemModal, setShowItemModal] = useState(false);
  const [submittingItem, setSubmittingItem] = useState(false);
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [submittingEditItem, setSubmittingEditItem] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [submittingTransfer, setSubmittingTransfer] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [submittingAdj, setSubmittingAdj] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [conversionModalItem, setConversionModalItem] = useState<any | null>(null);
  const [submittingConversion, setSubmittingConversion] = useState(false);

  // New Item State
  const [newItem, setNewItem] = useState({
    code: '',
    barcode: '',
    name: '',
    nameAr: '',
    type: 'STOCK',
    categoryId: '',
    baseUnitId: '',
    purchasePrice: 0,
    sellingPrice: 0,
    minStockLevel: 5,
    taxRate: 0,
    initialQuantity: 0,
    initialWarehouseId: '',
  });

  // Edit Item State
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Transfer State
  const [transferData, setTransferData] = useState({
    sourceWarehouseId: '',
    destinationWarehouseId: '',
    itemId: '',
    quantity: 1,
    notes: '',
  });

  // Adjustment State
  const [adjData, setAdjData] = useState({
    warehouseId: '',
    itemId: '',
    actualQuantity: 0,
    reason: '',
  });

  // Conversion Form State
  const [newConversion, setNewConversion] = useState({
    unitId: '',
    conversionRate: 12,
    sellingPrice: '',
    purchasePrice: '',
    isDefaultSale: false,
    isDefaultPurchase: false,
  });

  // Import State
  const [importCsvText, setImportCsvText] = useState('');
  const [importSubmitting, setImportSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [itms, whs, cats, unts] = await Promise.all([
        ApiService.listItems(debouncedSearch || undefined, selectedCategory || undefined),
        ApiService.listWarehouses(),
        ApiService.listCategories().catch(() => []),
        ApiService.listUnits().catch(() => []),
      ]);
      setItems(itms || []);
      setWarehouses(whs || []);
      setCategories(cats || []);
      setUnits(unts || []);

      if (whs.length > 0) {
        setNewItem((prev) => ({ ...prev, initialWarehouseId: prev.initialWarehouseId || whs[0].id }));
        setTransferData((prev) => ({
          ...prev,
          sourceWarehouseId: prev.sourceWarehouseId || whs[0].id,
          destinationWarehouseId: prev.destinationWarehouseId || whs[1]?.id || whs[0].id,
        }));
        setAdjData((prev) => ({ ...prev, warehouseId: prev.warehouseId || whs[0].id }));
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [debouncedSearch, selectedCategory]);

  // Tab Filtering
  const filteredItems = items.filter((item) => {
    if (activeTab === 'LOW_STOCK') {
      return Number(item.totalStock || 0) <= Number(item.minStockLevel || 0);
    }
    if (activeTab === 'STOCK') {
      return item.type === 'STOCK';
    }
    if (activeTab === 'SERVICE') {
      return item.type === 'SERVICE';
    }
    return true;
  });

  // Handlers
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.nameAr.trim() && !newItem.name.trim()) {
      toast.warning(isRtl ? 'يرجى إدخال اسم الصنف' : 'Please enter item name');
      return;
    }

    setSubmittingItem(true);
    try {
      await ApiService.createItem({
        ...newItem,
        nameAr: newItem.nameAr || newItem.name,
        name: newItem.name || newItem.nameAr,
        purchasePrice: Number(newItem.purchasePrice),
        sellingPrice: Number(newItem.sellingPrice),
        minStockLevel: Number(newItem.minStockLevel),
        taxRate: Number(newItem.taxRate),
        initialQuantity: Number(newItem.initialQuantity),
        categoryId: newItem.categoryId || undefined,
        baseUnitId: newItem.baseUnitId || undefined,
        initialWarehouseId: newItem.initialWarehouseId || undefined,
      });

      toast.success(isRtl ? 'تمت إضافة الصنف بنجاح' : 'Item created successfully');
      setShowItemModal(false);
      setNewItem({
        code: '',
        barcode: '',
        name: '',
        nameAr: '',
        type: 'STOCK',
        categoryId: '',
        baseUnitId: '',
        purchasePrice: 0,
        sellingPrice: 0,
        minStockLevel: 5,
        taxRate: 0,
        initialQuantity: 0,
        initialWarehouseId: warehouses[0]?.id || '',
      });
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create item');
    } finally {
      setSubmittingItem(false);
    }
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setSubmittingEditItem(true);
    try {
      await ApiService.updateItem(editingItem.id, {
        nameAr: editingItem.nameAr || editingItem.name,
        name: editingItem.name || editingItem.nameAr,
        barcode: editingItem.barcode || undefined,
        purchasePrice: Number(editingItem.purchasePrice),
        sellingPrice: Number(editingItem.sellingPrice),
        minStockLevel: Number(editingItem.minStockLevel),
        taxRate: Number(editingItem.taxRate),
        categoryId: editingItem.categoryId || undefined,
        baseUnitId: editingItem.baseUnitId || undefined,
      });

      toast.success(isRtl ? 'تم تحديث بيانات الصنف بنجاح' : 'Item updated successfully');
      setShowEditItemModal(false);
      setEditingItem(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update item');
    } finally {
      setSubmittingEditItem(false);
    }
  };

  const handleDeleteItem = async (item: any) => {
    const ok = await confirm({
      title: isRtl ? 'حذف الصنف' : 'Delete Item',
      message: isRtl
        ? `هل أنت متأكد من حذف الصنف "${item.nameAr || item.name}"؟ سيتم منع الحذف في حال وجود حركات مخزنية أو فواتير سابقة.`
        : `Delete item "${item.name}"? Deletion is prevented if previous transactions exist.`,
      isDestructive: true,
    });
    if (!ok) return;

    try {
      await ApiService.deleteItem(item.id);
      toast.success(isRtl ? 'تم حذف الصنف بنجاح' : 'Item deleted');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete item');
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferData.sourceWarehouseId === transferData.destinationWarehouseId) {
      toast.warning(isRtl ? 'لا يمكن التحويل لنفس المستودع' : 'Source and destination cannot be identical');
      return;
    }
    if (!transferData.itemId || transferData.quantity <= 0) {
      toast.warning(isRtl ? 'يرجى اختيار الصنف والكمية' : 'Please select item and quantity');
      return;
    }

    setSubmittingTransfer(true);
    try {
      await ApiService.transferStock({
        ...transferData,
        quantity: Number(transferData.quantity),
      });
      toast.success(isRtl ? 'تم تحويل المخزون وتحديث أرصدة المستودعات بنجاح' : 'Stock transferred successfully');
      setShowTransferModal(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to transfer stock');
    } finally {
      setSubmittingTransfer(false);
    }
  };

  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjData.itemId || !adjData.warehouseId) {
      toast.warning(isRtl ? 'يرجى اختيار الصنف والمستودع' : 'Please select item and warehouse');
      return;
    }

    setSubmittingAdj(true);
    try {
      await ApiService.adjustStock({
        ...adjData,
        actualQuantity: Number(adjData.actualQuantity),
      });
      toast.success(isRtl ? 'تم تسجيل تسوية المخزون وتحديث الرصيد الفعلي' : 'Stock adjusted successfully');
      setShowAdjustmentModal(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to adjust stock');
    } finally {
      setSubmittingAdj(false);
    }
  };

  const handleAddConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conversionModalItem || !newConversion.unitId) return;

    setSubmittingConversion(true);
    try {
      await ApiService.addItemUnitConversion(conversionModalItem.id, {
        unitId: newConversion.unitId,
        conversionRate: Number(newConversion.conversionRate),
        sellingPrice: newConversion.sellingPrice ? Number(newConversion.sellingPrice) : undefined,
        purchasePrice: newConversion.purchasePrice ? Number(newConversion.purchasePrice) : undefined,
      });
      toast.success(isRtl ? 'تمت إضافة معامل تحويل الوحدة بنجاح' : 'Unit conversion added');
      const updatedItem = await ApiService.getItem(conversionModalItem.id);
      setConversionModalItem(updatedItem);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add unit conversion');
    } finally {
      setSubmittingConversion(false);
    }
  };

  // CSV Import handler
  const handleBulkImport = async () => {
    if (!importCsvText.trim()) return;
    setImportSubmitting(true);
    try {
      const lines = importCsvText.trim().split('\n');
      const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const rows = lines.slice(1).map((line) => {
        const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        const obj: any = {};
        header.forEach((h, i) => {
          obj[h] = cols[i];
        });
        return {
          code: obj.code || `ITM-${Date.now().toString().slice(-4)}`,
          barcode: obj.barcode || undefined,
          name: obj.name || obj.namear || 'Imported Item',
          nameAr: obj.namear || obj.name || 'صنف مستورد',
          purchasePrice: parseFloat(obj.purchaseprice || '0') || 0,
          sellingPrice: parseFloat(obj.sellingprice || '0') || 0,
          taxRate: parseFloat(obj.taxrate || obj.taxRate || '0') || 0,
        };
      });

      await ApiService.bulkImportItems(rows);
      toast.success(isRtl ? `تم استيراد ${rows.length} صنف بنجاح` : `Imported ${rows.length} items`);
      setShowImportModal(false);
      setImportCsvText('');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to import CSV');
    } finally {
      setImportSubmitting(false);
    }
  };

  // Table Columns
  const columns: Column<any>[] = [
    {
      key: 'code',
      header: isRtl ? 'الكود' : 'Code',
      sortable: true,
      render: (r) => <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{r.code}</span>,
    },
    {
      key: 'name',
      header: isRtl ? 'اسم الصنف' : 'Item Name',
      sortable: true,
      render: (r) => (
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-100">{isRtl ? r.nameAr || r.name : r.name || r.nameAr}</p>
          {r.barcode && (
            <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
              <Barcode className="w-3 h-3" />
              <span>{r.barcode}</span>
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: isRtl ? 'التصنيف' : 'Category',
      render: (r) => <span>{r.category?.name || '—'}</span>,
    },
    {
      key: 'totalStock',
      header: isRtl ? 'الرصيد الكلي' : 'Total Stock',
      align: 'end',
      sortable: true,
      render: (r) => {
        const isLow = Number(r.totalStock || 0) <= Number(r.minStockLevel || 0);
        return (
          <div className="flex items-center justify-end gap-1.5">
            <span className="font-mono font-bold text-sm tabular-nums text-slate-900 dark:text-slate-100">
              {Number(r.totalStock || 0).toLocaleString()}
            </span>
            {isLow && (
              <Badge variant="warning" size="sm" dot>
                {isRtl ? 'منخفض' : 'Low'}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: 'costPrice',
      header: isRtl ? 'متوسط التكلفة WAC' : 'WAC Cost',
      align: 'end',
      sortable: true,
      render: (r) => (
        <span className="font-mono tabular-nums text-slate-500">
          {formatMoney(Number(r.costPrice || r.purchasePrice || 0))}
        </span>
      ),
    },
    {
      key: 'sellingPrice',
      header: isRtl ? 'سعر البيع' : 'Selling Price',
      align: 'end',
      sortable: true,
      render: (r) => (
        <span className="font-mono font-bold tabular-nums text-sky-600 dark:text-sky-400">
          {formatMoney(Number(r.sellingPrice || 0))}
        </span>
      ),
    },
    {
      key: 'actions',
      header: isRtl ? 'الإجراءات' : 'Actions',
      align: 'end',
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConversionModalItem(r)}
            title={isRtl ? 'الوحدات ومعاملات التحويل' : 'Units & Conversions'}
            icon={<Layers className="w-3.5 h-3.5 text-indigo-500" />}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setAdjData({
                warehouseId: warehouses[0]?.id || '',
                itemId: r.id,
                actualQuantity: Number(r.totalStock || 0),
                reason: '',
              });
              setShowAdjustmentModal(true);
            }}
            title={isRtl ? 'تسوية جردية' : 'Stock Adjustment'}
            icon={<Sliders className="w-3.5 h-3.5 text-amber-500" />}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditingItem(r);
              setShowEditItemModal(true);
            }}
            title={isRtl ? 'تعديل الصنف' : 'Edit Item'}
            icon={<Pencil className="w-3.5 h-3.5 text-slate-500" />}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDeleteItem(r)}
            title={isRtl ? 'حذف' : 'Delete'}
            icon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
          />
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {isRtl ? 'المخزون والمستودعات' : 'Inventory & Warehouses'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isRtl
                ? 'إدارة الأصناف، تتبع حركات المخزون، التحويلات بين الفروع، والتسويات الجردية'
                : 'Manage product catalog, stock movements, warehouse transfers and reconciliations'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportModal(true)}
              icon={<Upload className="w-3.5 h-3.5" />}
            >
              {isRtl ? 'استيراد CSV' : 'Bulk Import'}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (items.length > 0) {
                  setTransferData((prev) => ({ ...prev, itemId: items[0].id }));
                }
                setShowTransferModal(true);
              }}
              icon={<ArrowLeftRight className="w-3.5 h-3.5" />}
            >
              {isRtl ? 'تحويل بين المستودعات' : 'Transfer Stock'}
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowItemModal(true)}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              {isRtl ? 'إضافة صنف جديد' : 'New Item'}
            </Button>
          </div>
        </div>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={filteredItems}
          keyExtractor={(r) => r.id}
          loading={loading}
          searchPlaceholder={isRtl ? 'بحث باسم الصنف، الكود، أو الباركود...' : 'Search item name, code, barcode...'}
          searchValue={search}
          onSearchChange={setSearch}
          filterElement={
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setActiveTab('ALL')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                    activeTab === 'ALL'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {isRtl ? 'الكل' : 'All'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('LOW_STOCK')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                    activeTab === 'LOW_STOCK'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {isRtl ? 'نواقص المخزون' : 'Low Stock'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('STOCK')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                    activeTab === 'STOCK'
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {isRtl ? 'بضاعة مخزنية' : 'Goods'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('SERVICE')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                    activeTab === 'SERVICE'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {isRtl ? 'خدمات' : 'Services'}
                </button>
              </div>

              {categories.length > 0 && (
                <div className="w-36">
                  <Select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="h-8 text-xs"
                  >
                    <option value="">{isRtl ? 'كل التصنيفات' : 'All Categories'}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          }
          emptyTitle={isRtl ? 'لا توجد أصناف مسجلة' : 'No items found'}
          emptyDescription={isRtl ? 'ابدأ بإضافة أول صنف أو استيراد قائمة الأصناف عبر CSV.' : 'Start adding inventory products.'}
          emptyActionLabel={isRtl ? 'إضافة صنف جديد' : 'Add First Item'}
          onEmptyAction={() => setShowItemModal(true)}
        />
      </div>

      {/* Create Item Modal */}
      <Modal
        isOpen={showItemModal}
        onClose={() => setShowItemModal(false)}
        title={isRtl ? 'إضافة صنف جديد' : 'New Item'}
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateItem} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={isRtl ? 'الاسم باللغة العربية' : 'Arabic Name'}
              required
              value={newItem.nameAr}
              onChange={(e) => setNewItem({ ...newItem, nameAr: e.target.value })}
              placeholder={isRtl ? 'حليب كامل الدسم 1 لتر' : 'Full Cream Milk 1L'}
            />

            <Input
              label={isRtl ? 'الاسم باللغة الإنجليزية' : 'English Name'}
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              placeholder="Milk 1L Full Cream"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label={isRtl ? 'كود الصنف (SKU)' : 'Item Code (SKU)'}
              value={newItem.code}
              onChange={(e) => setNewItem({ ...newItem, code: e.target.value })}
              placeholder="SKU-1002"
            />

            <Input
              label={isRtl ? 'الباركود الدولي' : 'Barcode'}
              value={newItem.barcode}
              onChange={(e) => setNewItem({ ...newItem, barcode: e.target.value })}
              placeholder="6281000000001"
            />

            <Select
              label={isRtl ? 'نوع الصنف' : 'Item Type'}
              value={newItem.type}
              onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
            >
              <option value="STOCK">{isRtl ? 'مخزني (سلعة قابلة للجرد)' : 'Stock Item'}</option>
              <option value="SERVICE">{isRtl ? 'خدمي (خدمة بدون رصيد)' : 'Service'}</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label={isRtl ? 'سعر الشراء الافتراضي' : 'Purchase Cost'}
              type="number"
              step="0.01"
              value={newItem.purchasePrice}
              onChange={(e) => setNewItem({ ...newItem, purchasePrice: Number(e.target.value) })}
            />

            <Input
              label={isRtl ? 'سعر البيع' : 'Selling Price'}
              type="number"
              step="0.01"
              required
              value={newItem.sellingPrice}
              onChange={(e) => setNewItem({ ...newItem, sellingPrice: Number(e.target.value) })}
            />

            <Input
              label={isRtl ? 'حد إعادة الطلب' : 'Min Stock Threshold'}
              type="number"
              value={newItem.minStockLevel}
              onChange={(e) => setNewItem({ ...newItem, minStockLevel: Number(e.target.value) })}
            />

            <Input
              label={isRtl ? 'نسبة الضريبة (%)' : 'Tax Rate (%)'}
              type="number"
              step="0.01"
              value={newItem.taxRate}
              onChange={(e) => setNewItem({ ...newItem, taxRate: Number(e.target.value) })}
            />
          </div>

          {newItem.type === 'STOCK' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <Input
                label={isRtl ? 'الرصيد الافتتاحي الأولي' : 'Initial Stock Quantity'}
                type="number"
                value={newItem.initialQuantity}
                onChange={(e) => setNewItem({ ...newItem, initialQuantity: Number(e.target.value) })}
              />

              <Select
                label={isRtl ? 'المستودع الأولي للرصيد' : 'Initial Warehouse'}
                value={newItem.initialWarehouseId}
                onChange={(e) => setNewItem({ ...newItem, initialWarehouseId: e.target.value })}
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {isRtl ? w.nameAr || w.name : w.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" onClick={() => setShowItemModal(false)}>
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="primary" type="submit" loading={submittingItem}>
              {isRtl ? 'حفظ الصنف' : 'Save Item'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Item Modal */}
      {showEditItemModal && editingItem && (
        <Modal
          isOpen={showEditItemModal}
          onClose={() => setShowEditItemModal(false)}
          title={isRtl ? 'تعديل بيانات الصنف' : 'Edit Item'}
          maxWidth="2xl"
        >
          <form onSubmit={handleUpdateItem} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label={isRtl ? 'الاسم بالعربية' : 'Arabic Name'}
                required
                value={editingItem.nameAr || ''}
                onChange={(e) => setEditingItem({ ...editingItem, nameAr: e.target.value })}
              />
              <Input
                label={isRtl ? 'الاسم بالإنجليزية' : 'English Name'}
                value={editingItem.name || ''}
                onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label={isRtl ? 'الباركود' : 'Barcode'}
                value={editingItem.barcode || ''}
                onChange={(e) => setEditingItem({ ...editingItem, barcode: e.target.value })}
              />
              <Input
                label={isRtl ? 'سعر البيع' : 'Selling Price'}
                type="number"
                step="0.01"
                value={editingItem.sellingPrice || 0}
                onChange={(e) => setEditingItem({ ...editingItem, sellingPrice: Number(e.target.value) })}
              />
              <Input
                label={isRtl ? 'حد إعادة الطلب' : 'Min Stock'}
                type="number"
                value={editingItem.minStockLevel || 0}
                onChange={(e) => setEditingItem({ ...editingItem, minStockLevel: Number(e.target.value) })}
              />
              <Input
                label={isRtl ? 'نسبة الضريبة (%)' : 'Tax Rate (%)'}
                type="number"
                step="0.01"
                value={editingItem.taxRate ?? 0}
                onChange={(e) => setEditingItem({ ...editingItem, taxRate: Number(e.target.value) })}
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="outline" onClick={() => setShowEditItemModal(false)}>
                {isRtl ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button variant="primary" type="submit" loading={submittingEditItem}>
                {isRtl ? 'حفظ التعديلات' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Warehouse Transfer Modal */}
      <Modal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        title={isRtl ? 'تحويل مخزون بين المستودعات' : 'Transfer Stock'}
        maxWidth="lg"
      >
        <form onSubmit={handleTransfer} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label={isRtl ? 'من مستودع (المصدر)' : 'From Warehouse (Source)'}
              required
              value={transferData.sourceWarehouseId}
              onChange={(e) => setTransferData({ ...transferData, sourceWarehouseId: e.target.value })}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {isRtl ? w.nameAr || w.name : w.name}
                </option>
              ))}
            </Select>

            <Select
              label={isRtl ? 'إلى مستودع (الوجهة)' : 'To Warehouse (Destination)'}
              required
              value={transferData.destinationWarehouseId}
              onChange={(e) => setTransferData({ ...transferData, destinationWarehouseId: e.target.value })}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {isRtl ? w.nameAr || w.name : w.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Select
                label={isRtl ? 'الصنف المراد تحويله' : 'Item'}
                required
                value={transferData.itemId}
                onChange={(e) => setTransferData({ ...transferData, itemId: e.target.value })}
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {isRtl ? i.nameAr || i.name : i.name} ({i.code})
                  </option>
                ))}
              </Select>
            </div>

            <Input
              label={isRtl ? 'الكمية' : 'Quantity'}
              type="number"
              min="1"
              required
              value={transferData.quantity}
              onChange={(e) => setTransferData({ ...transferData, quantity: Number(e.target.value) })}
            />
          </div>

          <Input
            label={isRtl ? 'ملاحظات التحويل' : 'Transfer Notes'}
            value={transferData.notes}
            onChange={(e) => setTransferData({ ...transferData, notes: e.target.value })}
            placeholder={isRtl ? 'تغذية فرع الرياض' : 'Stock replenishment'}
          />

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" onClick={() => setShowTransferModal(false)}>
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="primary" type="submit" loading={submittingTransfer}>
              {isRtl ? 'تنفيذ التحويل' : 'Execute Transfer'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Stock Adjustment Modal */}
      <Modal
        isOpen={showAdjustmentModal}
        onClose={() => setShowAdjustmentModal(false)}
        title={isRtl ? 'تسوية جردية لرصيد الصنف' : 'Stocktake Adjustment'}
        maxWidth="md"
      >
        <form onSubmit={handleAdjustment} className="space-y-4">
          <Select
            label={isRtl ? 'المستودع' : 'Warehouse'}
            required
            value={adjData.warehouseId}
            onChange={(e) => setAdjData({ ...adjData, warehouseId: e.target.value })}
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {isRtl ? w.nameAr || w.name : w.name}
              </option>
            ))}
          </Select>

          <Input
            label={isRtl ? 'الرصيد الفعلي بعد الجرد' : 'Actual Verified Quantity'}
            type="number"
            min="0"
            required
            value={adjData.actualQuantity}
            onChange={(e) => setAdjData({ ...adjData, actualQuantity: Number(e.target.value) })}
          />

          <Input
            label={isRtl ? 'سبب التسوية' : 'Adjustment Reason'}
            required
            value={adjData.reason}
            onChange={(e) => setAdjData({ ...adjData, reason: e.target.value })}
            placeholder={isRtl ? 'فروقات جرد دوري / تلف بضاعة' : 'Physical count discrepancy'}
          />

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" onClick={() => setShowAdjustmentModal(false)}>
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="primary" type="submit" loading={submittingAdj}>
              {isRtl ? 'حفظ التسوية' : 'Commit Adjustment'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Multi-Unit Conversions Modal */}
      {conversionModalItem && (
        <Modal
          isOpen={!!conversionModalItem}
          onClose={() => setConversionModalItem(null)}
          title={isRtl ? `وحدات ومعاملات التحويل: ${conversionModalItem.nameAr || conversionModalItem.name}` : `Units & Conversions`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <span className="text-slate-400">{isRtl ? 'الوحدة الأساسية:' : 'Base Unit:'} </span>
              <strong className="text-slate-800 dark:text-slate-200">
                {conversionModalItem.baseUnit?.nameAr || conversionModalItem.baseUnit?.name || (isRtl ? 'قطعة (Piece)' : 'Piece')}
              </strong>
            </div>

            {/* Existing conversions */}
            {(conversionModalItem.conversions || []).length > 0 && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                {conversionModalItem.conversions.map((conv: any) => (
                  <div key={conv.id} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{conv.unit?.nameAr || conv.unit?.name}</span>
                      <p className="text-2xs text-slate-400 mt-0.5">
                        1 {conv.unit?.nameAr || conv.unit?.name} = {conv.conversionRate} {conversionModalItem.baseUnit?.nameAr || 'قطعة'}
                      </p>
                    </div>
                    {conv.sellingPrice && (
                      <span className="font-mono text-sky-600 font-bold">
                        {formatMoney(conv.sellingPrice)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add conversion form */}
            <form onSubmit={handleAddConversion} className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">{isRtl ? 'إضافة وحدة قياس إضافية' : 'Add Alternate Unit'}</h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <Select
                  label={isRtl ? 'الوحدة' : 'Unit'}
                  required
                  value={newConversion.unitId}
                  onChange={(e) => setNewConversion({ ...newConversion, unitId: e.target.value })}
                >
                  <option value="">{isRtl ? 'اختر الوحدة...' : 'Select unit...'}</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {isRtl ? u.nameAr || u.name : u.name}
                    </option>
                  ))}
                </Select>

                <Input
                  label={isRtl ? 'معامل التحويل للأساس' : 'Conversion Rate'}
                  type="number"
                  step="0.0001"
                  required
                  value={newConversion.conversionRate}
                  onChange={(e) => setNewConversion({ ...newConversion, conversionRate: Number(e.target.value) })}
                  placeholder="12"
                />

                <Input
                  label={isRtl ? 'سعر بيع هذه الوحدة' : 'Selling Price'}
                  type="number"
                  step="0.01"
                  value={newConversion.sellingPrice}
                  onChange={(e) => setNewConversion({ ...newConversion, sellingPrice: e.target.value })}
                  placeholder="120.00"
                />
              </div>

              <div className="flex justify-end">
                <Button size="sm" variant="primary" type="submit" loading={submittingConversion}>
                  {isRtl ? 'إضافة الوحدة' : 'Add Unit'}
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Bulk CSV Import Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title={isRtl ? 'استيراد الأصناف عبر ملف CSV' : 'Bulk CSV Item Import'}
        maxWidth="lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            {isRtl
              ? 'الصق بيانات الأصناف بتنسيق CSV أو ارفع الملف. يجب أن يحتوي السطر الأول على الأعمدة: code, name, purchaseprice, sellingprice, taxrate'
              : 'Paste CSV or upload file with header: code, name, purchaseprice, sellingprice, taxrate'}
          </p>

          <textarea
            rows={6}
            value={importCsvText}
            onChange={(e) => setImportCsvText(e.target.value)}
            placeholder={`code,name,purchaseprice,sellingprice,taxrate\nITM-01,Product A,10.00,15.00,0\nITM-02,Product B,20.00,30.00,0`}
            className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs text-slate-800 dark:text-slate-100"
          />

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" onClick={() => setShowImportModal(false)}>
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              variant="primary"
              loading={importSubmitting}
              onClick={handleBulkImport}
              disabled={!importCsvText.trim()}
            >
              {isRtl ? 'بدء الاستيراد' : 'Execute Import'}
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
