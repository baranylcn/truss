// src/components/steps/EvaluationStep.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from '../../hooks/useLanguage';
import { ProcessedData } from '../../services/localDataProcessor';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';

interface EvaluationStepProps {
  processedData: ProcessedData | null;
  onDataUpdate: (data: ProcessedData) => void;
  onStepComplete: (stepId: number, result?: any) => void;
  stepResults: Record<number, any>;
  sessionId: string | null;
}

const STEP_ID = 9; // optimization'a geçerken bu id ile data veriyoruz

const LOWER_IS_BETTER = new Set([
  'log_loss', 'rmse', 'mae', 'mse',
  'davies_bouldin', 'noise_ratio', 'inertia'
]);

const NEUTRAL_METRICS = new Set([
  'n_clusters', 'min_cluster_size', 'max_cluster_size', 'avg_cluster_size'
]);

const CLUSTERING_MODELS = new Set(['KMeans', 'DBSCAN', 'AgglomerativeClustering']);

/** Basit hover tooltip "i" bileşeni */
const InfoBubble: React.FC<{ text: string; className?: string }> = ({ text, className }) => (
  <span className={`ml-2 relative inline-flex items-center group ${className || ''}`}>
    <span
      className="w-4 h-4 inline-flex items-center justify-center rounded-full bg-gray-600 text-white text-[11px] font-bold cursor-help select-none"
      aria-label={text}
      role="img"
    >
      i
    </span>
    <span
      className="absolute z-20 hidden group-hover:block left-5 -top-1 w-72 max-w-[18rem] bg-gray-900 text-gray-200 text-xs leading-relaxed p-2 rounded-md border border-gray-700 shadow-2xl"
      style={{ pointerEvents: 'none' }}
    >
      {text}
    </span>
  </span>
);

/** Metrik adı → açıklama anahtarı (i18n) */
const metricDescKey = (metricKey: string) => `metric_${metricKey}_desc`;

