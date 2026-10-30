'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Check, X, Package, AlertCircle } from 'lucide-react';
import { useCompany } from '../../hooks/use-company';

interface SearchableItemSelectProps {
  items: any[];
  value?: string;
  selectedItemId?: string;
  onChange?: (itemId: string) => void;
  onSelect?: (itemId: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchableItemSelect: React.FC<SearchableItemSelectProps> = ({
  items,
  value,
  selectedItemId,
  onChange,
  onSelect,
  placeholder = 'ابحث بالاسم أو الكود أو الباركود...',
  className = '',
}) => {
  const { formatMoney } = useCompany();
  const activeValue = value ?? selectedItemId ?? '';
  const notifyChange = (itemId: string) => {
    if (onChange) onChange(itemId);
    if (onSelect) onSelect(itemId);
  };

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedItem = useMemo(() => items.find((i) => i.id === activeValue), [items, activeValue]);

  // Sync display text when value changes
  useEffect(() => {
    if (selectedItem) {
      setQuery(`${selectedItem.nameAr || selectedItem.name} (${selectedItem.code})`);
    } else if (!isOpen) {
      setQuery('');
    }
  }, [selectedItem, isOpen]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset query text to selected item name if closed without selecting
        if (selectedItem) {
          setQuery(`${selectedItem.nameAr || selectedItem.name} (${selectedItem.code})`);
        } else {
          setQuery('');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedItem]);

  // Filter items instantly upon typing
  const filteredItems = useMemo(() => {
    if (!query.trim() || (selectedItem && query === `${selectedItem.nameAr || selectedItem.name} (${selectedItem.code})`)) {
      return items;
    }
    const q = query.toLowerCase().trim();
    return items.filter((item) => {
      const nameAr = (item.nameAr || '').toLowerCase();
      const name = (item.name || '').toLowerCase();
      const code = (item.code || '').toLowerCase();
      const barcode = (item.barcode || '').toLowerCase();
      return nameAr.includes(q) || name.includes(q) || code.includes(q) || barcode.includes(q);
    });
  }, [items, query, selectedItem]);

  const handleSelect = (item: any) => {
    notifyChange(item.id);
    setQuery(`${item.nameAr || item.name} (${item.code})`);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    notifyChange('');
    setQuery('');
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[highlightedIndex]) {
        handleSelect(filteredItems[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`} dir="rtl">
      {/* Single Direct Search Input */}
      <div className="relative flex items-center">
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          <Search className="w-4 h-4 text-sky-600" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => {
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full pr-9 pl-9 py-2 bg-white border rounded-lg text-xs font-semibold text-slate-900 transition-all shadow-2xs ${
            isOpen
              ? 'border-sky-500 ring-3 ring-sky-100 bg-white'
              : selectedItem
              ? 'border-sky-300 bg-sky-50/40'
              : 'border-slate-300 hover:border-slate-400 bg-slate-50'
          }`}
        />

        {/* Clear Button */}
        {(query || selectedItem) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition"
            title="مسح الاختيار"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Floating Dropdown Results */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-1.5 w-[140%] min-w-[380px] max-w-[500px] bg-white border border-slate-300 rounded-xl shadow-2xl z-[9999] overflow-hidden text-right animate-in fade-in slide-in-from-top-1 duration-150 ring-1 ring-black/10">
          {/* Header count indicator */}
          <div className="px-3 py-2 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-600">
            <span>نتائج البحث الفوري ({filteredItems.length} صنف)</span>
            <span className="text-[11px] text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded font-bold">اختر بالماوس أو بأسهم الكيبورد ↵</span>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 p-1.5 bg-white">
            {filteredItems.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 flex flex-col items-center gap-1.5">
                <AlertCircle className="w-5 h-5 text-slate-300" />
                <span>لا يوجد صنف مطابق لكلمة البحث "{query}"</span>
              </div>
            ) : (
              filteredItems.map((item, index) => {
                const isSelected = item.id === value;
                const isHighlighted = index === highlightedIndex;

                return (
                  <div
                    key={item.id}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => handleSelect(item)}
                    className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition ${
                      isHighlighted
                        ? 'bg-sky-50 text-sky-950'
                        : isSelected
                        ? 'bg-slate-50 text-slate-900'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{item.nameAr || item.name}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-100 text-sky-800 border border-sky-200">
                          {item.code}
                        </span>
                        {item.barcode && (
                          <span className="text-[11px] text-slate-400 font-mono">
                            [{item.barcode}]
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-slate-600">
                          السعر:{' '}
                          <strong className="text-sky-700 font-extrabold">
                            {formatMoney(item.sellingPrice)}
                          </strong>
                        </span>

                        <span className="text-slate-300">•</span>

                        <span className="text-slate-600">
                          المتوفر بالمخزن:{' '}
                          <strong
                            className={`font-bold ${
                              item.type === 'STOCK' && item.totalStock <= (item.minStockLevel || 0)
                                ? 'text-amber-600'
                                : 'text-emerald-700'
                            }`}
                          >
                            {item.type === 'STOCK' ? item.totalStock : 'خدمة'}
                          </strong>
                        </span>
                      </div>
                    </div>

                    {isSelected && <Check className="w-4 h-4 text-sky-600 shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
