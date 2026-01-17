import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../../hooks/useLanguage';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';

interface OptimizationStepProps {
  processedData: any;
  onDataUpdate: (data: any) => void;
  onStepComplete: (stepId: number, result?: any) => void;
  stepResults: Record<string | number, any>;
  sessionId: string | null;
}

const STEP_ID = 12;

const SUPPORTED_MODELS = new Set([
  'RandomForestClassifier',
  'LogisticRegression',
  'KMeans',
  'DBSCAN',
  'AgglomerativeClustering',
]);

function primaryMetricName(problemType: string): 'accuracy' | 'r2' | 'silhouette_score' {
  if (problemType === 'regression') return 'r2';
  if (problemType === 'clustering') return 'silhouette_score';
  return 'accuracy';
}

function safeNumber(x: any): number | null {
  if (x == null) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

type OptResult = { bestScore: number | null; bestParams: Record<string, any> | null };

export const OptimizationStep: React.FC<OptimizationStepProps> = ({
  onStepComplete,
  stepResults
}) => {
  const { t } = useLanguage();

  const trainingLike = useMemo(() => {
    const vals = Object.values(stepResults || {});
    return vals.find(
      (v: any) =>
        v &&
        (Array.isArray(v?.selectedModels) ||
          Array.isArray(v?.trained_models) ||
          v?.trainingCompleted === true)
    );
  }, [stepResults]);

  const [evalFromSession, setEvalFromSession] = useState<any | null>(null);

  const evaluationLike = useMemo(() => {
    const vals = Object.values(stepResults || {});
    const found = vals.find((v: any) => v && Array.isArray(v?.results));
    return found || evalFromSession || null;
  }, [stepResults, evalFromSession]);

  const inferredProblemType: string =
    evaluationLike?.problemType || trainingLike?.problemType || 'classification';

  const candidateModels = useMemo(() => {
    const set = new Set<string>();
    if (evaluationLike?.results?.length) {
      evaluationLike.results.forEach((r: any) => {
        if (r?.model) set.add(String(r.model));
      });
    }
    const tr: any = trainingLike;
    if (tr?.selectedModels?.length) tr.selectedModels.forEach((m: any) => set.add(String(m)));
    if (tr?.trained_models?.length) tr.trained_models.forEach((m: any) => set.add(String(m)));
    return Array.from(set);
  }, [trainingLike, evaluationLike]);

  const [selectedModel, setSelectedModel] = useState<string>('');
  const [method, setMethod] = useState<'grid_search' | 'random_search'>('grid_search');
  const [cvFolds, setCvFolds] = useState<number>(5);
  const [nIterations, setNIterations] = useState<number>(20);

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optResults, setOptResults] = useState<Record<string, OptResult>>({});

  const [exportFormat, setExportFormat] = useState<'joblib' | 'pkl' | 'onnx'>('joblib');
  const [isExporting, setIsExporting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [helpTitle, setHelpTitle] = useState('');
  const [helpCode, setHelpCode] = useState('');

  useEffect(() => {
    if (!selectedModel && candidateModels.length > 0) {
      const supportedFirst = candidateModels.find((m) => SUPPORTED_MODELS.has(m));
      setSelectedModel(supportedFirst || candidateModels[0]);
    }
  }, [candidateModels, selectedModel]);

  const loadFromSession = async () => {
    try {
      const res = await apiService.evaluateModels();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.data) {
        setEvalFromSession({
          problemType: res.data.problem_type || inferredProblemType,
          bestModel: res.data.best_model,
          results: res.data.results || []
        });
        toast.success('Loaded evaluation results from session.');
      } else {
        toast('No evaluation results found in session.', { icon: 'ℹ️' });
      }
    } catch {
      toast.error('Failed to load evaluation results from session.');
    }
  };

  const runRef = useRef(0);

  const handleRun = async () => {
    if (!selectedModel) {
      toast('Please select a model to optimize.', { icon: 'ℹ️' });
      return;
    }

    const myId = runRef.current + 1;
    runRef.current = myId;

    const modelAtStart = selectedModel;

    setIsOptimizing(true);
    try {
      const resp = await apiService.optimizeModel({
        selected_model: modelAtStart,
        optimization_method: method,
        cv_folds: cvFolds,
        n_iterations: nIterations
      });

      if (myId !== runRef.current) return;

      if (resp.error) {
        toast.error(resp.error);
        return;
      }

      const data = (resp.data ?? {}) as {
        message?: string;
        best_params?: Record<string, any>;
        best_score?: number;
        model?: string;
      };

      const s = safeNumber(data.best_score);
      const p = data.best_params || null;

      setOptResults(prev => ({
        ...prev,
        [modelAtStart]: { bestScore: s, bestParams: p }
      }));

      toast.success(data.message || 'Optimization completed.');
    } catch {
      if (myId !== runRef.current) return;
      toast.error('An error occurred during optimization.');
    } finally {
      if (myId === runRef.current) setIsOptimizing(false);
    }
  };

  const handleContinue = () => {
    const current = optResults[selectedModel] || { bestScore: null, bestParams: null };
    onStepComplete(STEP_ID, {
      selectedModel,
      method,
      cvFolds,
      nIterations,
      bestParams: current.bestParams,
      bestScore: current.bestScore,
      problemType: inferredProblemType
    });
  };

  const metricKey = primaryMetricName(inferredProblemType);
  const isPercentMetric = metricKey === 'accuracy' || metricKey === 'silhouette_score';
  const formatScore = (v: number | null) => {
    if (v == null) return '—';
    return isPercentMetric ? `${(v * 100).toFixed(2)}%` : v.toFixed(4);
  };

  const baselineScore: number | null = useMemo(() => {
    if (!evaluationLike?.results || !selectedModel) return null;
    const match = evaluationLike.results.find((r: any) => r?.model === selectedModel);
    if (!match || !match.metrics) return null;
    return safeNumber(match.metrics[metricKey]);
  }, [evaluationLike, selectedModel, metricKey]);

  const currentOpt = optResults[selectedModel] || null;
  const shownBestScore = currentOpt?.bestScore ?? null;
  const shownBestParams = currentOpt?.bestParams ?? null;

  const improvementPercent: number | null = useMemo(() => {
    if (baselineScore == null || shownBestScore == null) return null;
    if (baselineScore === 0) return null;
    const delta = shownBestScore - baselineScore;
    return (delta / Math.abs(baselineScore)) * 100;
  }, [baselineScore, shownBestScore]);

  const noModels = candidateModels.length === 0;

  const usageSnippet = (fmt: 'joblib' | 'pkl' | 'onnx', filename: string) => {
    if (fmt === 'joblib') {
      return `# Install: pip install joblib
import joblib

model = joblib.load("${filename}")
# X: pandas DataFrame or 2D numpy array
y_pred = model.predict(X)
print(y_pred[:5])`;
    }
    if (fmt === 'pkl') {
      return `import pickle

with open("${filename}", "rb") as f:
    model = pickle.load(f)

y_pred = model.predict(X)
print(y_pred[:5])`;
    }
    return `# Install: pip install onnxruntime
import onnxruntime as ort
import numpy as np

sess = ort.InferenceSession("${filename}", providers=['CPUExecutionProvider'])
input_name = sess.get_inputs()[0].name

# X must be a NumPy float32 array of shape (n_samples, n_features)
pred = sess.run(None, {input_name: X.astype(np.float32)})[0]
print(pred[:5])`;
  };

  const handleExport = async () => {
    if (!selectedModel) {
      toast('Please select a model to export.', { icon: 'ℹ️' });
      return;
    }
    setIsExporting(true);
    try {
      const res = await apiService.exportModelFile({
        selected_model: selectedModel,
        model_name: selectedModel,
        format: exportFormat
      });

      if (res?.error) {
        toast.error(res.error);
        return;
      }

      let blob: Blob | null = null;
      let filename: string | undefined;

      if (res && res.data?.blob instanceof Blob) {
        blob = res.data.blob;
        filename = res.data.filename;
      }

      if (!blob) {
        toast.error('Export failed: Empty response.');
        return;
      }

      if (!filename) {
        filename = `model_${selectedModel}.${exportFormat === 'joblib' ? 'joblib' : exportFormat}`;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setHelpTitle(`How to use the exported ${exportFormat.toUpperCase()} model`);
      setHelpCode(usageSnippet(exportFormat, filename));
      setShowHelp(true);

      toast.success('Model exported.');
    } catch (e) {
      toast.error('Export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="text-center mb-2">
        <h2 className="text-2xl font-bold text-white mb-2">Hyperparameter Optimization</h2>
        <p className="text-gray-400">Run grid or random search and compare to your evaluation baseline.</p>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Model Selection</h3>
          {noModels && (
            <motion.button
              onClick={loadFromSession}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg"
              whileHover={{ scale: 1.04 }}
            >
              Load Results from Session
            </motion.button>
          )}
        </div>

        {noModels ? (
          <div className="p-4 rounded bg-yellow-900/20 border border-yellow-600/40 text-yellow-300">
            No model candidates found from Training/Evaluation results.
            Please complete Training and Evaluation steps first or load results from session.
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Select Model to Optimize</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                <option value="">Choose a model</option>
                {candidateModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              {selectedModel && !SUPPORTED_MODELS.has(selectedModel) && (
                <div className="text-xs text-yellow-400 mt-2">
                  Search space may not be defined on backend for this model.
                  (Currently supported: RandomForestClassifier, LogisticRegression, KMeans, DBSCAN, AgglomerativeClustering)
                </div>
              )}
              {selectedModel && (
                <div className="text-xs text-gray-400 mt-2">
                  Primary metric for comparison:{' '}
                  <span className="text-gray-200 font-medium">{primaryMetricName(inferredProblemType)}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Optimization Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as 'grid_search' | 'random_search')}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                <option value="grid_search">Grid Search</option>
                <option value="random_search">Random Search</option>
              </select>
              <div className="text-xs text-gray-400 mt-1">
                Grid: tries all param combinations • Random: tries {nIterations} random samples
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">CV Folds</label>
              <input
                type="number"
                value={cvFolds}
                onChange={(e) => setCvFolds(Math.max(2, Number(e.target.value)))}
                min={2}
                max={10}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
              <div className="text-xs text-gray-400 mt-1">
                For clustering, CV folds is ignored (internal metrics like silhouette are used).
              </div>
            </div>

            {method === 'random_search' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">N Iterations</label>
                <input
                  type="number"
                  value={nIterations}
                  onChange={(e) => setNIterations(Math.max(1, Number(e.target.value)))}
                  min={1}
                  max={200}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <motion.button
            onClick={handleRun}
            disabled={noModels || !selectedModel || isOptimizing}
            className="px-6 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300 disabled:opacity-50"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isOptimizing ? 'Optimizing…' : 'Run Optimization'}
          </motion.button>
        </div>
      </div>

      {(optResults[selectedModel]?.bestParams || optResults[selectedModel]?.bestScore !== null) && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Optimization Result</h3>

          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Model</div>
              <div className="text-white font-semibold break-all">{selectedModel || '—'}</div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Baseline Score ({primaryMetricName(inferredProblemType)})</div>
              <div className="text-blue-400 font-semibold">
                {formatScore(
                  (() => {
                    const match = evaluationLike?.results?.find((r: any) => r?.model === selectedModel);
                    const v = match?.metrics?.[primaryMetricName(inferredProblemType)];
                    return safeNumber(v);
                  })()
                )}
              </div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Best Score ({primaryMetricName(inferredProblemType)})</div>
              <div className="text-green-400 font-semibold">
                {formatScore(optResults[selectedModel]?.bestScore ?? null)}
              </div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Improvement vs Baseline</div>
              <div
                className={`${
                  (() => {
                    const base = (() => {
                      const match = evaluationLike?.results?.find((r: any) => r?.model === selectedModel);
                      const v = match?.metrics?.[primaryMetricName(inferredProblemType)];
                      return safeNumber(v);
                    })();
                    const best = optResults[selectedModel]?.bestScore ?? null;
                    if (base == null || best == null || base === 0) return false;
                    return ((best - base) / Math.abs(base)) * 100 >= 0;
                  })()
                    ? 'text-emerald-400'
                    : 'text-red-400'
                } font-semibold`}
              >
                {(() => {
                  const base = (() => {
                    const match = evaluationLike?.results?.find((r: any) => r?.model === selectedModel);
                    const v = match?.metrics?.[primaryMetricName(inferredProblemType)];
                    return safeNumber(v);
                  })();
                  const best = optResults[selectedModel]?.bestScore ?? null;
                  if (base == null || best == null || base === 0) return '—';
                  const deltaPct = ((best - base) / Math.abs(base)) * 100;
                  return `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(2)}%`;
                })()}
              </div>
            </div>
          </div>

          {optResults[selectedModel]?.bestParams && (
            <div className="mt-6">
              <div className="text-sm text-gray-300 mb-2">Best Params</div>
              <div className="bg-gray-900/60 border border-gray-700 rounded p-4 text-gray-200 text-sm overflow-x-auto">
                <pre className="whitespace-pre-wrap">
{JSON.stringify(optResults[selectedModel]?.bestParams, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Export optimized model */}
          <div className="mt-8">
            <h4 className="text-white font-medium mb-3">Export Optimized Model</h4>
            <div className="flex items-center gap-3">
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'joblib' | 'pkl' | 'onnx')}
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                <option value="joblib">joblib</option>
                <option value="pkl">pickle (.pkl)</option>
                <option value="onnx">ONNX</option>
              </select>

              <motion.button
                onClick={handleExport}
                disabled={!selectedModel || isExporting}
                className="px-5 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-lg disabled:opacity-50"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.98 }}
              >
                {isExporting ? 'Exporting…' : 'Download'}
              </motion.button>
            </div>
            <div className="text-xs text-gray-400 mt-2">
              The exported artifact includes the fitted model (and preprocessing if wrapped on backend).
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <motion.button
          onClick={handleContinue}
          className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-300"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Continue
        </motion.button>
      </div>

      {/* Help modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-2xl bg-gray-800 border border-gray-700 rounded-lg p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-semibold">{helpTitle}</h4>
              <button
                onClick={() => setShowHelp(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            <pre className="text-sm text-gray-200 bg-gray-900/60 border border-gray-700 rounded p-4 overflow-x-auto whitespace-pre-wrap">
{helpCode}
            </pre>
            <div className="mt-4 text-right">
              <motion.button
                onClick={() => setShowHelp(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg"
                whileHover={{ scale: 1.04 }}
              >
                Close
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};
