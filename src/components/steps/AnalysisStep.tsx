// src/components/steps/AnalysisStep.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList
} from 'recharts';
import { 
  Database, 
  AlertTriangle, 
  TrendingUp, 
  Target,
  BarChart3,
  Activity,
  Eye,
  Info,
  ChevronDown
} from 'lucide-react';
import { apiService } from '../../services/api';
import { DataTable } from '../DataTable';
import { useLanguage } from '../../hooks/useLanguage';
import InfoTip from '../InfoTip';

interface ProcessedData {
  data: any[][];
  columns: string[];
  shape?: [number, number];
  dtypes?: Record<string, string>;
  missingValues?: Record<string, number>;
}

interface AnalysisStepProps {
  processedData: ProcessedData | null;
  onDataUpdate: (data: ProcessedData) => void;
  onStepComplete: (stepId: number, result?: any) => void;
  stepResults: Record<number, any>;
  sessionId: string | null;
}

type Extras = {
  vif?: Record<string, number>;
  missing_patterns?: {
    row_missing_hist?: Array<[number, number]>;
    pairwise_missing_corr?: Record<string, Record<string, number>>;
  };
  distribution_stats?: Record<string, { skew?: number; kurt?: number }>;
  cat_assoc_pairs?: Array<{ col1: string; col2: string; cramers_v: number }>;
  feature_target_assoc?: Record<string, { score: number; test: string }>;
};

/** Collapsible card shell */
const CollapsibleCard: React.FC<{
  isOpen: boolean;
  onToggle: () => void;
  icon?: React.ReactNode;
  title: React.ReactNode;
  right?: React.ReactNode;
  delay?: number;
  children: React.ReactNode;
}> = ({ isOpen, onToggle, icon, title, right, delay = 0, children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6 md:p-8 shadow-2xl"
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 text-left group"
        aria-expanded={isOpen}
      >
        {icon && <div className="p-2 rounded-lg bg-white/5">{icon}</div>}
        <h3 className="flex-1 text-2xl font-bold text-white">{title}</h3>
        {right}
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="ml-2 rounded-full border border-white/10 p-1"
        >
          <ChevronDown className="w-5 h-5 text-gray-300" />
        </motion.div>
      </button>

      <motion.div
        initial={false}
        animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="overflow-hidden"
      >
        <div className="pt-6">{children}</div>
      </motion.div>
    </motion.div>
  );
};

