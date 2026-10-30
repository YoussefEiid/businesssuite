import React, { useState, useMemo } from 'react';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, ChevronLeft } from 'lucide-react';
import { Skeleton, TableSkeletonRows } from './Skeleton';
import { EmptyState } from './EmptyState';
import { useLanguage } from '../../hooks/use-language';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  loading?: boolean;
  error?: string | null;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filterElement?: React.ReactNode;
  actionElement?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  pageSize?: number;
  stickyHeader?: boolean;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T, index: number) => string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyExtractor,
  loading = false,
  error = null,
  searchable = true,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  filterElement,
  actionElement,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  pageSize = 15,
  stickyHeader = true,
  onRowClick,
  rowClassName,
}: DataTableProps<T>) {
  const { isRtl } = useLanguage();
  const [internalSearch, setInternalSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const activeSearch = searchValue !== undefined ? searchValue : internalSearch;

  const handleSearchChange = (val: string) => {
    if (onSearchChange) {
      onSearchChange(val);
    } else {
      setInternalSearch(val);
      setCurrentPage(1);
    }
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortKey(null);
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Filter & Sort Data client-side if no custom search handler provided
  const processedData = useMemo(() => {
    let result = [...data];

    // Search filter if internal
    if (onSearchChange === undefined && internalSearch.trim()) {
      const q = internalSearch.toLowerCase();
      result = result.filter((row) =>
        Object.values(row).some((val) =>
          val !== null && val !== undefined && String(val).toLowerCase().includes(q),
        ),
      );
    }

    // Sort
    if (sortKey) {
      result.sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        const comparison = typeof valA === 'number' && typeof valB === 'number'
          ? valA - valB
          : String(valA).localeCompare(String(valB));

        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [data, internalSearch, onSearchChange, sortKey, sortDirection]);

  // Pagination slice
  const totalItems = processedData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validPage = Math.min(currentPage, totalPages);
  const paginatedData = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    return processedData.slice(start, start + pageSize);
  }, [processedData, validPage, pageSize]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col overflow-hidden">
      {/* Table Toolbar */}
      {(searchable || filterElement || actionElement) && (
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            {searchable && (
              <div className="relative min-w-[200px] max-w-sm w-full sm:w-auto">
                <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={activeSearch}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder={searchPlaceholder || (isRtl ? 'بحث...' : 'Search...')}
                  className="block w-full h-9 ps-9 pe-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                />
              </div>
            )}
            {filterElement}
          </div>

          {actionElement && <div className="flex items-center gap-2 flex-shrink-0">{actionElement}</div>}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
          <span>{error}</span>
        </div>
      )}

      {/* Table Container */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-start text-xs border-collapse">
          <thead>
            <tr
              className={`border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 ${
                stickyHeader ? 'sticky top-0 z-10' : ''
              }`}
            >
              {columns.map((col) => {
                const alignClass =
                  col.align === 'center'
                    ? 'text-center'
                    : col.align === 'end'
                    ? 'text-end'
                    : 'text-start';

                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={`p-3 font-semibold text-slate-600 dark:text-slate-300 select-none whitespace-nowrap ${alignClass} ${
                      col.className || ''
                    }`}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col.key)}
                        className="inline-flex items-center gap-1.5 hover:text-sky-600 dark:hover:text-sky-400 transition"
                      >
                        <span>{col.header}</span>
                        {sortKey === col.key ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {loading ? (
              <TableSkeletonRows rows={pageSize > 8 ? 6 : pageSize} cols={columns.length} />
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-8">
                  <EmptyState
                    title={emptyTitle || (isRtl ? 'لا توجد بيانات' : 'No records found')}
                    description={
                      emptyDescription ||
                      (isRtl
                        ? 'لم يتم تسجيل أي بيانات في هذا الجدول حتى الآن.'
                        : 'No data has been added to this view yet.')
                    }
                    actionLabel={emptyActionLabel}
                    onAction={onEmptyAction}
                  />
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => {
                const key = keyExtractor(row, idx);
                const customRowClass = rowClassName ? rowClassName(row, idx) : '';

                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50 ${
                      onRowClick ? 'cursor-pointer' : ''
                    } ${customRowClass}`}
                  >
                    {columns.map((col) => {
                      const alignClass =
                        col.align === 'center'
                          ? 'text-center'
                          : col.align === 'end'
                          ? 'text-end'
                          : 'text-start';

                      return (
                        <td
                          key={col.key}
                          className={`p-3 text-slate-700 dark:text-slate-200 whitespace-nowrap ${alignClass} ${
                            col.className || ''
                          }`}
                        >
                          {col.render ? col.render(row, idx) : row[col.key]}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!loading && totalItems > 0 && (
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div>
            {isRtl ? (
              <span>
                عرض <strong className="text-slate-800 dark:text-slate-200">{Math.min(totalItems, (validPage - 1) * pageSize + 1)}</strong> إلى{' '}
                <strong className="text-slate-800 dark:text-slate-200">{Math.min(totalItems, validPage * pageSize)}</strong> من إجمالي{' '}
                <strong className="text-slate-800 dark:text-slate-200">{totalItems}</strong> سجل
              </span>
            ) : (
              <span>
                Showing <strong className="text-slate-800 dark:text-slate-200">{Math.min(totalItems, (validPage - 1) * pageSize + 1)}</strong> to{' '}
                <strong className="text-slate-800 dark:text-slate-200">{Math.min(totalItems, validPage * pageSize)}</strong> of{' '}
                <strong className="text-slate-800 dark:text-slate-200">{totalItems}</strong> records
              </span>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={validPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
                aria-label="Previous Page"
              >
                {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>

              <span className="px-2 font-medium">
                {validPage} / {totalPages}
              </span>

              <button
                type="button"
                disabled={validPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
                aria-label="Next Page"
              >
                {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
