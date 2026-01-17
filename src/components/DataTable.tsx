// src/components/DataTable.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiService } from '../services/api';
import InfoTip from './InfoTip';

interface DataTableProps {
  data: any[][];
  columns: string[];
  showAllRows?: boolean;

  onDataUpdate?: (payload: {
    data: any[][];
    columns: string[];
    shape: [number, number];
    missingValues?: Record<string, number>;
  }) => void;

  stepId?: number;

  /** Başlık metni (örn: t('dataPreview')) */
  title?: string;

  /** Başlığın yanında hover tooltip için metin (örn: t('infoDataPreview')) */
  titleInfoText?: string;

  /** Gerekirse Undo'yu gizlemek için */
  hideUndo?: boolean;

  className?: string;
}

const MAX_PREVIEW_ROWS = 500;
const INITIAL_PREVIEW_ROWS = 10;
const LOAD_CHUNK = 50;

export const DataTable: React.FC<DataTableProps> = ({
  data,
  columns,
  showAllRows = false,
  onDataUpdate,
  stepId,
  title,
  titleInfoText,
  hideUndo = false,
  className = '',
}) => {
  const [localColumns, setLocalColumns] = useState<string[]>(columns);
  const [localData, setLocalData] = useState<any[][]>(data);

  const [dropping, setDropping] = useState<Record<string, boolean>>({});
  const [isUndoing, setIsUndoing] = useState(false);

  // Confirm dialog state
  const [confirmTarget, setConfirmTarget] = useState<{ col: string; colIdx: number } | null>(null);

  const snapshotTakenRef = useRef<boolean>(false);

  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_PREVIEW_ROWS);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLocalColumns(columns);
  }, [columns]);

  useEffect(() => {
    setLocalData(data);
  }, [data]);

  useEffect(() => {
    if (showAllRows) return;
    setVisibleCount(INITIAL_PREVIEW_ROWS);
    setExpandedCells(new Set());
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
  }, [localData, showAllRows]);

  // Close modal with ESC, confirm with Enter
  useEffect(() => {
    if (!confirmTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmTarget(null);
      if (e.key === 'Enter') {
        e.preventDefault();
        doDropConfirmed();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmTarget]);

  const rowCount = localData.length;

  const previewRows = useMemo(() => {
    if (showAllRows) return localData;
    const limit = Math.min(MAX_PREVIEW_ROWS, rowCount);
    return localData.slice(0, Math.min(visibleCount, limit));
  }, [localData, showAllRows, visibleCount, rowCount]);

  const handleScroll: React.UIEventHandler<HTMLDivElement> = (e) => {
    if (showAllRows) return;
    const el = e.currentTarget;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24; // 24px buffer
    if (nearBottom) {
      setVisibleCount((prev) => {
        const limit = Math.min(MAX_PREVIEW_ROWS, rowCount);
        if (prev >= limit) return prev;
        return Math.min(prev + LOAD_CHUNK, limit);
      });
    }
  };

  // --- Optimistic helpers ---
  const optimisticRemove = (colIdx: number) => {
    setLocalColumns((prev) => prev.filter((_, i) => i !== colIdx));
    setLocalData((prev) => prev.map((row) => row.filter((_, i) => i !== colIdx)));
  };

  const rollback = () => {
    setLocalColumns(columns);
    setLocalData(data);
  };

  // --- Core drop logic ---
  const handleDropColumn = async (col: string, colIdx: number) => {
    if (!col) return;
    if (localColumns.length <= 1) {
      toast.error('You cannot drop the last column.');
      return;
    }

    try {
      setDropping((s) => ({ ...s, [col]: true }));

      // First change on this step -> snapshot
      if (stepId && stepId > 0 && !snapshotTakenRef.current) {
        const snap = await apiService.snapshotStep({ step_id: stepId });
        if (snap.error) {
          toast.error(`Snapshot failed: ${snap.error}`);
        } else {
          snapshotTakenRef.current = true;
        }
      }

      // 1) optimistic
      optimisticRemove(colIdx);

      // 2) backend drop
      const res = await apiService.dropColumns({ columns: [col] });
      if (res.error) {
        rollback();
        toast.error(res.error);
        return;
      }

      // 3) refresh
      const fresh = await apiService.getSessionData();
      if (fresh.error || !fresh.data) {
        const fallbackCols: string[] = res.data?.columns ?? localColumns;
        const fallbackData: any[][] = res.data?.data ?? localData;

        setLocalColumns(fallbackCols);
        setLocalData(fallbackData);

        onDataUpdate?.({
          data: fallbackData,
          columns: fallbackCols,
          shape: [(fallbackData?.length || 0), (fallbackCols?.length || 0)] as [number, number],
        });

        toast.error(fresh.error || 'Failed to refresh data after drop (used fallback).');
        return;
      }

      const { data: d2, columns: c2, shape } = fresh.data as {
        data: any[][];
        columns: string[];
        shape: [number, number];
      };

      onDataUpdate?.({
        data: d2 || [],
        columns: c2 || [],
        shape: (shape as [number, number]) || [0, 0],
      });

      setLocalColumns(c2 || []);
      setLocalData(d2 || []);

      toast.success(`Column "${col}" dropped.`);
    } catch (e: any) {
      rollback();
      toast.error(e?.message || 'Column drop failed.');
    } finally {
      setDropping((s) => ({ ...s, [col]: false }));
    }
  };

  // Open confirm dialog from trash button
  const requestDropColumn = (col: string, colIdx: number) => {
    if (dropping[col]) return;
    setConfirmTarget({ col, colIdx });
  };

  // Confirm dialog -> proceed
  const doDropConfirmed = async () => {
    if (!confirmTarget) return;
    const { col, colIdx } = confirmTarget;
    setConfirmTarget(null);
    await handleDropColumn(col, colIdx);
  };

  const handleUndo = async () => {
    if (!stepId || stepId <= 0) {
      toast('Undo requires a valid step.', { icon: 'ℹ️' });
      return;
    }
    try {
      setIsUndoing(true);
      const res = await apiService.undoStep({ step_id: stepId });
      if (res.error) {
        toast.error(res.error);
        return;
      }

      const fresh = await apiService.getSessionData();
      if (fresh.error || !fresh.data) {
        const uCols: string[] = res.data?.columns ?? columns;
        const uData: any[][] = res.data?.data ?? data;

        setLocalColumns(uCols);
        setLocalData(uData);
        onDataUpdate?.({
          data: uData,
          columns: uCols,
          shape: [(uData?.length || 0), (uCols?.length || 0)] as [number, number],
        });

        toast.error(fresh.error || 'Failed to refresh after undo (used fallback).');
      } else {
        const { data: d2, columns: c2, shape } = fresh.data as {
          data: any[][];
          columns: string[];
          shape: [number, number];
        };

        setLocalColumns(c2 || []);
        setLocalData(d2 || []);
        onDataUpdate?.({
          data: d2 || [],
          columns: c2 || [],
          shape: (shape as [number, number]) || [0, 0],
        });
      }

      snapshotTakenRef.current = false;

      toast.success('Undo completed — step restored.');
    } catch (e: any) {
      toast.error(e?.message || 'Undo failed.');
    } finally {
      setIsUndoing(false);
    }
  };

  if (!localColumns?.length) {
    return <div className="text-gray-400 text-sm">No columns to display.</div>;
  }

  // Cell text render (shorten / expand)
  const toggleCell = (key: string) => {
    setExpandedCells((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderCell = (v: any, key: string) => {
    const text = formatCell(v);
    if (text === '—' || text.length <= 40) {
      return <span className="block whitespace-nowrap">{text}</span>;
    }
    const isExpanded = expandedCells.has(key);
    return (
      <span
        title={!isExpanded ? text : undefined}
        onClick={() => toggleCell(key)}
        className={
          isExpanded
            ? 'block whitespace-normal break-words cursor-zoom-out'
            : 'block max-w-[280px] truncate whitespace-nowrap cursor-zoom-in'
        }
      >
        {text}
      </span>
    );
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Header */}
      {title ? (
        <>
          {!hideUndo && (
            <div className="flex items-center justify-end mb-2">
              <button
                onClick={handleUndo}
                disabled={isUndoing}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-700 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-50"
                title="Undo changes in this step"
              >
                <RotateCcw className="w-4 h-4" />
                Undo
              </button>
            </div>
          )}
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span>{title}</span>
            {titleInfoText ? <InfoTip text={titleInfoText} /> : null}
          </h3>
        </>
      ) : (
        !hideUndo && (
          <div className="flex items-center justify-end mb-3">
            <button
              onClick={handleUndo}
              disabled={isUndoing}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-700 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-50"
              title="Undo changes in this step"
            >
              <RotateCcw className="w-4 h-4" />
              Undo
            </button>
          </div>
        )
      )}

      <div className="rounded-lg border border-gray-700 overflow-hidden">
        {/* Scrollable container: both axes */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="overflow-auto max-h-[480px]"
        >
          <motion.table layout className="min-w-max divide-y divide-gray-700" initial={false}>
            <thead className="bg-gray-800 sticky top-0 z-10">
              <tr>
                <AnimatePresence initial={false}>
                  {localColumns.map((col, colIdx) => (
                    <motion.th
                      key={col}
                      layout
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
                      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                      className="group relative px-4 py-3 text-left text-sm font-semibold text-gray-200 border-b border-gray-700 whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2 pr-8">
                        <span className="truncate">{col}</span>

                        {/* Trash icon: open confirm dialog */}
                        <motion.button
                          onClick={(e) => {
                            e.stopPropagation();
                            requestDropColumn(col, colIdx);
                          }}
                          className={`ml-2 p-1 rounded hover:bg-red-600/20 transition
                                      ${dropping[col] ? 'opacity-60 cursor-not-allowed' : 'opacity-0 group-hover:opacity-100'}`}
                          title={`Drop "${col}"`}
                          disabled={dropping[col]}
                          whileHover={{ scale: dropping[col] ? 1.0 : 1.1 }}
                          whileTap={{ scale: dropping[col] ? 1.0 : 0.95 }}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </motion.button>
                      </div>
                    </motion.th>
                  ))}
                </AnimatePresence>
              </tr>
            </thead>

            <tbody className="bg-gray-900 divide-y divide-gray-800">
              <AnimatePresence initial={false}>
                {previewRows.length === 0 ? (
                  <tr>
                    <td colSpan={localColumns.length} className="px-4 py-6 text-center text-gray-500">
                      No rows to display.
                    </td>
                  </tr>
                ) : (
                  previewRows.map((row, rIdx) => (
                    <motion.tr
                      key={`row-${rIdx}`}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={rIdx % 2 === 0 ? 'bg-gray-900' : 'bg-gray-900/60'}
                    >
                      <AnimatePresence initial={false}>
                        {localColumns.map((colName, cIdx) => {
                          const cellKey = `${rIdx}-${cIdx}`;
                          return (
                            <motion.td
                              key={`${rIdx}-${colName}`}
                              layout
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0, transition: { duration: 0.15 } }}
                              className="px-4 py-2 text-sm text-gray-300 align-top"
                            >
                              {renderCell(row[cIdx], cellKey)}
                            </motion.td>
                          );
                        })}
                      </AnimatePresence>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </motion.table>
        </div>
      </div>

      {!showAllRows && rowCount > previewRows.length && (
        <div className="text-xs text-gray-500 mt-2">
          Showing {previewRows.length} of {Math.min(rowCount, MAX_PREVIEW_ROWS)} rows.
        </div>
      )}

      {/* Confirm Drop Modal */}
      <AnimatePresence>
        {confirmTarget && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setConfirmTarget(null)}
            />

            {/* Dialog */}
            <motion.div
              className="relative w-[min(92vw,520px)] rounded-2xl border border-gray-700 bg-gray-800 shadow-xl p-6"
              initial={{ y: 20, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 10, scale: 0.98, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white">Drop column?</h4>
                  <p className="text-sm text-gray-300 mt-1">
                    Are you sure you want to drop <span className="font-medium text-white">"{confirmTarget.col}"</span>?
                    This will modify the dataset for this step. You can use <span className="text-gray-200 font-medium">Undo</span> afterward.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setConfirmTarget(null)}
                  className="px-4 py-2 rounded-md border border-gray-600 text-gray-200 hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={doDropConfirmed}
                  className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-500"
                >
                  Drop column
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

function formatCell(v: any) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '—';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  return String(v);
}

export default DataTable;
