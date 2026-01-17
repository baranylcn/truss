// src/components/steps/ScalingStep.tsx
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';
import { DataTable } from '../DataTable';
import { useLanguage } from '../../hooks/useLanguage';
import { ProcessedData } from '../../services/localDataProcessor';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';
import InfoTip from '../InfoTip';

interface ScalingStepProps {
  processedData: ProcessedData | null;
  onDataUpdate: (data: ProcessedData) => void;
  onStepComplete: (stepId: number, result?: any) => void;
  stepResults: Record<number, any>;
  sessionId: string | null;
}

interface ColumnSpecificScalingSetting {
  column: string;
  method: 'standard' | 'minmax' | 'robust';
}

export const ScalingStep: React.FC<ScalingStepProps> = ({
  processedData,
  onDataUpdate,
  onStepComplete,
}) => {
  const { t } = useLanguage();

  const [method, setMethod] = useState<'standard' | 'minmax' | 'robust'>('standard');
  const [targetColumn, setTargetColumn] = useState<string>('');
  const [columnSpecificSettings, setColumnSpecificSettings] = useState<ColumnSpecificScalingSetting[]>([]);
  const [isProcessingGlobal, setIsProcessingGlobal] = useState(false);
  const [isProcessingColumn, setIsProcessingColumn] = useState(false);

  const STEP_ID = 7;

  // --- Snapshot (undo) — diğer adımlarla aynı mantık ---
  const hasSnapRef = useRef(false);
  const ensureSnapshot = async () => {
    if (hasSnapRef.current) return;
    try {
      await apiService.snapshotStep({ stepId: STEP_ID });
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
      ...(payload.missingValues ? { missingValues: payload.missingValues } : {}),
    } as ProcessedData);
  };

  const numericColumns = useMemo(() => {
    if (!processedData) return [];

    const { columns, dtypes, data } = processedData;

    const fromDtypes = columns.filter((col) => {
      const dt = (dtypes && (dtypes as any)[col]) || '';
      if (typeof dt === 'string') {
        const s = dt.toLowerCase();
        return s.includes('int') || s.includes('float') || s.includes('number');
      }
      return false;
    });

    if (fromDtypes.length > 0) return fromDtypes;

    const isMostlyNumeric = (colIndex: number) => {
      const vals = (data || [])
        .map((row) => row?.[colIndex])
        .filter((v) => v !== null && v !== undefined);

      if (vals.length === 0) return false;

      let numericLike = 0;
      for (const v of vals) {
        if (typeof v === 'number' && !Number.isNaN(v)) {
          numericLike++;
          continue;
        }
        if (typeof v === 'string') {
          const trimmed = v.trim();
          if (trimmed !== '' && !Number.isNaN(Number(trimmed))) numericLike++;
        }
      }
      return numericLike / vals.length >= 0.8;
    };

    return columns.filter((_, idx) => isMostlyNumeric(idx));
  }, [processedData]);

  useEffect(() => {
    if (targetColumn && !numericColumns.includes(targetColumn)) {
      setTargetColumn('');
    }
  }, [numericColumns, targetColumn]);

  useEffect(() => {
    if (!targetColumn) return;
    setColumnSpecificSettings((prev) => prev.filter((s) => s.column !== targetColumn));
  }, [targetColumn]);

  const numericColumnsExceptTarget = useMemo(
    () => numericColumns.filter((c) => c !== targetColumn),
    [numericColumns, targetColumn]
  );

  const handleGlobalApply = async () => {
    if (!processedData) return;
    if (numericColumnsExceptTarget.length === 0) {
      toast('Ölçeklenecek sayısal sütun bulunamadı.', { icon: 'ℹ️' });
      return;
    }

    setIsProcessingGlobal(true);
    try {
      // --- İlk kez uygulamadan önce snapshot al (undo için) ---
      await ensureSnapshot();

      const response = await apiService.scaleFeatures({
        method,
        target_column: targetColumn || undefined,
      });

      if (response.error) {
        toast.error(response.error);
        return;
      }

      if (response.data) {
        onDataUpdate({
          data: response.data.data,
          columns: response.data.columns,
          shape: response.data.shape,
          dtypes: processedData?.dtypes || {},
        });
        toast.success(response.data.message || 'Scaling uygulandı.');
      }
    } catch (error) {
      console.error('Global scaling error:', error);
      toast.error('Global scaling başarısız.');
    } finally {
      setIsProcessingGlobal(false);
    }
  };

  const handleColumnSpecificApply = async () => {
    if (!processedData || columnSpecificSettings.length === 0) return;

    setIsProcessingColumn(true);
    try {
      // --- İlk kez uygulamadan önce snapshot al (undo için) ---
      await ensureSnapshot();

      const mapping: Record<string, string> = Object.fromEntries(
        columnSpecificSettings.map((s) => [s.column, s.method])
      );

      const response = await apiService.scaleFeatures({
        column_specific_settings: mapping,
        target_column: targetColumn || undefined,
      });

      if (response.error) {
        toast.error(response.error);
        return;
      }

      if (response.data) {
        onDataUpdate({
          data: response.data.data,
          columns: response.data.columns,
          shape: response.data.shape,
          dtypes: processedData?.dtypes || {},
        });
        toast.success(response.data.message || 'Sütun bazlı scaling uygulandı.');
      }
    } catch (error) {
      console.error('Column-specific scaling error:', error);
      toast.error('Sütun bazlı scaling başarısız.');
    } finally {
      setIsProcessingColumn(false);
    }
  };

  const addColumnSetting = () => {
    const available = getAvailableColumns();
    if (available.length > 0) {
      setColumnSpecificSettings((prev) => [
        ...prev,
        { column: available[0], method: 'standard' },
      ]);
    }
  };

  const removeColumnSetting = (index: number) => {
    setColumnSpecificSettings((prev) => prev.filter((_, i) => i !== index));
  };

  const updateColumnSetting = (
    index: number,
    field: keyof ColumnSpecificScalingSetting,
    value: string
  ) => {
    setColumnSpecificSettings((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value as any } : s))
    );
  };

  const getAvailableColumns = (current?: string) => {
    return numericColumnsExceptTarget.filter(
      (col) =>
        col === current ||
        !columnSpecificSettings.some((s) => s.column === col)
    );
  };

  const handleFinalApply = () => {
    onStepComplete(STEP_ID, {
      method,
      targetColumn,
      columnSpecificSettings,
      scaledColumns: numericColumns.filter(col => col !== targetColumn)
    });
  };
  
  const handleSkip = () => {
    onStepComplete(STEP_ID, { skipped: true });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {/* Başlık */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-2xl font-bold text-white mb-2">{t('scaling')} Features</h2>
          <InfoTip text={t('infoScalingOverview')} />
        </div>
        <p className="text-gray-400">Sayısal özellikleri normalleştirerek model performansını iyileştirin.</p>
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
            stepId={STEP_ID}
            onDataUpdate={handlePreviewUpdate}
          />
        </div>
      )}

      {/* Global Scaling Settings */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-white">Global Scaling Settings</h3>
          <InfoTip text={t('infoGlobalScaling')} />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              Default Scaling Method
              <InfoTip text={t('infoDefaultScalingMethod')} />
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as 'standard' | 'minmax' | 'robust')}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-cyan-400 focus:outline-none"
            >
              <option value="standard">Standard (Z-score)</option>
              <option value="minmax">Min-Max [0, 1]</option>
              <option value="robust">Robust (median/IQR)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              Target Column (Skip Scaling)
              <InfoTip text={t('infoTargetSkipScaling')} />
            </label>
            <select
              value={targetColumn}
              onChange={(e) => setTargetColumn(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-cyan-400 focus:outline-none"
            >
              <option value="">No target column</option>
              {numericColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <motion.button
            onClick={handleGlobalApply}
            disabled={isProcessingGlobal || numericColumnsExceptTarget.length === 0}
            className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 disabled:opacity-50"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isProcessingGlobal ? 'Applying...' : 'Apply Global Scaling'}
          </motion.button>
        </div>
      </div>

      {/* Column-Specific Settings */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">Column-Specific Settings</h3>
            <InfoTip text={t('infoScalingColumnSpecific')} />
          </div>
        <motion.button
            onClick={addColumnSetting}
            disabled={getAvailableColumns().length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Plus className="w-4 h-4" />
            Add Column
          </motion.button>
        </div>

        {columnSpecificSettings.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            Sütun bazlı ayar yok. Tüm sayısal sütunlara Global ayarlar uygulanır.
          </div>
        ) : (
          <div className="space-y-4">
            {columnSpecificSettings.map((setting, index) => {
              const colIndex = processedData?.columns.indexOf(setting.column) ?? -1;
              const sampleValues =
                colIndex >= 0
                  ? (processedData?.data || [])
                      .slice(0, 5)
                      .map((row) => Number(row[colIndex]))
                      .filter((v) => !Number.isNaN(v))
                  : [];

              return (
                <div key={`${setting.column}-${index}`} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3">
                      <select
                        value={setting.column}
                        onChange={(e) => updateColumnSetting(index, 'column', e.target.value)}
                        className="px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:border-cyan-400 focus:outline-none"
                      >
                        {getAvailableColumns(setting.column).map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                      <div className="text-gray-400 text-sm">
                        Sample: {sampleValues.slice(0, 3).map((v) => v.toFixed(2)).join(', ')}…
                      </div>
                    </div>
                    <motion.button
                      onClick={() => removeColumnSetting(index)}
                      className="p-2 text-red-400 hover:text-red-300 transition-colors"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Minus className="w-4 h-4" />
                    </motion.button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                      Scaling Method
                      <InfoTip text={t('infoDefaultScalingMethod')} />
                    </label>
                    <select
                      value={setting.method}
                      onChange={(e) =>
                        updateColumnSetting(index, 'method', e.target.value as 'standard' | 'minmax' | 'robust')
                      }
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:border-cyan-400 focus:outline-none"
                    >
                      <option value="standard">Standard Scaling</option>
                      <option value="minmax">Min-Max Scaling</option>
                      <option value="robust">Robust Scaling</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {columnSpecificSettings.length > 0 && (
          <div className="mt-6 flex justify-end">
            <motion.button
              onClick={handleColumnSpecificApply}
              disabled={isProcessingColumn}
              className="px-6 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300 disabled:opacity-50"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isProcessingColumn ? 'Applying...' : 'Apply Column Settings'}
            </motion.button>
          </div>
        )}
      </div>

      {numericColumns.length === 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-center">
          <div className="text-gray-400">Sayısal sütun bulunamadı.</div>
        </div>
      )}

      <div className="flex justify-center gap-4">
        <motion.button
          onClick={handleSkip}
          className="px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {t('skip')} Scaling
        </motion.button>

        <motion.button
          onClick={handleFinalApply}
          className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-300"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {t('continue')} to Next Step
        </motion.button>
      </div>
    </motion.div>
  );
};