export const EvaluationStep: React.FC<EvaluationStepProps> = ({
  processedData,
  onDataUpdate,
  onStepComplete,
  stepResults,
  sessionId
}) => {
  const { t } = useLanguage();
  const [evaluationResults, setEvaluationResults] = useState<any>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Export UI
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportModelName, setExportModelName] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<'joblib' | 'pkl' | 'onnx'>('joblib');
  const [isExporting, setIsExporting] = useState(false);

  // How-to modal (model-aware)
  const [showHowto, setShowHowto] = useState<{
    open: boolean;
    format: 'joblib' | 'pkl' | 'onnx';
    filename: string;
    modelName: string;
    problemType?: string;
  } | null>(null);

  const trainingResults = stepResults[8]; // Training adımı id=8

  useEffect(() => {
    if (trainingResults) {
      performEvaluation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingResults]);

  const performEvaluation = async () => {
    setIsEvaluating(true);
    try {
      const response = await apiService.evaluateModels();
      if (response.error) {
        toast.error(response.error);
        return;
      }
      if (response.data) {
        setEvaluationResults(response.data);
        toast.success(t('evaluationCompleted') || 'Model evaluation completed');
      }
    } catch (error) {
      console.error('Evaluation error:', error);
      toast.error(t('evaluationFailed') || 'Failed to evaluate models');
    } finally {
      setIsEvaluating(false);
    }
  };

  const problemType: string | undefined = evaluationResults?.problem_type ?? evaluationResults?.problemType;
  const backendBest: string | undefined = evaluationResults?.best_model ?? evaluationResults?.bestModel;

  const primaryMetricKey = useMemo(() => {
    if (problemType === 'classification') return 'accuracy';
    if (problemType === 'regression') return 'r2';
    if (problemType === 'clustering') return 'silhouette_score';
    return 'accuracy';
  }, [problemType]);

  const chartData = useMemo(() => {
    const res = evaluationResults?.results ?? [];
    return res.map((r: any) => {
      const metrics = r.metrics || {};
      let score = metrics[primaryMetricKey];
      if (typeof score !== 'number') {
        const firstNumeric = Object.values(metrics).find(v => typeof v === 'number') as number | undefined;
        score = typeof firstNumeric === 'number' ? firstNumeric : 0;
      }
      return {
        model: String(r.model).replace(/([A-Z])/g, ' $1').trim(),
        score
      };
    });
  }, [evaluationResults, primaryMetricKey]);

  const computedBestModel = useMemo(() => {
    if (!chartData.length) return undefined;
    const best = chartData.reduce((a, b) => (b.score > a.score ? b : a));
    return best.model;
  }, [chartData]);

  const bestModel = backendBest || computedBestModel;

  useEffect(() => {
    // Export modalı açıldığında default model olarak best'i seç
    if (showExportModal) {
      const models = (evaluationResults?.results || []).map((r: any) => r.model);
      setExportModelName(bestModel || models[0] || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showExportModal]);

  const getMetricColor = (metric: string, val: any) => {
    const value = typeof val === 'number' ? val : NaN;
    if (!Number.isFinite(value)) return 'text-gray-300';
    if (NEUTRAL_METRICS.has(metric)) return 'text-gray-300';

    // yüksek iyi
    if (!LOWER_IS_BETTER.has(metric)) {
      return value >= 0.8 ? 'text-green-400' : value >= 0.6 ? 'text-yellow-400' : 'text-red-400';
    }

    // düşük iyi
    if (metric === 'davies_bouldin') {
      return value < 0.8 ? 'text-green-400' : value < 1.5 ? 'text-yellow-400' : 'text-red-400';
    }
    if (metric === 'noise_ratio') {
      return value < 0.05 ? 'text-green-400' : value < 0.15 ? 'text-yellow-400' : 'text-red-400';
    }
    return value < 0.1 ? 'text-green-400' : value < 0.3 ? 'text-yellow-400' : 'text-red-400';
  };

  const formatMetricValue = (value: any, metric: string) => {
    if (value == null || (typeof value === 'number' && !Number.isFinite(value))) return '—';
    if (typeof value !== 'number') return String(value);
    return value.toFixed(4);
  };

  const handleContinue = () => {
    onStepComplete(STEP_ID, evaluationResults);
  };

  // --- How-to snippet üreticisi (model-aware) ---
  const buildHowto = (fmt: 'joblib'|'pkl'|'onnx', modelName: string, pType: string | undefined, filename: string) => {
    const isClustering = pType === 'clustering' || CLUSTERING_MODELS.has(modelName);

    if (fmt === 'onnx') {
      // Pratikte KMeans ile daha uyumlu; diğerleri çoğunlukla desteklenmez.
      return `# install
pip install onnxruntime

# run
import onnxruntime as ort
import numpy as np

sess = ort.InferenceSession("${filename}", providers=["CPUExecutionProvider"])
input_name = sess.get_inputs()[0].name

# X must be float32 numpy array, same feature order & count as training
y_pred = sess.run(None, {input_name: X.astype(np.float32)})[0]

# NOTE: ONNX export is reliably supported for some estimators (e.g., KMeans).
# For DBSCAN/Agglomerative, export may fail or not provide 'predict' semantics.`;
    }

    if (fmt === 'joblib' || fmt === 'pkl') {
      const loader = fmt === 'joblib'
        ? `# install\npip install joblib scikit-learn\n\n# load\nimport joblib\nmodel = joblib.load("${filename}")`
        : `# load\nimport pickle\nwith open("${filename}", "rb") as f:\n    model = pickle.load(f)`;

      if (!isClustering) {
        // supervised
        return `${loader}

# predict
# X: numpy array or pandas DataFrame with same columns order used in training
y_pred = model.predict(X)
print(y_pred[:5])`;
      }

      // --- clustering modelleri ---
      if (modelName === 'KMeans') {
        // KMeans: predict var
        return `${loader}

# cluster labels for new data
y_pred = model.predict(X_new)
print(y_pred[:5])

# training labels (for the training data used to fit)
# (only available if you kept them; otherwise not part of the artifact)
# For KMeans you can also inspect model.cluster_centers_.`;
      }

      // DBSCAN / AgglomerativeClustering: predict yok
      return `${loader}

# NOTE: ${modelName} does not implement .predict for new samples.
# For the training data used during fit, cluster labels are stored as:
y_train_clusters = getattr(model, "labels_", None)
print(y_train_clusters[:10] if y_train_clusters is not None else None)

# If you need to assign clusters to NEW samples, train a small classifier
# (e.g., KNN) on (X_train, model.labels_) and use it to predict on X_new:
# ----- example -----
from sklearn.neighbors import KNeighborsClassifier
knn = KNeighborsClassifier(n_neighbors=5)
knn.fit(X_train, model.labels_)  # X_train: same features used to fit the clustering model
y_new = knn.predict(X_new)
print(y_new[:5])`;
    }

    return '';
  };

  const handleExport = async () => {
    if (!exportModelName) {
      toast(t('pleaseSelectModel') || 'Select a model please.', { icon: 'ℹ️' });
      return;
    }
    setIsExporting(true);
    try {
      const res = await apiService.exportModel({
        selected_model: exportModelName,
        model_name: exportModelName,
        format: exportFormat
      });

      if (res.error) {
        toast.error(res.error);
        return;
      }

      const blob = res.data?.blob;
      const filename = res.data?.filename;

      if (!blob) {
        toast.error(t('exportFailedEmpty') || 'Export failed: empty response.');
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `model.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success(t('modelDownloaded') || 'Model downloaded.');

      // Model + problemType bilgisi ile how-to aç
      setShowHowto({
        open: true,
        format: exportFormat,
        filename: filename || `model.${exportFormat}`,
        modelName: exportModelName,
        problemType
      });
    } catch (e) {
      console.error('Export error:', e);
      toast.error(t('exportFailed') || 'Export sırasında hata oluştu.');
    } finally {
      setIsExporting(false);
      setShowExportModal(false);
    }
  };

  if (!trainingResults) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400">
          {t('noTrainingResults') || 'No training results found. Please complete the training step first.'}
        </div>
      </div>
    );
  }

  if (isEvaluating) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center gap-2 text-cyan-400">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-400"></div>
          {t('evaluatingModels') || 'Evaluating models...'}
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">
          {t('evaluation')} {t('results') || 'Results'}
          <InfoBubble text={t('infoEvaluationOverview') || 'Compare models using key metrics. Hover any (i) to learn more.'} />
        </h2>
        <p className="text-gray-400">{t('evaluationSubtitle') || 'Analyze model performance metrics'}</p>
      </div>

      {/* Summary */}
      {evaluationResults && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            {t('evaluationSummary') || 'Evaluation Summary'}
            <InfoBubble text={t('infoEvaluationSummary') || 'A quick snapshot of trained models, best pick and detected problem type.'} />
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-cyan-400">
                {(evaluationResults.results || []).length}
              </div>
              <div className="text-gray-400">
                {t('modelsTrained') || 'Models Trained'}
                <InfoBubble text={t('infoModelsTrained') || 'Total number of models successfully evaluated.'} />
              </div>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-400">
                {bestModel || '—'}
              </div>
              <div className="text-gray-400">
                {t('bestModel') || 'Best Model'}
                <InfoBubble text={t('infoBestModel') || 'Model with the best primary metric at this step.'} />
              </div>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-400">
                {problemType || '—'}
              </div>
              <div className="text-gray-400">
                {t('problemTypeLabel') || 'Problem Type'}
                <InfoBubble text={t('infoProblemTypeEval') || 'Detected or selected learning task (classification, regression, clustering).'} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Performance Chart */}
      {evaluationResults && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            {t('modelPerformanceComparison') || 'Model Performance Comparison'}
            <InfoBubble text={t('infoPerformanceChart') || 'Bar chart comparing the primary metric across trained models.'} />
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="model" stroke="#9ca3af" angle={-45} textAnchor="end" height={80} />
                <YAxis stroke="#9ca3af" />
                <ReTooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="score" fill="#06b6d4" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-xs text-gray-400 mt-2 flex items-center">
            <span className="mr-1">{t('primaryMetric') || 'Primary metric'}:</span>
            <span className="text-gray-200 font-medium">{primaryMetricKey}</span>
            <InfoBubble text={t('infoPrimaryMetric') || 'Main metric used to sort and select the best model for this problem type.'} />
          </div>
        </div>
      )}

      {/* Detailed Results */}
      {evaluationResults && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">
              {t('detailedMetrics') || 'Detailed Metrics'}
              <InfoBubble text={t('infoDetailedMetrics') || 'All reported metrics per model. Colors: green ≈ good, yellow ≈ okay, red ≈ poor.'} />
            </h3>
            <button
              onClick={() => setShowExportModal(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500"
            >
              {t('exportModel') || 'Export Model'}
            </button>
          </div>

          <div className="space-y-4">
            {(evaluationResults.results || []).map((result: any, index: number) => {
              const metricsObj = result.metrics || {};
              const metricEntries = Object.entries(metricsObj);
              const errorMsg = result.error;

              return (
                <div key={index} className="bg-gray-700 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-3">
                    {result.model}
                    <InfoBubble text={t('infoRowModelMetrics') || 'Metrics computed for this specific model.'} />
                  </h4>

                  {errorMsg && (
                    <div className="mb-3 text-sm text-yellow-300">
                      ⚠️ {errorMsg}
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {metricEntries.map(([metric, value]: [string, any]) => {
                      const metricKey = metric as string;
                      const color = getMetricColor(metricKey, value);
                      const prettyName = metricKey.replace(/_/g, ' ');
                      const desc = t(metricDescKey(metricKey)); // i18n’den kısa tanım
                      return (
                        <div key={metricKey} className="text-center">
                          <div className={`text-lg font-bold ${color}`}>
                            {formatMetricValue(value, metricKey)}
                          </div>
                          <div className="text-gray-400 text-sm capitalize flex items-center justify-center">
                            <span>{prettyName}</span>
                            <InfoBubble text={desc || t('infoMetricFallback') || 'Metric explanation unavailable.'} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Best Model Highlight */}
      {evaluationResults && (
        <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-400 mb-4">
            🏆 {t('bestPerformingModel') || 'Best Performing Model'}: {bestModel || '—'}
            <InfoBubble text={t('infoBestHighlight') || 'The model that performs best according to the primary metric.'} />
          </h3>
          <div className="text-gray-300">
            {t('bestModelNarrative') ||
              `Based on the evaluation metrics, ${bestModel ?? 'the selected model'} shows the best performance for this ${problemType ?? 'task'}. You can proceed to optimization or export the model.`}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-center gap-3">
        <motion.button
          onClick={handleContinue}
          className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-300"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={!evaluationResults}
        >
          {t('continue')} {t('to') || 'to'} {t('optimization')}
        </motion.button>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-xl text-white font-semibold mb-4">
              {t('exportModel') || 'Export Model'}
              <InfoBubble text={t('infoExportOverview') || 'Download the trained model artifact to use in your apps.'} />
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  {t('model')} <InfoBubble text={t('infoExportSelectModel') || 'Choose which trained model to export.'} />
                </label>
                <select
                  value={exportModelName}
                  onChange={(e) => setExportModelName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  {(evaluationResults?.results || []).map((r: any) => (
                    <option key={r.model} value={r.model}>{r.model}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  {t('format') || 'Format'} <InfoBubble text={t('infoExportFormat') || 'Pick a serialization format. ONNX may fail for some estimators.'} />
                </label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as any)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="joblib">joblib</option>
                  <option value="pkl">pickle (.pkl)</option>
                  <option value="onnx">ONNX</option>
                </select>
                <div className="text-xs text-gray-400 mt-1">
                  {t('exportOnnxNote') || 'ONNX bazı modeller için başarısız olabilir. Hata alırsanız joblib/pkl deneyin.'}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500"
              >
                {t('cancel') || 'Cancel'}
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting || !exportModelName}
                className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50"
              >
                {isExporting ? (t('exporting') || 'Exporting…') : (t('export') || 'Export')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* How-to Modal (model-aware) */}
      {showHowto?.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-2xl">
            <h3 className="text-xl text-white font-semibold mb-4">
              {t('howToUseExported') || 'How to use the exported model'}
              <InfoBubble text={t('infoHowto') || 'Copy & paste into your environment. Make sure feature order matches training.'} />
            </h3>
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 overflow-auto">
              <pre className="text-sm text-gray-200 whitespace-pre-wrap">
{buildHowto(showHowto.format, showHowto.modelName, showHowto.problemType, showHowto.filename)}
              </pre>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowHowto(null)}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500"
              >
                {t('gotIt') || 'Got it'}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
