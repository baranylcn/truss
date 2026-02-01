import React, { useState, useEffect, useRef } from 'react';
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

interface ProcessedData {
  data: any[][];
  columns: string[];
  shape: [number, number];
  dtypes: Record<string, string>;
}

type DetectMethod = 'iqr' | 'zscore' | 'auto';
type Strategy     = 'remove' | 'nan' | 'cap' | 'impute_median' | 'impute_mean';

interface ColumnConfig {
  column: string;
  strategy: Strategy;
  method: DetectMethod;
  factor: number;
  replaceWithNaN?: boolean;
}

interface Props {
  processedData: ProcessedData | null;
  onDataUpdate: (data: ProcessedData) => void;
  onStepComplete: (stepId: number, result?: any) => void;
}

export const OutlierHandlingStep: React.FC<Props> = ({
  processedData, onDataUpdate, onStepComplete
}) => {
  const { t } = useLanguage();

  const [detectMethod, setDetectMethod] = useState<DetectMethod>('iqr');
  const [detectFactor, setDetectFactor] = useState<number>(1.5);
  const [columnDetectConfigs, setColumnDetectConfigs] = useState<Omit<ColumnConfig, 'replaceWithNaN' | 'strategy'>[]>([]);
  const [outlierResults, setOutlierResults] = useState<Record<string, { count: number; values: number[]; method: string }>>({});
  const [isDetecting, setIsDetecting] = useState<boolean>(false);

  const detectAbortRef = useRef<AbortController | null>(null);
  const detectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detectSeqRef   = useRef(0);

  const [strategy, setStrategy] = useState<Strategy>('remove');
  const [globalMethod, setGlobalMethod] = useState<DetectMethod>('iqr');
  const [globalFactor, setGlobalFactor] = useState<number>(1.5);
  const [columnRemoveConfigs, setColumnRemoveConfigs] = useState<ColumnConfig[]>([]);
  const [isRemovingGlobal, setIsRemovingGlobal] = useState<boolean>(false);
  const [isRemovingColumn, setIsRemovingColumn] = useState<boolean>(false);

  const hasSnapRef = useRef(false);
  const ensureSnapshot = async () => {
    if (hasSnapRef.current) return;
    try {
      await apiService.snapshotStep({ step_id: 4 });
      hasSnapRef.current = true;
    } catch {
      // ignore
    }
  };

  const handlePreviewUpdate = async (payload: {
    data: any[][];
    columns: string[];
    shape: [number, number];
    missingValues?: Record<string, number>;
  }) => {
    onDataUpdate({
      data: payload.data,
      columns: payload.columns,
      shape: payload.shape,
      dtypes: processedData?.dtypes || {}
    });
  };

  const isProbablyNumeric = (col: string) => {
    const raw = processedData?.dtypes?.[col];
    if (!raw) return true;
    const s = String(raw).toLowerCase();
    const keys = ['int', 'float', 'double', 'number', 'decimal'];
    return keys.some(k => s.includes(k));
  };

  const cancelDetection = () => {
    detectAbortRef.current?.abort();
    detectSeqRef.current++;
    setIsDetecting(false);
    toast(t('cancel'));
  };

  useEffect(() => {
    if (!processedData) return;

    if (detectTimerRef.current) clearTimeout(detectTimerRef.current);

    detectTimerRef.current = setTimeout(async () => {
      detectAbortRef.current?.abort();
      const controller = new AbortController();
      detectAbortRef.current = controller;

      const mySeq = ++detectSeqRef.current;
      setIsDetecting(true);

      try {
        const columnsToDetect = columnDetectConfigs.length > 0 
          ? columnDetectConfigs.map((c: any) => c.column)
          : undefined;

        const resp = await apiService.detectOutliers({
          method: detectMethod,
          columns: columnsToDetect,
          factor: detectFactor
        });

        if (mySeq !== detectSeqRef.current) return;

        if (resp?.error) {
          toast.error(`Detect failed: ${resp.error}`);
        } else if (resp?.data) {
          const o = (resp.data as any).outlier_results;
          setOutlierResults(o || {});
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          toast.error('Detect failed');
        }
      } finally {
        if (mySeq === detectSeqRef.current) setIsDetecting(false);
      }
    }, 350);

    return () => {
      if (detectTimerRef.current) {
        clearTimeout(detectTimerRef.current);
        detectTimerRef.current = null;
      }
    };
  }, [processedData, detectMethod, detectFactor, columnDetectConfigs]);

  useEffect(() => {
    return () => {
      detectAbortRef.current?.abort();
      if (detectTimerRef.current) clearTimeout(detectTimerRef.current);
    };
  }, []);

  const totalOutliers = Object.values(outlierResults).reduce((sum, r) => sum + r.count, 0);
  const affectedCols  = Object.values(outlierResults).filter(r => r.count > 0).length;
  const outlierPct    = processedData
    ? ((totalOutliers / Math.max(1, processedData.shape[0])) * 100).toFixed(1)
    : '0.0';
  const chartData     = Object.entries(outlierResults).map(([col, r]) => ({
    column: col.length > 14 ? col.slice(0, 14) + '…' : col,
    outliers: r.count
  })).sort((a,b)=>b.outliers-a.outliers);

  const removeColumnDetect = (i: number) =>
    setColumnDetectConfigs(prev => prev.filter((_, idx) => idx !== i));
  const updateColumnDetect = (i: number, field: 'method'|'factor', value: any) =>
    setColumnDetectConfigs(prev =>
      prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c)
    );

  const getAvailableRemoveColumns = (current?: string) => {
    const cols = processedData?.columns || [];
    return cols.filter(col => {
      const notAlready =
        col === current || !columnRemoveConfigs.some(s => s.column === col);
      return notAlready && isProbablyNumeric(col);
    });
  };

  const addColumnRemove = () => {
    const avail = getAvailableRemoveColumns();
    if (avail.length) {
      setColumnRemoveConfigs(prev => [
        ...prev,
        {
          column: avail[0],
          strategy,
          method: globalMethod,
          factor: globalFactor
        }
      ]);
    } else {
      toast.error('No available columns to add.');
    }
  };

  const removeColumnRemove = (i: number) =>
    setColumnRemoveConfigs(prev => prev.filter((_, idx) => idx !== i));

  const updateColumnRemove = (i: number, field: keyof ColumnConfig, value: any) =>
    setColumnRemoveConfigs(prev =>
      prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c)
    );

  const handleGlobalRemove = async () => {
    if (!processedData) return;
    setIsRemovingGlobal(true);
    try {
      await ensureSnapshot();
      const resp = await apiService.removeOutliers({
        method: globalMethod,
        columns: null
      });
      if (resp.error) {
        toast.error(`Remove failed: ${resp.error}`);
      } else if (resp.data) {
        const d = resp.data as any;
        onDataUpdate({
          data: d.data,
          columns: d.columns,
          shape: d.shape,
          dtypes: processedData.dtypes
        });
        toast.success('Global outlier handling applied');
      }
    } catch {
      toast.error('Remove failed');
    } finally {
      setIsRemovingGlobal(false);
    }
  };

  const handleColumnRemove = async () => {
    if (!processedData || columnRemoveConfigs.length === 0) return;
    setIsRemovingColumn(true);
    try {
      await ensureSnapshot();
      
      for (const col of columnRemoveConfigs) {
        const resp = await apiService.removeOutliers({
          method: col.method,
          columns: [col.column]
        });
        
        if (resp.error) {
          toast.error(`Remove failed for ${col.column}: ${resp.error}`);
          continue;
        }
        
        if (resp.data) {
          const d = resp.data as any;
          onDataUpdate({
            data: d.data,
            columns: d.columns,
            shape: d.shape,
            dtypes: processedData.dtypes
          });
        }
      }
      
      toast.success('Column-specific outlier handling applied');
    } catch {
      toast.error('Remove failed');
    } finally {
      setIsRemovingColumn(false);
    }
  };

  const handleContinue = () => {
    onStepComplete(4);
  };

  return (
    <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="space-y-8">

      {/* Başlık */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">{t('detectOutliers')} & {t('removeOutliers')}</h2>
        <p className="text-gray-400">Detect, visualize and process outliers</p>
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
            stepId={4}
            onDataUpdate={handlePreviewUpdate}
          />
        </div>
      )}

      {/* === OUTLIER DETECTION (combined) === */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        {/* Main header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">Outlier Detection</h3>
            <InfoTip text={t('infoDetectionSettings')} />
          </div>
          {isDetecting && (
            <motion.button
              onClick={cancelDetection}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg"
              whileHover={{ scale:1.05 }}
            >
              {t('cancel')}
            </motion.button>
          )}
        </div>

        {/* Sub: Settings */}
        <div className="mb-2 text-gray-300 font-medium">Settings</div>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm text-gray-300 mb-2 flex items-center gap-2">
              Method
              <InfoTip text={t('infoDetectMethod')} />
            </label>
            <select
              value={detectMethod}
              onChange={e => setDetectMethod(e.target.value as DetectMethod)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            >
              <option value="iqr">IQR</option>
              <option value="zscore">Z-Score</option>
              <option value="auto">Auto</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-2 flex items-center gap-2">
              {detectMethod==='iqr' ? 'IQR Factor' :
               detectMethod==='zscore' ? 'Threshold' : 'Factor'}
              <InfoTip text={t('infoDetectFactor')} />
            </label>
            <input
              type="number"
              value={detectFactor}
              onChange={e => setDetectFactor(Number(e.target.value))}
              step={0.1} min={0.1} max={10}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            />
          </div>
        </div>

        {columnDetectConfigs.map((cfg,i)=>(
          <div key={i} className="mt-4 bg-gray-700 p-4 rounded">
            <div className="flex justify-between items-center mb-2">
              <span className="text-white">{cfg.column}</span>
              <motion.button onClick={()=>removeColumnDetect(i)} whileHover={{ scale: 1.05 }}>
                <Minus className="w-4 h-4 text-red-400"/>
              </motion.button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <select
                value={cfg.method}
                onChange={e=>updateColumnDetect(i,'method',e.target.value as DetectMethod)}
                className="w-full px-2 py-1 bg-gray-600 text-white rounded"
              >
                <option value="iqr">IQR</option>
                <option value="zscore">Z-Score</option>
                <option value="auto">Auto</option>
              </select>
              <input
                type="number"
                value={cfg.factor}
                onChange={e=>updateColumnDetect(i,'factor',Number(e.target.value))}
                step={0.1} min={0.1} max={10}
                className="w-full px-2 py-1 bg-gray-600 text-white rounded"
              />
            </div>
          </div>
        ))}

        {/* Sub: Status or Results */}
        {isDetecting ? (
          <div className="text-center py-8">
            <div className="text-cyan-400 mb-2">Detecting outliers…</div>
            <button
              onClick={cancelDetection}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg"
            >
              {t('cancel')}
            </button>
          </div>
        ) : (
          <>
            {/* Sub: Summary */}
            <div className="mt-6 flex items-center gap-2 mb-3">
              <div className="text-gray-300 font-medium">Summary</div>
              <InfoTip text={t('infoDetectionSummary')} />
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-gray-700 p-4 rounded">
                <div className="text-2xl font-bold text-red-400">{totalOutliers}</div>
                <div className="text-gray-400 flex items-center gap-2">
                  Total Outliers
                  <InfoTip text={t('infoTotalOutliers')} />
                </div>
              </div>
              <div className="bg-gray-700 p-4 rounded">
                <div className="text-2xl font-bold text-blue-400">{affectedCols}</div>
                <div className="text-gray-400 flex items-center gap-2">
                  Affected Columns
                  <InfoTip text={t('infoAffectedColumns')} />
                </div>
              </div>
              <div className="bg-gray-700 p-4 rounded">
                <div className="text-2xl font-bold text-yellow-400">{outlierPct}%</div>
                <div className="text-gray-400 flex items-center gap-2">
                  Outlier %
                  <InfoTip text={t('infoOutlierPercentage')} />
                </div>
              </div>
            </div>

            {/* Sub: Outliers by Column */}
            {chartData.length > 0 && (
              <>
                <div className="mt-6 flex items-center gap-2 mb-3">
                  <div className="text-gray-300 font-medium">Outliers by Column</div>
                  <InfoTip text={t('infoOutliersByColumn')} />
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid stroke="#374151" strokeDasharray="3 3"/>
                      <XAxis dataKey="column" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <ChartTooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '8px'
                        }}
                      />
                      <Bar dataKey="outliers" fill="#ef4444">
                        <LabelList dataKey="outliers" position="top" fontSize={10} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </>
        )}
      </div>
      {/* === /OUTLIER DETECTION (combined) === */}

      {/* Removal Settings */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-white">Removal Settings</h3>
          <InfoTip text={t('infoRemovalSettings')} />
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm text-gray-300 mb-2 flex items-center gap-2">
              Strategy
              <InfoTip text={t('infoRemovalStrategy')} />
            </label>
            <select
              value={strategy}
              onChange={e=>setStrategy(e.target.value as Strategy)}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded"
            >
              <option value="remove">Remove rows</option>
              <option value="nan">Replace with NaN</option>
              <option value="cap">Cap at bounds</option>
              <option value="impute_median">Impute (median)</option>
              <option value="impute_mean">Impute (mean)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-2 flex items-center gap-2">
              Method
              <InfoTip text={t('infoRemovalMethod')} />
            </label>
            <select
              value={globalMethod}
              onChange={e=>setGlobalMethod(e.target.value as DetectMethod)}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded"
            >
              <option value="iqr">IQR</option>
              <option value="zscore">Z-Score</option>
              <option value="auto">Auto</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-2 flex items-center gap-2">
              {globalMethod==='iqr' ? 'IQR Factor' : 'Threshold'}
              <InfoTip text={t('infoRemovalFactor')} />
            </label>
            <input
              type="number"
              value={globalFactor}
              onChange={e=>setGlobalFactor(Number(e.target.value))}
              step={0.1} min={0.1} max={10}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <motion.button
            onClick={handleGlobalRemove}
            disabled={isRemovingGlobal || (processedData?.columns?.length ?? 0) === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
            whileHover={{ scale:1.05 }}
          >
            {isRemovingGlobal ? 'Applying...' : 'Apply Global'}
          </motion.button>
        </div>

        <div className="mt-6 flex justify-between items-center">
          <div className="flex items-center gap-2 text-gray-300 text-sm">
            Column-Specific Settings
            <InfoTip text="Override the global handling with per-column strategies and bounds." />
          </div>
          <motion.button
            onClick={addColumnRemove}
            disabled={getAvailableRemoveColumns().length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
            whileHover={{ scale:1.05 }}
          >
            <Plus className="w-4 h-4 inline-block"/> Add Column Config
          </motion.button>
        </div>

        {columnRemoveConfigs.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No column-specific settings configured.
          </div>
        ) : (
          columnRemoveConfigs.map((cfg, i)=>(
            <div key={i} className="mt-4 bg-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                  <select
                    value={cfg.column}
                    onChange={e=>updateColumnRemove(i,'column', e.target.value)}
                    className="px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white"
                  >
                    {getAvailableRemoveColumns(cfg.column).map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                  <span className="text-yellow-300 text-sm">
                    {(outlierResults[cfg.column]?.count ?? 0)} outliers
                  </span>
                </div>
                <motion.button onClick={()=>removeColumnRemove(i)} whileHover={{ scale:1.1 }}>
                  <Minus className="w-4 h-4 text-red-400"/>
                </motion.button>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <select
                  value={cfg.strategy}
                  onChange={e=>updateColumnRemove(i,'strategy', e.target.value as Strategy)}
                  className="w-full px-2 py-1 bg-gray-600 text-white rounded"
                >
                  <option value="remove">Remove rows</option>
                  <option value="nan">Replace with NaN</option>
                  <option value="cap">Cap at bounds</option>
                  <option value="impute_median">Impute (median)</option>
                  <option value="impute_mean">Impute (mean)</option>
                </select>

                <select
                  value={cfg.method}
                  onChange={e=>updateColumnRemove(i,'method', e.target.value as DetectMethod)}
                  className="w-full px-2 py-1 bg-gray-600 text-white rounded"
                >
                  <option value="iqr">IQR</option>
                  <option value="zscore">Z-Score</option>
                  <option value="auto">Auto</option>
                </select>

                <input
                  type="number"
                  value={cfg.factor}
                  onChange={e=>updateColumnRemove(i,'factor', Number(e.target.value))}
                  step={0.1} min={0.1} max={10}
                  className="w-full px-2 py-1 bg-gray-600 text-white rounded"
                />
              </div>
            </div>
          ))
        )}

        {columnRemoveConfigs.length > 0 && (
          <div className="mt-6 flex justify-end">
            <motion.button
              onClick={handleColumnRemove}
              disabled={isRemovingColumn}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg disabled:opacity-50"
              whileHover={{ scale:1.05 }}
            >
              {isRemovingColumn ? 'Applying...' : 'Apply Column Settings'}
            </motion.button>
          </div>
        )}
      </div>

      {/* Continue */}
      <div className="flex justify-center">
        <motion.button
          onClick={handleContinue}
          className="px-8 py-3 bg-cyan-600 text-white rounded-lg hover:shadow-lg"
          whileHover={{ scale:1.05 }}
        >
          {t('continue')} to Next Step
        </motion.button>
      </div>
    </motion.div>
  );
};

export default OutlierHandlingStep;
