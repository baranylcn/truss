import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiService } from '../../services/api';
import { useLanguage } from '../../hooks/useLanguage';
import { DataTable } from '../DataTable';
import InfoTip from '../InfoTip';

interface ProcessedData {
  data: any[][];
  columns: string[];
  shape: [number, number];
  dtypes: Record<string, string>;
  missingValues?: Record<string, number>;
}

interface Props {
  processedData: ProcessedData | null;
  onDataUpdate: (data: ProcessedData & { missingValues?: Record<string, number> }) => void;
  onStepComplete: (stepId: number, result?: any) => void;
}

type Strategy = 'auto' | 'label' | 'onehot' | 'ordinal' | 'binary' | 'target';

interface ColumnSetting {
  column: string;
  strategy: Strategy;
  ordinal?: boolean; // only meaningful for 'ordinal'
}

export const EncodingStep: React.FC<Props> = ({
  processedData,
  onDataUpdate,
  onStepComplete
}) => {
  const { t } = useLanguage();

  const [defaultStrategy, setDefaultStrategy] = useState<Strategy>('auto');
  const [maxCategories, setMaxCategories] = useState<number>(10);
  const [targetColumn, setTargetColumn] = useState<string>('');
  const [isApplyingGlobal, setIsApplyingGlobal] = useState(false);

  const [columnSettings, setColumnSettings] = useState<ColumnSetting[]>([]);
  const [isApplyingColumns, setIsApplyingColumns] = useState(false);

  const allColumns = processedData?.columns ?? [];
  const targetOptions = useMemo(() => allColumns, [allColumns]);

  // helper to check if a column is numeric
  const isNumericColumn = (col: string): boolean => {
    const dtype = processedData?.dtypes?.[col] || '';
    const dtypeStr = String(dtype).toLowerCase();
    const numericKeywords = ['int', 'float', 'double', 'number', 'decimal'];
    return numericKeywords.some(kw => dtypeStr.includes(kw));
  };

  // get only categorical columns
  const categoricalColumns = useMemo(() => {
    return allColumns.filter(c => !isNumericColumn(c));
  }, [allColumns, processedData?.dtypes]);

  const hasSnapRef = useRef(false);
  const ensureSnapshot = async () => {
    if (hasSnapRef.current) return;
    try {
      await apiService.snapshotStep({ step_id: 5 });
      hasSnapRef.current = true;
    } catch {
      // ignore
    }
  };

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
      dtypes: processedData?.dtypes || {},
      missingValues: payload.missingValues
    });
  };

  const addColumn = () => {
    const available = categoricalColumns.filter(
      (c) => !columnSettings.some((s) => s.column === c)
    );
    if (!available.length) {
      toast(t('noAvailableColumns'), { icon: 'ℹ️' });
      return;
    }
    setColumnSettings((prev) => [
      ...prev,
      { column: available[0], strategy: 'auto', ordinal: false }
    ]);
  };

  const removeColumn = (idx: number) => {
    setColumnSettings((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateColumn = <K extends keyof ColumnSetting>(idx: number, field: K, value: ColumnSetting[K]) => {
    setColumnSettings((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    );
  };

  const handleApplyGlobal = async () => {
    if (!processedData) return;
    setIsApplyingGlobal(true);
    try {
      await ensureSnapshot();

      let methodToUse = defaultStrategy;
      
      if (methodToUse === 'auto' || methodToUse === 'binary' || methodToUse === 'target') {
        methodToUse = 'label'; // fallback
      }

      const resp = await apiService.encodeFeatures({
        method: methodToUse,
        columns: null
      });
      
      if (resp.error) {
        toast.error(resp.error);
        return;
      }
      if (resp.data) {
        const d: any = resp.data;
        onDataUpdate({
          data: d.data,
          columns: d.columns,
          shape: d.shape,
          dtypes: processedData.dtypes || {}
        });
        toast.success('Global encoding applied');
      }
    } catch {
      toast.error('Global encoding failed');
    } finally {
      setIsApplyingGlobal(false);
    }
  };

  const handleApplyColumns = async () => {
    if (!processedData) return;
    if (!columnSettings.length) {
      toast(t('pleaseAddColumnFirst'), { icon: 'ℹ️' });
      return;
    }
    setIsApplyingColumns(true);
    try {
      await ensureSnapshot();
      
      for (const setting of columnSettings) {
        let methodToUse = setting.strategy;
        
        if (methodToUse === 'auto' || methodToUse === 'binary' || methodToUse === 'target') {
          methodToUse = 'label'; // fallback
        }
        
        const resp = await apiService.encodeFeatures({
          method: methodToUse,
          columns: [setting.column]
        });
        
        if (resp.error) {
          toast.error(`Encoding failed for ${setting.column}: ${resp.error}`);
          continue;
        }
        
        if (resp.data) {
          const d: any = resp.data;
          onDataUpdate({
            data: d.data,
            columns: d.columns,
            shape: d.shape,
            dtypes: processedData.dtypes || {}
          });
        }
      }
      
      toast.success('Column-specific encoding applied');
    } catch {
      toast.error('Column encoding failed');
    } finally {
      setIsApplyingColumns(false);
    }
  };

  const handleContinue = () => {
    onStepComplete(5, {
      defaultStrategy,
      maxCategories,
      targetColumn,
      columnSettings
    });
  };

  return (
    <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="space-y-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">{t('encoding')}</h2>
        <p className="text-gray-400">{t('encodingSubtitle')}</p>
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
            stepId={5}
            onDataUpdate={handlePreviewUpdate}
          />
        </div>
      )}

      {/* Global Settings */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-white">{t('encodingGlobalSettings')}</h3>
          <InfoTip text={t('infoEncodingGlobal')} />
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              {t('defaultEncodingStrategy')}
              <InfoTip text={t('infoDefaultEncodingStrategy')} />
            </label>
            <select
              value={defaultStrategy}
              onChange={(e) => setDefaultStrategy(e.target.value as Strategy)}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded"
            >
              <option value="auto">Auto</option>
              <option value="label">Label</option>
              <option value="onehot">One-Hot</option>
              <option value="ordinal">Ordinal</option>
              <option value="binary">Binary</option>
              <option value="target">Target</option>
            </select>
          </div>

          {defaultStrategy === 'auto' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                {t('maxCategoriesAuto')}
                <InfoTip text={t('infoMaxCategories')} />
              </label>
              <input
                type="number"
                value={maxCategories}
                onChange={(e) => setMaxCategories(Number(e.target.value))}
                min={2}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded"
              />
            </div>
          )}

          {defaultStrategy === 'target' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                {t('targetColumn')}
                <InfoTip text={t('infoEncodingTarget')} />
              </label>
              <select
                value={targetColumn}
                onChange={(e) => setTargetColumn(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded"
              >
                <option value="">{t('selectPlaceholder')}</option>
                {targetOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <motion.button
            onClick={handleApplyGlobal}
            disabled={isApplyingGlobal}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
            whileHover={{ scale: 1.05 }}
          >
            {isApplyingGlobal ? t('applying') : t('applyGlobalSettings')}
          </motion.button>
        </div>
      </div>

      {/* Column-Specific */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">{t('columnSpecificSettingsTitle')}</h3>
            <InfoTip text={t('infoEncodingColumnSpecific')} />
          </div>
        </div>

        {columnSettings.length === 0 ? (
          <div className="text-center py-8 text-gray-400">{t('noColumnsYet')}</div>
        ) : (
          columnSettings.map((s, i) => (
            <div key={i} className="bg-gray-700 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <select
                    value={s.column}
                    onChange={(e) => updateColumn(i, 'column', e.target.value)}
                    className="px-3 py-2 bg-gray-600 text-white rounded"
                  >
                    {categoricalColumns.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <motion.button onClick={() => removeColumn(i)} className="p-2 text-red-400" whileHover={{ scale: 1.1 }}>
                  <Minus className="w-4 h-4" />
                </motion.button>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-2">
                    {t('strategyLabel')}
                    <InfoTip text={t('infoEncodingStrategyPerColumn')} />
                  </label>
                  <select
                    value={s.strategy}
                    onChange={(e) => updateColumn(i, 'strategy', e.target.value as Strategy)}
                    className="w-full px-3 py-2 bg-gray-600 text-white rounded"
                  >
                    <option value="auto">Auto</option>
                    <option value="label">Label</option>
                    <option value="onehot">One-Hot</option>
                    <option value="ordinal">Ordinal</option>
                    <option value="binary">Binary</option>
                    <option value="target">Target</option>
                  </select>
                </div>

                {s.strategy === 'ordinal' && (
                  <div className="flex items-center">
                    <label className="flex items-center gap-2 text-white">
                      <input
                        type="checkbox"
                        checked={Boolean(s.ordinal)}
                        onChange={(e) => updateColumn(i, 'ordinal', e.target.checked)}
                      />
                      {t('treatUnknownAsMinusOne')}
                      <span className="ml-1">
                        <InfoTip text={t('infoOrdinalUnknowns')} />
                      </span>
                    </label>
                  </div>
                )}

                {s.strategy === 'target' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-2">
                      {t('targetColumn')}
                      <InfoTip text={t('infoEncodingTarget')} />
                    </label>
                    <select
                      value={targetColumn}
                      onChange={(e) => setTargetColumn(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-600 text-white rounded"
                    >
                      <option value="">{t('selectPlaceholder')}</option>
                      {targetOptions.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        <div className="mt-6 flex justify-between items-center">
          <motion.button
            onClick={addColumn}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
            whileHover={{ scale: 1.05 }}
          >
            <Plus className="w-4 h-4" /> {t('addColumnBtn')}
          </motion.button>

          {columnSettings.length > 0 && (
            <motion.button
              onClick={handleApplyColumns}
              disabled={isApplyingColumns}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg disabled:opacity-50"
              whileHover={{ scale: 1.05 }}
            >
              {isApplyingColumns ? t('applying') : t('applyColumnSettings')}
            </motion.button>
          )}
        </div>
      </div>

      {/* Continue */}
      <div className="flex justify-center">
        <motion.button
          onClick={handleContinue}
          className="px-8 py-3 bg-cyan-600 text-white rounded-lg hover:shadow-lg"
          whileHover={{ scale: 1.05 }}
        >
          {t('continueToNextStep')}
        </motion.button>
      </div>
    </motion.div>
  );
};
