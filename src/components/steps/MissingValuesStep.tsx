// src/components/steps/MissingValuesStep.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, LabelList
} from 'recharts';
import { DataTable } from '../DataTable';
import { useLanguage } from '../../hooks/useLanguage';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';
import InfoTip from '../InfoTip';

export interface ProcessedData {
  data: any[][];
  columns: string[];
  shape: [number, number];
  dtypes: Record<string, string>;
  missingValues?: Record<string, number>;
}

interface MissingValuesStepProps {
  processedData: ProcessedData | null;
  onDataUpdate: (data: ProcessedData) => void;
  onStepComplete: (stepId: number, result?: any) => void;
  stepResults: Record<number, any>;
  sessionId: string | null;
}

interface ColumnSpecificSetting {
  column: string;
  strategy: string;
  fillValue?: string;
}

export const MissingValuesStep: React.FC<MissingValuesStepProps> = ({
  processedData,
  onDataUpdate,
  onStepComplete,
  stepResults,
  sessionId
}) => {
  const { t } = useLanguage();

  // -- Ayarlar
  const [strategy, setStrategy] = useState('mean');
  const [catStrategy, setCatStrategy] = useState('mode');
  const [fillValue, setFillValue] = useState('unknown');
  const [dropStrategy, setDropStrategy] = useState<string | null>(null);
  const [columnSpecificSettings, setColumnSpecificSettings] = useState<ColumnSpecificSetting[]>([]);

  // -- Durum flag'leri
  const [isProcessingGlobal, setIsProcessingGlobal] = useState(false);
  const [isProcessingColumn, setIsProcessingColumn] = useState(false);

  // -- Eksik değer bilgisi: { columnName: count }
  const [missingInfo, setMissingInfo] = useState<Record<string, number>>({});

  // --- Snapshot (undo için) yalnızca ilk apply öncesi bir kez alınır
  const hasSnapRef = useRef(false);
  const ensureSnapshot = async () => {
    if (hasSnapRef.current) return;
    try {
      // Missing Values adımı: stepId = 3
      await apiService.snapshotStep({ stepId: 3 });
      hasSnapRef.current = true;
    } catch {
      // sessiz geç (backend snapshot yoksa ya da zaten alınmışsa)
    }
  };

  // processedData’dan gelen missingValues’u iç state’e yansıt
  useEffect(() => {
    if (processedData?.missingValues) {
      setMissingInfo(processedData.missingValues);
    }
  }, [processedData]);

  // EĞER missingInfo yoksa (boşsa), bir kere analiz isteğiyle doldurmaya çalış
  useEffect(() => {
    const loadIfNeeded = async () => {
      if (!processedData) return;
      if (Object.keys(missingInfo || {}).length > 0) return;
      // Önce parent’tan gelen varsa onu kullan, yoksa backend’den çek
      if (!processedData.missingValues) {
        try {
          const res = await apiService.analyzeDataset();
          if (!res.error && res.data?.missing_values) {
            setMissingInfo(res.data.missing_values);
            // parent state’i de senkron tutmak istersen:
            onDataUpdate({
              data: res.data.data,
              columns: res.data.columns,
              shape: res.data.shape,
              dtypes: processedData.dtypes || {},
              missingValues: res.data.missing_values
            });
          }
        } catch {
          // sessiz geç
        }
      }
    };
    loadIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processedData, missingInfo]);

  const handlePreviewUpdate = async (payload: {
    data: any[][];
    columns: string[];
    shape: [number, number];
    missingValues?: Record<string, number>;
  }) => {
    // Parent state
    onDataUpdate({
      data: payload.data,
      columns: payload.columns,
      shape: payload.shape,
      dtypes: processedData?.dtypes || {},
      missingValues: payload.missingValues
    });

    if (payload.missingValues) {
      setMissingInfo(payload.missingValues);
    } else {
      const res = await apiService.analyzeDataset();
      if (!res.error && res.data?.missing_values) {
        setMissingInfo(res.data.missing_values);
        // parent’a da yansıt (opsiyonel ama senkron kalır)
        onDataUpdate({
          data: res.data.data,
          columns: res.data.columns,
          shape: res.data.shape,
          dtypes: processedData?.dtypes || {},
          missingValues: res.data.missing_values
        });
      }
    }
  };

  // 2) GLOBAL APPLY
  const handleGlobalApply = async () => {
    if (!processedData) return;
    setIsProcessingGlobal(true);
    try {
      await ensureSnapshot(); // ilk apply’den önce snapshot
      const response = await apiService.handleMissingValues({
        strategy,
        cat_strategy: catStrategy,
        fill_value: fillValue,
        drop_strategy: dropStrategy
      });
      if (response.error) {
        toast.error(response.error);
        return;
      }
      if (response.data) {
        const updated: ProcessedData = {
          data: response.data.data,
          columns: response.data.columns,
          shape: response.data.shape,
          dtypes: processedData.dtypes || {},
          missingValues: response.data.missing_values
        };
        onDataUpdate(updated);
        setMissingInfo(response.data.missing_values);
        toast.success(response.data.message);
      }
    } catch {
      toast.error('Failed to handle global missing values');
    } finally {
      setIsProcessingGlobal(false);
    }
  };

  // 3) COLUMN-SPECIFIC APPLY
  const handleColumnSpecificApply = async () => {
    if (!processedData || columnSpecificSettings.length === 0) return;
    setIsProcessingColumn(true);
    try {
      await ensureSnapshot(); // ilk apply’den önce snapshot
      const response = await apiService.handleMissingValues({
        column_specific_settings: columnSpecificSettings
      });
      if (response.error) {
        toast.error(response.error);
        return;
      }
      if (response.data) {
        const updated: ProcessedData = {
          data: response.data.data,
          columns: response.data.columns,
          shape: response.data.shape,
          dtypes: processedData.dtypes || {},
          missingValues: response.data.missing_values
        };
        onDataUpdate(updated);
        setMissingInfo(response.data.missing_values);
        toast.success(response.data.message);
      }
    } catch {
      toast.error('Failed to handle column-specific missing values');
    } finally {
      setIsProcessingColumn(false);
    }
  };

  // 4) Next step
  const handleFinalApply = () => {
    if (!processedData) return;
    onStepComplete(3, {
      strategy,
      catStrategy,
      fillValue,
      dropStrategy,
      columnSpecificSettings,
      rowsBefore: processedData.shape[0],
      rowsAfter: processedData.shape[0]
    });
  };

  // --- YENİ: tek noktadan "uygun kolon" hesabı ---
  // missingInfo bilinmiyorsa (boşsa) tüm kolonları eklemeye izin veriyoruz (buton kilitli kalmasın).
  const getAvailableColumns = (current?: string) => {
    const cols = processedData?.columns || [];
    const missingKnown = Object.keys(missingInfo || {}).length > 0;

    return cols.filter(col => {
      const notAlready =
        col === current || !columnSpecificSettings.some(s => s.column === col);
      const hasMissing = missingKnown ? (missingInfo[col] || 0) > 0 : true;
      return notAlready && hasMissing;
    });
  };

  const addColumnSetting = () => {
    const avail = getAvailableColumns();
    if (avail.length) {
      setColumnSpecificSettings(prev => [
        ...prev,
        { column: avail[0], strategy: 'mean', fillValue: 'unknown' }
      ]);
    }
  };
  const removeColumnSetting = (i: number) =>
    setColumnSpecificSettings(prev => prev.filter((_, idx) => idx !== i));
  const updateColumnSetting = (i: number, f: keyof ColumnSpecificSetting, v: string) =>
    setColumnSpecificSettings(prev =>
      prev.map((s, idx) => (idx === i ? { ...s, [f]: v } : s))
    );

  const totalMissing = Object.values(missingInfo).reduce((sum, v) => sum + v, 0);
  const columnsWithMissing = Object.values(missingInfo).filter(v => v > 0).length;
  const missingPercentage = processedData
    ? ((totalMissing / (processedData.shape[0] * processedData.shape[1])) * 100).toFixed(1)
    : '0.0';

  // --- Chart data (dinamik) ---
  const chartData = useMemo(() => {
    return Object.entries(missingInfo || {})
      .filter(([, count]) => (count || 0) > 0)
      .map(([col, count]) => ({
        column: col.length > 14 ? col.slice(0, 14) + '…' : col,
        missing: count || 0
      }))
      .sort((a, b) => b.missing - a.missing);
  }, [missingInfo]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {/* Başlık */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">{t('missingValues')} Handling</h2>
        <p className="text-gray-400">Configure how to handle missing values in your dataset</p>
      </div>

      {/* Data Preview */}
      {processedData && (
        <div className="mb-8">
          <DataTable
            title={t('dataPreview')}
            titleInfoText={t('infoDataPreview')}
            data={processedData.data}
            columns={processedData.columns}
            showAllRows={true}
            stepId={3}
            onDataUpdate={handlePreviewUpdate}
          />
        </div>
      )}

      {/* Missing Summary (+ Chart) */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Missing Values Summary</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-cyan-400">{totalMissing}</div>
            <div className="text-gray-400">Total Missing Values</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-400">{columnsWithMissing}</div>
            <div className="text-gray-400">Columns with Missing Values</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-400">{missingPercentage}%</div>
            <div className="text-gray-400">Missing Percentage</div>
          </div>
        </div>

        {/* Chart: Missing by Column */}
        {chartData.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="text-gray-300 font-medium">Missing by Column</div>
              <InfoTip text="Distribution of missing values per column." />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
                  <XAxis dataKey="column" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <ChartTooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="missing" fill="#f59e0b">
                    <LabelList dataKey="missing" position="top" fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Global Settings */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-white">Global Settings</h3>
          <InfoTip text={t('infoGlobalSettings')} />
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              Numeric Strategy
              <InfoTip text={t('infoNumericStrategy')} />
            </label>
            <select
              value={strategy}
              onChange={e => setStrategy(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            >
              <option value="mean">Mean</option>
              <option value="median">Median</option>
              <option value="zero">Zero</option>
              <option value="ffill">Forward Fill</option>
              <option value="bfill">Backward Fill</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              Categorical Strategy
              <InfoTip text={t('infoCategoricalStrategy')} />
            </label>
            <select
              value={catStrategy}
              onChange={e => setCatStrategy(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            >
              <option value="mode">Mode</option>
              <option value="constant">Constant</option>
              <option value="ffill">Forward Fill</option>
              <option value="bfill">Backward Fill</option>
            </select>
          </div>
          {catStrategy === 'constant' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Fill Value</label>
              <input
                type="text"
                value={fillValue}
                onChange={e => setFillValue(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                placeholder="Enter fill value"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              Drop Strategy
              <InfoTip text={t('infoDropStrategy')} />
            </label>
            <select
              value={dropStrategy || ''}
              onChange={e => setDropStrategy(e.target.value || null)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            >
              <option value="">None</option>
              <option value="rows">Drop Rows</option>
              <option value="columns">Drop Columns</option>
            </select>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <motion.button
            onClick={handleGlobalApply}
            disabled={isProcessingGlobal}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
            whileHover={{ scale: 1.05 }}
          >
            {isProcessingGlobal ? 'Applying...' : 'Apply Global Settings'}
          </motion.button>
        </div>
      </div>

      {/* Column-Specific */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">Column-Specific Settings</h3>
            <InfoTip text={t('infoColumnSpecific')} />
          </div>
        <motion.button
            onClick={addColumnSetting}
            disabled={getAvailableColumns().length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
            whileHover={{ scale: 1.05 }}
          >
            <Plus className="w-4 h-4" /> Add Column
          </motion.button>
        </div>
        {columnSpecificSettings.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No column-specific settings configured.</div>
        ) : (
          columnSpecificSettings.map((s, i) => {
            const miss = missingInfo[s.column] || 0;
            const isNum =
              processedData?.dtypes[s.column]?.includes('int') ||
              processedData?.dtypes[s.column]?.includes('float');
            return (
              <div key={i} className="bg-gray-700 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-3">
                    <select
                      value={s.column}
                      onChange={e => updateColumnSetting(i, 'column', e.target.value)}
                      className="px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                    >
                      {getAvailableColumns(s.column).map(col => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                    <span className="text-red-400 text-sm">{miss} missing</span>
                  </div>
                  <motion.button
                    onClick={() => removeColumnSetting(i)}
                    className="p-2 text-red-400 hover:text-red-300"
                    whileHover={{ scale: 1.1 }}
                  >
                    <Minus className="w-4 h-4" />
                  </motion.button>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Strategy</label>
                    <select
                      value={s.strategy}
                      onChange={e => updateColumnSetting(i, 'strategy', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                    >
                      {isNum ? (
                        <>
                          <option value="mean">Mean</option>
                          <option value="median">Median</option>
                          <option value="zero">Zero</option>
                          <option value="ffill">Forward Fill</option>
                          <option value="bfill">Backward Fill</option>
                        </>
                      ) : (
                        <>
                          <option value="mode">Mode</option>
                          <option value="constant">Constant</option>
                          <option value="ffill">Forward Fill</option>
                          <option value="bfill">Backward Fill</option>
                        </>
                      )}
                    </select>
                  </div>
                  {s.strategy === 'constant' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Fill Value</label>
                      <input
                        type="text"
                        value={s.fillValue || ''}
                        onChange={e => updateColumnSetting(i, 'fillValue', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                        placeholder="Enter fill value"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        {columnSpecificSettings.length > 0 && (
          <div className="mt-6 flex justify-end">
            <motion.button
              onClick={handleColumnSpecificApply}
              disabled={isProcessingColumn}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg disabled:opacity-50"
              whileHover={{ scale: 1.05 }}
            >
              {isProcessingColumn ? 'Applying...' : 'Apply Column Settings'}
            </motion.button>
          </div>
        )}
      </div>

      {/* Continue */}
      <div className="flex justify-center">
        <motion.button
          onClick={handleFinalApply}
          className="px-8 py-3 bg-cyan-600 text-white rounded-lg hover:shadow-lg"
          whileHover={{ scale: 1.05 }}
        >
          {t('continue')} to Next Step
        </motion.button>
      </div>
    </motion.div>
  );
};

export default MissingValuesStep;
