// src/components/steps/CorrelationStep.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { DataTable } from '../DataTable';
import { useLanguage } from '../../hooks/useLanguage';
import { ProcessedData } from '../../services/localDataProcessor';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';
import InfoTip from '../InfoTip';

interface CorrelationStepProps {
  processedData: ProcessedData | null;
  onDataUpdate: (data: ProcessedData) => void;
  onStepComplete: (stepId: number, result?: any) => void;
  stepResults: Record<number, any>;
  sessionId: string | null;
}

type Pair = { col1: string; col2: string; correlation: number };

export const CorrelationStep: React.FC<CorrelationStepProps> = ({
  processedData,
  onDataUpdate,
  onStepComplete,
}) => {
  const { t } = useLanguage();

  const [threshold, setThreshold] = useState<number>(0.95);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const [selections, setSelections] = useState<Record<number, 'col1' | 'col2' | undefined>>({});
  const [lastDropped, setLastDropped] = useState<string[]>([]);

  // --- Snapshot (undo) — Encoding/Missing/Outlier ile aynı mantık ---
  const hasSnapRef = useRef(false);
  const ensureSnapshot = async () => {
    if (hasSnapRef.current) return;
    try {
      await apiService.snapshotStep({ stepId: 6 });
      hasSnapRef.current = true;
    } catch {
      // sessiz geç
    }
  };

  // DataTable (drop/undo) -> parent senkron
  const handlePreviewUpdate = (payload: {
    data: any[][];
    columns: string[];
    shape: [number, number];
    missingValues?: Record<string, number>;
  }) => {
    onDataUpdate({
      data: payload.data,
      columns: payload.columns,
      shape: payload.shape,
      dtypes: (processedData?.dtypes as any) || {},
    } as ProcessedData);
  };

  // --- PREVIEW ---
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!processedData) return;
      setIsPreviewing(true);
      const res = await apiService.correlationAnalysis({ threshold, preview_only: true });
      setIsPreviewing(false);
      if (!alive) return;

      if (res.error) {
        toast.error(res.error);
        return;
      }
      const list: Pair[] = res.data?.highly_correlated || [];
      setPairs(list);
      setSelections({});
    })();
    return () => {
      alive = false;
    };
  }, [processedData, threshold]);

  const selectedColumnsToDrop = useMemo(() => {
    const cols: string[] = [];
    pairs.forEach((p, idx) => {
      const choice = selections[idx];
      if (choice === 'col1') cols.push(p.col1);
      else if (choice === 'col2') cols.push(p.col2);
    });
    return Array.from(new Set(cols));
  }, [pairs, selections]);

  const handleToggleChoice = (pairIndex: number, which: 'col1' | 'col2') => {
    setSelections(prev => {
      const current = prev[pairIndex];
      if (current === which) {
        const copy = { ...prev };
        delete copy[pairIndex];
        return copy;
      }
      return { ...prev, [pairIndex]: which };
    });
  };

  const handleApply = async () => {
    if (!processedData) return;
    if (selectedColumnsToDrop.length === 0) {
      toast(t('pleaseSelectColumnsToDrop'), { icon: 'ℹ️' });
      return;
    }
    setIsApplying(true);
    try {
      // ---- İlk kez uygulamadan önce snapshot al (undo için) ----
      await ensureSnapshot();

      const res = await apiService.correlationAnalysis({
        threshold,
        columns_to_drop: selectedColumnsToDrop,
      });
      if (res.error) {
        toast.error(res.error);
      } else if (res.data) {
        const next: ProcessedData = {
          data: res.data.data ?? processedData.data,
          columns: res.data.columns,
          shape: res.data.shape,
          dtypes: processedData?.dtypes || {},
        };
        onDataUpdate(next);

        const dropped = res.data.dropped_columns || selectedColumnsToDrop;
        setLastDropped(dropped);
        toast.success(`${dropped.length} ${t('columnsDropped')}.`);

        // Uygulama sonrası tekrar önizleme
        setIsPreviewing(true);
        const pv = await apiService.correlationAnalysis({ threshold, preview_only: true });
        setIsPreviewing(false);
        if (pv.data) {
          setPairs(pv.data.highly_correlated || []);
          setSelections({});
        }
      }
    } catch {
      toast.error(t('applyError'));
    } finally {
      setIsApplying(false);
    }
  };

  const handleContinue = () => {
    onStepComplete(6, {
      droppedColumns: lastDropped,
      thresholdUsed: threshold,
      pairsPreviewed: pairs.length,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Başlık */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-2xl font-bold text-white mb-2">{t('correlationAnalysis')}</h2>
        </div>
        <p className="text-gray-400">{t('correlationSubtitle')}</p>
      </div>

      {/* Data Preview */}
      {processedData && (
        <div className="mb-8">
          <DataTable
            title={t('dataPreview')}
            titleInfoText={t('infoDataPreview')}
            data={processedData.data}
            columns={processedData.columns}
            showAllRows
            stepId={6}
            onDataUpdate={handlePreviewUpdate}
          />
        </div>
      )}

      {/* Settings */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-white">{t('correlationSettings')}</h3>
          <InfoTip text={t('infoCorrelationPairsList')} />
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              {t('correlationThreshold')}
              <InfoTip text={t('infoCorrelationThreshold')} />
            </label>
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              step="0.01"
              min="0"
              max="1"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-cyan-400 focus:outline-none"
            />
            <div className="text-xs text-gray-400 mt-1">{t('pairsListedHint')}</div>
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-red-400">
                {isPreviewing ? '…' : pairs.length}
              </div>
              <InfoTip text={t('infoCorrelationPairsCount')} />
            </div>
            <div className="text-gray-300">{t('highlyCorrelatedPairs')}</div>
          </div>
        </div>
      </div>

      {/* Correlation Results */}
      {pairs.length > 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold text-white">
              {t('highlyCorrelatedFeaturesTitle')}
            </h3>
            <InfoTip text={t('infoCorrelationPairsList')} />
          </div>
          <div className="space-y-4">
            {pairs.map((p, idx) => {
              const sel = selections[idx];
              const isCol1 = sel === 'col1';
              const isCol2 = sel === 'col2';
              return (
                <div key={`${p.col1}__${p.col2}__${idx}`} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-white font-medium">
                        {p.col1} ↔ {p.col2}
                      </div>
                      <div className="text-sm text-gray-400">
                        {t('correlationLabel')} {p.correlation.toFixed(3)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleChoice(idx, 'col1')}
                        title={`${t('drop')} ${p.col1}`}
                        aria-pressed={isCol1}
                        className={`px-3 py-1 rounded text-sm transition-colors ${
                          isCol1
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                        }`}
                      >
                        {t('drop')} {p.col1}
                      </button>
                      <button
                        onClick={() => handleToggleChoice(idx, 'col2')}
                        title={`${t('drop')} ${p.col2}`}
                        aria-pressed={isCol2}
                        className={`px-3 py-1 rounded text-sm transition-colors ${
                          isCol2
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                        }`}
                      >
                        {t('drop')} {p.col2}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedColumnsToDrop.length > 0 && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
              <div className="text-red-400 font-medium mb-2">
                {t('columnsToDrop')}: {selectedColumnsToDrop.length}
              </div>
              <div className="text-sm text-red-300">
                {selectedColumnsToDrop.join(', ')}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-center">
          <div className="text-green-400 font-medium mb-2">✅ {t('noHighlyCorrelated')}</div>
          <div className="text-gray-400">{t('allBelowThreshold')}</div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-center gap-4">
        <motion.button
          onClick={handleApply}
          disabled={isApplying || selectedColumnsToDrop.length === 0}
          className="px-8 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-red-500/25 transition-all duration-300 disabled:opacity-50"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {isApplying ? t('processing') : `${t('applyAndDrop')} (${selectedColumnsToDrop.length})`}
        </motion.button>

        <motion.button
          onClick={handleContinue}
          className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-300"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {t('continue')}
        </motion.button>
      </div>
    </motion.div>
  );
};