export const AnalysisStep: React.FC<AnalysisStepProps> = ({
  processedData,
  onDataUpdate,
  onStepComplete,
}) => {
  const { t } = useLanguage();

  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Collapsible state: combined quality & associations
  const [isQualityAssocOpen, setIsQualityAssocOpen] = useState(false);

  // Opsiyonel: hedefe göre içgörü (keşif)
  const [insightTarget, setInsightTarget] = useState<string>('');

  const prevColsSig = useRef<string>('');
  const prevTarget = useRef<string>('');

  useEffect(() => {
    if (!processedData) return;
    const cols = processedData.columns || [];
    const sig = JSON.stringify(cols);
    const targetChanged = prevTarget.current !== insightTarget;
    const colsChanged = !prevColsSig.current || prevColsSig.current !== sig;

    if (!analysisResults || colsChanged || targetChanged) {
      performAnalysis(insightTarget || undefined);
    }
    prevColsSig.current = sig;
    prevTarget.current = insightTarget;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processedData, insightTarget]);

  const performAnalysis = async (target?: string) => {
    setIsAnalyzing(true);
    try {
      const response = await apiService.analyzeDataset({ target });
      if (response.error) {
        console.error('Analysis error:', response.error);
        setIsAnalyzing(false);
        return;
      }
      if (response.data) {
        onDataUpdate({
          data: response.data.data,
          columns: response.data.columns,
          missingValues: response.data.missing_values
        });
        setAnalysisResults(response.data);
      }
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePreviewUpdate = (serverData: any) => {
    if (!serverData) return;
    onDataUpdate({
      data: serverData.data,
      columns: serverData.columns,
      missingValues: serverData.missing_values ?? serverData.missingValues
    });

    const hasBits =
      serverData.dtypes ||
      serverData.column_types ||
      serverData.memory ||
      serverData.unique_counts ||
      serverData.categorical ||
      serverData.numerical ||
      serverData.vif ||
      serverData.missing_patterns ||
      serverData.distribution_stats ||
      serverData.cat_assoc_pairs ||
      serverData.feature_target_assoc;

    if (hasBits) {
      setAnalysisResults({
        ...analysisResults,
        ...serverData
      });
      return;
    }
    performAnalysis(insightTarget || undefined);
  };

  // ---- Data Quality Score & uyarılar (frontend) ----
  const quality = useMemo(() => {
    if (!analysisResults && !processedData) return null;

    const rows = Array.isArray(analysisResults?.shape)
      ? analysisResults.shape[0]
      : (processedData?.data?.length ?? 0);
    const cols = Array.isArray(analysisResults?.shape)
      ? analysisResults.shape[1]
      : (processedData?.columns?.length ?? 0);

    const missingObj = analysisResults?.missing_values ?? processedData?.missingValues ?? {};
    const totalMissing = Object.values(missingObj).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
    const missingPct = rows && cols ? (totalMissing / (rows * cols)) : 0;

    const dtypes = (analysisResults?.dtypes || {}) as Record<string, string>;
    const unique = (analysisResults?.unique_counts || {}) as Record<string, number>;

    const constantCols: string[] = [];
    const idLikeCols: string[] = [];
    const highCardCat: string[] = [];

    const catSet = new Set<string>(analysisResults?.column_types?.categorical ?? []);

    const allCols = analysisResults?.columns ?? processedData?.columns ?? [];
    for (const c of allCols) {
      const u = unique?.[c] ?? 0;
      if (u <= 1) constantCols.push(c);

      if (rows > 0 && u >= 0.98 * rows) {
        const dt = (dtypes?.[c] || '').toLowerCase();
        if (dt.includes('int') || dt.includes('float') || dt.includes('object') || dt.includes('string')) {
          idLikeCols.push(c);
        }
      }
      if (catSet.has(c) && rows > 0 && u > 0.5 * rows) {
        highCardCat.push(c);
      }
    }

    let score = 100;
    score -= Math.min(40, missingPct * 100 * 0.4);
    score -= Math.min(24, constantCols.length * 8);
    score -= Math.min(24, idLikeCols.length * 6);
    score -= Math.min(20, highCardCat.length * 4);
    score = Math.max(0, Math.min(100, Math.round(score)));

    return { rows, cols, missingPct, constantCols, idLikeCols, highCardCat, score };
  }, [analysisResults, processedData]);

  // ---- Küçük backend ekleri ----
  const extras: Extras = {
    vif: analysisResults?.vif,
    missing_patterns: analysisResults?.missing_patterns,
    distribution_stats: analysisResults?.distribution_stats,
    cat_assoc_pairs: analysisResults?.cat_assoc_pairs,
    feature_target_assoc: analysisResults?.feature_target_assoc
  };

  // Görseller için hazırlanmış veri
  const rowMissingHist = useMemo(() => {
    const raw = extras.missing_patterns?.row_missing_hist ?? [];
    return raw.map(([miss, freq]) => ({ missing: miss, rows: freq }));
  }, [extras.missing_patterns]);

  const topMissingPairs = useMemo(() => {
    const pmc = extras.missing_patterns?.pairwise_missing_corr || {};
    const pairs: Array<{ pair: string; corr: number }> = [];
    for (const a of Object.keys(pmc)) {
      for (const b of Object.keys(pmc[a] || {})) {
        if (a < b) pairs.push({ pair: `${a} ↔ ${b}`, corr: pmc[a][b] });
      }
    }
    return pairs.sort((x, y) => y.corr - x.corr).slice(0, 10);
  }, [extras.missing_patterns]);

  const vifList = useMemo(() => {
    const v = extras.vif || {};
    return Object.entries(v).map(([col, score]) => ({ col, vif: score }))
      .sort((a, b) => b.vif - a.vif);
  }, [extras.vif]);

  const skewList = useMemo(() => {
    const ds = extras.distribution_stats || {};
    return Object.entries(ds).map(([col, s]) => ({
      col,
      skew: s?.skew ?? 0,
      suggestion:
        typeof s?.skew === 'number'
          ? (Math.abs(s.skew) >= 1.0 ? (s.skew > 0 ? 'Consider log/yeo-johnson' : 'Consider square/yeo-johnson') : 'Looks OK')
          : '—'
    })).sort((a, b) => Math.abs(b.skew) - Math.abs(a.skew)).slice(0, 12);
  }, [extras.distribution_stats]);

  const topCatAssoc = useMemo(() => {
    const arr = extras.cat_assoc_pairs || [];
    return arr.sort((a, b) => b.cramers_v - a.cramers_v).slice(0, 12)
      .map(x => ({ pair: `${x.col1} ↔ ${x.col2}`, v: x.cramers_v }));
  }, [extras.cat_assoc_pairs]);

  const featureTargetAssocList = useMemo(() => {
    const fta = extras.feature_target_assoc || {};
    const arr = Object.entries(fta).map(([col, obj]) => ({ col, score: obj.score, test: obj.test }));
    return arr.sort((a, b) => b.score - a.score).slice(0, 20);
  }, [extras.feature_target_assoc]);

  const handleContinue = () => {
    onDataUpdate({
      data: analysisResults?.data ?? processedData?.data ?? [],
      columns: analysisResults?.columns ?? processedData?.columns ?? [],
      missingValues: analysisResults?.missing_values
    });
    onStepComplete(2, analysisResults);
  };

  if (isAnalyzing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center p-12 bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 shadow-2xl"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 mb-6 mx-auto"
          >
            <Activity className="w-8 h-8 text-white" />
          </motion.div>
          <h3 className="text-2xl font-bold text-white mb-2">Analyzing Dataset</h3>
          <p className="text-gray-400">Deep diving into your data structure and patterns...</p>
          <div className="flex items-center justify-center gap-1 mt-4">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}
                className="w-2 h-2 rounded-full bg-cyan-400"
              />
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="space-y-8 max-w-7xl mx-auto"
    >
      {/* Header Section */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center mb-12"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 mb-6 shadow-lg shadow-cyan-500/25">
          <BarChart3 className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-4">
          {t('analyze')} Dataset
        </h2>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Explore your dataset structure, uncover patterns, and assess data quality with comprehensive analytics
        </p>
      </motion.div>

      {/* Data Preview */}
      {processedData && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <DataTable
            title={t('dataPreview')}
            titleInfoText={t('infoDataPreview')}
            data={processedData.data}
            columns={processedData.columns}
            showAllRows={true}
            stepId={2}
            onDataUpdate={handlePreviewUpdate}
          />
        </motion.div>
      )}

      {/* Dataset Overview (always open) */}
      {analysisResults && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-8 shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 rounded-lg bg-gradient-to-r from-cyan-500/20 to-blue-600/20">
              <Database className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-2xl font-bold text-white">Dataset Overview</h3>
          </div>
          
          {/* Top metrics */}
          <div className="grid md:grid-cols-5 gap-6">
            {/* Rows */}
            <motion.div 
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-gradient-to-br from-gray-700/50 to-gray-800/50 rounded-xl p-6 border border-gray-600/30 shadow-lg hover:shadow-cyan-500/10 transition-all duration-300 flex flex-col h-full"
            >
              <div className="mb-2 min-h-[24px]" />
              <div className="mt-auto">
                <div className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-1">
                  {Array.isArray(analysisResults.shape) ? analysisResults.shape[0].toLocaleString() : (processedData?.data?.length ?? 0).toLocaleString()}
                </div>
                <div className="text-gray-400 font-medium">Rows</div>
                <div className="mt-3 h-3 rounded-full opacity-0" />
              </div>
            </motion.div>
            
            {/* Columns */}
            <motion.div 
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-gradient-to-br from-gray-700/50 to-gray-800/50 rounded-xl p-6 border border-gray-600/30 shadow-lg hover:shadow-blue-500/10 transition-all duration-300 flex flex-col h-full"
            >
              <div className="mb-2 min-h-[24px]" />
              <div className="mt-auto">
                <div className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-1">
                  {Array.isArray(analysisResults.shape) ? analysisResults.shape[1] : (processedData?.columns?.length ?? 0)}
                </div>
                <div className="text-gray-400 font-medium">Columns</div>
                <div className="mt-3 h-3 rounded-full opacity-0" />
              </div>
            </motion.div>
            
            {/* Missing Values */}
            <motion.div 
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-gradient-to-br from-gray-700/50 to-gray-800/50 rounded-xl p-6 border border-gray-600/30 shadow-lg hover:shadow-yellow-500/10 transition-all duration-300 flex flex-col h-full"
            >
              <div className="mb-2 min-h-[24px] flex items-center justify-between">
                <InfoTip text={t('infoMissingValuesTotal')} />
              </div>
              <div className="mt-auto">
                <div className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent mb-1">
                  {analysisResults?.missing_values
                    ? Object.values(analysisResults.missing_values).reduce((sum: number, v: any) => sum + (Number(v) || 0), 0).toLocaleString()
                    : (processedData?.missingValues
                        ? Object.values(processedData.missingValues).reduce((s: number, v: any) => s + (Number(v) || 0), 0).toLocaleString()
                        : 0)}
                </div>
                <div className="text-gray-400 font-medium">Missing Values</div>
                <div className="mt-3 h-3 rounded-full opacity-0" />
              </div>
            </motion.div>
            
            {/* MB Memory */}
            <motion.div 
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-gradient-to-br from-gray-700/50 to-gray-800/50 rounded-xl p-6 border border-gray-600/30 shadow-lg hover:shadow-purple-500/10 transition-all duration-300 flex flex-col h-full"
            >
              <div className="mb-2 min-h-[24px] flex items-center justify-between">
                <InfoTip text={t('infoMemoryUsage')} />
              </div>
              <div className="mt-auto">
                <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent mb-1">
                  {analysisResults?.memory ? (analysisResults.memory / 1024 / 1024).toFixed(2) : '0.00'}
                </div>
                <div className="text-gray-400 font-medium">MB Memory</div>
                <div className="mt-3 h-3 rounded-full opacity-0" />
              </div>
            </motion.div>
            
            {/* Quality Score */}
            <motion.div 
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-gradient-to-br from-gray-700/50 to-gray-800/50 rounded-xl p-6 border border-gray-600/30 shadow-lg hover:shadow-green-500/10 transition-all duration-300 flex flex-col h-full"
            >
              <div className="mb-2 min-h-[24px] flex items-center justify-between">
                <InfoTip text={t('infoQualityScore')} />
              </div>
              <div className="mt-auto">
                <div className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent mb-1">
                  {quality?.score ?? 100}
                </div>
                <div className="text-gray-400 font-medium mb-3">Quality Score</div>
                <div className="h-3 bg-gray-600/50 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${quality?.score ?? 100}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 shadow-lg shadow-green-500/25"
                  />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Column Types counts moved here */}
          {analysisResults?.column_types && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-r from-indigo-500/20 to-purple-600/20">
                  <Target className="w-5 h-5 text-indigo-400" />
                </div>
                <h4 className="text-lg font-semibold text-white">Column Types</h4>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-xl p-6 border border-blue-500/20">
                  <div className="text-3xl font-bold text-blue-400 mb-2">
                    {analysisResults.column_types.numeric?.length || 0}
                  </div>
                  <div className="text-gray-300 font-medium">Numeric Features</div>
                </div>
                <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 rounded-xl p-6 border border-green-500/20">
                  <div className="text-3xl font-bold text-green-400 mb-2">
                    {analysisResults.column_types.categorical?.length || 0}
                  </div>
                  <div className="text-gray-300 font-medium">Categorical Features</div>
                </div>
                <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 rounded-xl p-6 border border-yellow-500/20">
                  <div className="text-3xl font-bold text-yellow-400 mb-2">
                    {analysisResults.column_types.boolean?.length || 0}
                  </div>
                  <div className="text-gray-300 font-medium">Boolean Features</div>
                </div>
                <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 rounded-xl p-6 border border-purple-500/20">
                  <div className="text-3xl font-bold text-purple-400 mb-2">
                    {analysisResults.column_types.datetime?.length || 0}
                  </div>
                  <div className="text-gray-300 font-medium">DateTime Features</div>
                </div>
              </div>
            </div>
          )}

          {/* Quality warnings */}
          {quality && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-8 grid md:grid-cols-3 gap-4"
            >
              <div className="bg-gradient-to-br from-gray-700/30 to-gray-800/30 rounded-xl p-4 border border-gray-600/30">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                  <span className="font-semibold text-white">Missing Data</span>
                </div>
                <div className="text-2xl font-bold text-yellow-400 mb-1">
                  {(quality.missingPct * 100).toFixed(1)}%
                </div>
                <div className="text-gray-400 text-sm">Consider Missing Values step</div>
              </div>
              
              <div className="bg-gradient-to-br from-gray-700/30 to-gray-800/30 rounded-xl p-4 border border-gray-600/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-400"></div>
                    <span className="font-semibold text-white">Constant Cols</span>
                  </div>
                  <InfoTip text={t('infoConstantCols')} />
                </div>
                <div className="text-2xl font-bold text-red-400 mb-1">
                  {quality.constantCols.length}
                </div>
                {!!quality.constantCols.length && (
                  <div className="text-gray-400 text-sm truncate" title={quality.constantCols.join(', ')}>
                    {quality.constantCols.slice(0, 3).join(', ')}{quality.constantCols.length > 3 ? '...' : ''}
                  </div>
                )}
              </div>
              
              <div className="bg-gradient-to-br from-gray-700/30 to-gray-800/30 rounded-xl p-4 border border-gray-600/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                    <span className="font-semibold text-white">High Cardinality</span>
                  </div>
                  <InfoTip text={t('infoHighCardCategoricals')} />
                </div>
                <div className="text-2xl font-bold text-orange-400 mb-1">
                  {quality.highCardCat.length}
                </div>
                {!!quality.highCardCat.length && (
                  <div className="text-gray-400 text-sm truncate" title={quality.highCardCat.join(', ')}>
                    {quality.highCardCat.slice(0, 3).join(', ')}{quality.highCardCat.length > 3 ? '...' : ''}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Distribution Skewness (open) */}
      {skewList.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-8 shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 rounded-lg bg-gradient-to-r from-indigo-500/20 to-purple-600/20">
              <TrendingUp className="w-6 h-6 text-indigo-400" />
            </div>
          <h3 className="text-2xl font-bold text-white">Distribution Skewness Analysis</h3>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {skewList.map((s, index) => (
              <motion.div 
                key={s.col}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                whileHover={{ scale: 1.02, y: -2 }}
                className="bg-gradient-to-br from-gray-700/30 to-gray-800/30 rounded-xl p-4 border border-gray-600/30 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-white font-semibold truncate" title={s.col}>{s.col}</div>
                  <div className={`w-3 h-3 rounded-full ${Math.abs(s.skew) >= 1 ? 'bg-red-400' : Math.abs(s.skew) >= 0.5 ? 'bg-yellow-400' : 'bg-green-400'}`}></div>
                </div>
                <div className="text-lg font-bold text-indigo-400 mb-2">
                  Skew: {typeof s.skew === 'number' ? s.skew.toFixed(2) : '—'}
                </div>
                <div 
                  className="text-xs px-3 py-1 rounded-full inline-block font-medium"
                  style={{ 
                    backgroundColor: Math.abs(s.skew) >= 1 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)', 
                    color: Math.abs(s.skew) >= 1 ? '#fbbf24' : '#10b981',
                    border: `1px solid ${Math.abs(s.skew) >= 1 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
                  }}
                >
                  {s.suggestion}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* VIF (open) */}
      {vifList.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-8 shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 rounded-lg bg-gradient-to-r from-red-500/20 to-pink-600/20">
              <Activity className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-2xl font-bold text-white">VIF (Multicollinearity Analysis)</h3>
          </div>
          
          <div className="bg-gray-900/30 rounded-xl p-6 border border-gray-700/30">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vifList.slice(0, 20)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="col" stroke="#9ca3af" interval={0} angle={-25} textAnchor="end" height={80} fontSize={11}/>
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.95)', border: '1px solid #374151', borderRadius: '8px' }} />
                  <Bar dataKey="vif" fill="url(#redPinkGradient)" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="vif" position="top" formatter={(v: number)=>v.toFixed(2)} fontSize={10} />
                  </Bar>
                  <defs>
                    <linearGradient id="redPinkGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f87171" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 p-4 bg-gradient-to-r from-red-500/10 to-pink-500/10 rounded-lg border border-red-500/20">
              <div className="flex items-center gap-2 text-sm text-red-300">
                <Info className="w-4 h-4" />
                <span>
                  VIF &gt; 10 indicates high multicollinearity; 5–10 requires attention
                  (guides Correlation/Feature Selection steps).
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Combined: Missing Values + Missingness Patterns + Categorical Associations (collapsible) */}
      {(analysisResults?.missing_values && Object.values(analysisResults.missing_values).some((val: any) => (Number(val) || 0) > 0))
        || rowMissingHist.length > 0 || topMissingPairs.length > 0 || topCatAssoc.length > 0 ? (
        <CollapsibleCard
          isOpen={isQualityAssocOpen}
          onToggle={() => setIsQualityAssocOpen(v => !v)}
          icon={<AlertTriangle className="w-6 h-6 text-red-400" />}
          title="Data Quality & Associations"
          delay={0.9}
          right={null}
        >
          <div className="space-y-8">
        {/* Missing Values by Column */}
        {analysisResults?.missing_values &&
          Object.values(analysisResults.missing_values).some((val: any) => (Number(val) || 0) > 0) && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-300">
                Missing Values by Column
              </h4>
              <InfoTip text={t('infoMissingValuesTotal')} />
            </div>

            <div className="h-80 bg-gray-900/30 rounded-xl p-4 border border-gray-700/30">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={Object.entries(analysisResults.missing_values)
                    .filter(([_, value]: [string, any]) => (Number(value) || 0) > 0)
                    .map(([column, value]: [string, any]) => ({
                      column: column.length > 14 ? column.substring(0, 14) + '…' : column,
                      missing: Number(value) || 0
                    }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="column" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(17, 24, 39, 0.95)', 
                      border: '1px solid #374151', 
                      borderRadius: '12px'
                    }} 
                  />
                  <Bar dataKey="missing" fill="url(#redGradient)" radius={[4, 4, 0, 0]} />
                  <defs>
                    <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f87171" />
                      <stop offset="100%" stopColor="#dc2626" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
            {/* Missingness Patterns */}
            {(rowMissingHist.length > 0 || topMissingPairs.length > 0) && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-gradient-to-r from-orange-500/20 to-red-600/20">
                    <TrendingUp className="w-5 h-5 text-orange-400" />
                  </div>
                  <h4 className="text-xl font-semibold text-white">Missingness Patterns</h4>
                </div>
                <div className="grid lg:grid-cols-2 gap-8">
                  {rowMissingHist.length > 0 && (
                    <div className="bg-gray-900/30 rounded-xl p-6 border border-gray-700/30">
                      <div className="text-lg font-semibold text-gray-200 mb-4">Rows by Missing Fields Count</div>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={rowMissingHist}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="missing" stroke="#9ca3af" fontSize={12} />
                            <YAxis stroke="#9ca3af" fontSize={12} />
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.95)', border: '1px solid #374151', borderRadius: '8px' }} />
                            <Bar dataKey="rows" fill="url(#blueGradient)" radius={[4, 4, 0, 0]} />
                            <defs>
                              <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#60a5fa" />
                                <stop offset="100%" stopColor="#2563eb" />
                              </linearGradient>
                            </defs>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  
                  {topMissingPairs.length > 0 && (
                    <div className="bg-gray-900/30 rounded-xl p-6 border border-gray-700/30">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="text-lg font-semibold text-gray-200">Co-occurring Missing Pairs</div>
                        <InfoTip text={t('infoMissingPairs')} />
                      </div>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={topMissingPairs}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="pair" stroke="#9ca3af" interval={0} angle={-25} textAnchor="end" height={80} fontSize={10}/>
                            <YAxis stroke="#9ca3af" fontSize={12} />
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.95)', border: '1px solid #374151', borderRadius: '8px' }} />
                            <Bar dataKey="corr" fill="url(#yellowGradient)" radius={[4, 4, 0, 0]}>
                              <LabelList dataKey="corr" position="top" formatter={(v: number)=>v.toFixed(2)} fontSize={10} />
                            </Bar>
                            <defs>
                              <linearGradient id="yellowGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#fbbf24" />
                                <stop offset="100%" stopColor="#d97706" />
                              </linearGradient>
                            </defs>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Categorical Associations (Cramér's V) */}
            {topCatAssoc.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-gradient-to-r from-green-500/20 to-emerald-600/20">
                    <Target className="w-5 h-5 text-green-400" />
                  </div>
                  <h4 className="text-xl font-semibold text-white">Categorical Associations (Cramér&apos;s V)</h4>
                  <InfoTip text={t('infoCramersV')} />
                </div>

                <div className="bg-gray-900/30 rounded-xl p-6 border border-gray-700/30">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topCatAssoc}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="pair" stroke="#9ca3af" interval={0} angle={-25} textAnchor="end" height={80} fontSize={11}/>
                        <YAxis stroke="#9ca3af" domain={[0,1]} fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.95)', border: '1px solid #374151', borderRadius: '8px' }} />
                        <Bar dataKey="v" fill="url(#greenGradient)" radius={[4, 4, 0, 0]}>
                          <LabelList dataKey="v" position="top" formatter={(v: number)=>v.toFixed(2)} fontSize={10} />
                        </Bar>
                        <defs>
                          <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#34d399" />
                            <stop offset="100%" stopColor="#059669" />
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CollapsibleCard>
      ) : null}

      {/* Feature–Target Association (open as before) */}
      {insightTarget && featureTargetAssocList.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-8 shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500/20 to-cyan-600/20">
              <Eye className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-2xl font-bold text-white">Feature–Target Association ({insightTarget})</h3>
          </div>
          
          <div className="bg-gray-900/30 rounded-xl p-6 border border-gray-700/30">
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={featureTargetAssocList}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="col" stroke="#9ca3af" interval={0} angle={-25} textAnchor="end" height={90} fontSize={11}/>
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.95)', border: '1px solid #374151', borderRadius: '8px' }}
                    formatter={(value: any, name: any, props: any) => [`${Number(value).toFixed(3)} (${props?.payload?.test})`, 'Association Score']} 
                  />
                  <Bar dataKey="score" fill="url(#cyanGradient)" radius={[4, 4, 0, 0]} />
                  <defs>
                    <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" />
                      <stop offset="100%" stopColor="#0891b2" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-lg border border-blue-500/20">
              <div className="flex items-center gap-2 text-sm text-blue-300">
                <Info className="w-4 h-4" />
                <span>Note: For exploration purposes only; modeling decision is made in the Training step.</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Continue Button (match MissingValuesStep) */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1 }}
        className="flex justify-center pt-8"
      >
        <motion.button
          onClick={handleContinue}
          className="px-8 py-3 bg-cyan-600 text-white rounded-lg hover:shadow-lg"
          whileHover={{ scale: 1.05 }}
        >
          {t('continue')} to {t('missingValues')}
        </motion.button>
      </motion.div>
    </motion.div>
  );
};

export default AnalysisStep;
