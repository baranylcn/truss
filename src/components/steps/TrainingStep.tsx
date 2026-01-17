import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { DataTable } from '../DataTable';
import { useLanguage } from '../../hooks/useLanguage';
import { ProcessedData } from '../../services/localDataProcessor';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';

interface TrainingStepProps {
  processedData: ProcessedData | null;
  onDataUpdate: (data: ProcessedData) => void;
  onStepComplete: (stepId: number, result?: any) => void;
  stepResults: Record<number, any>;
  sessionId: string | null;
}

export const TrainingStep: React.FC<TrainingStepProps> = ({
  processedData,
  onDataUpdate,
  onStepComplete,
  stepResults,
  sessionId
}) => {
  const { t } = useLanguage();

  const [targetColumn, setTargetColumn] = useState('');
  const [problemType, setProblemType] = useState<'classification' | 'regression' | 'clustering'>('classification');
  const [selectedModels, setSelectedModels] = useState<string[]>(['LogisticRegression', 'RandomForestClassifier']);
  const [validationMethod, setValidationMethod] = useState<'train_test' | 'cross_validation'>('train_test');
  const [testSize, setTestSize] = useState(0.2);
  const [cvFolds, setCvFolds] = useState(5);
  const [isTraining, setIsTraining] = useState(false);

  const STEP_ID = 8;

  useEffect(() => {
    if (problemType === 'clustering' && targetColumn) setTargetColumn('');
  }, [problemType]); // eslint-disable-line

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

  // --- MODEL KATALOGLARI ---
  const classificationModels = [
    'LogisticRegression',
    'RandomForestClassifier',
    'DecisionTreeClassifier',
    'KNeighborsClassifier',
    'SVC',
    // Yeni
    'XGBClassifier',
    'LGBMClassifier',
    'CatBoostClassifier',
    'GaussianNB',
    'MultinomialNB',
    'ExtraTreesClassifier',
  ];

  const regressionModels = [
    'LinearRegression',
    'RandomForestRegressor',
    'DecisionTreeRegressor',
    'KNeighborsRegressor',
    'SVR',
    // Yeni
    'XGBRegressor',
    'LGBMRegressor',
    'CatBoostRegressor',
    'Ridge',
    'Lasso',
    'ElasticNet',
    'ExtraTreesRegressor',
  ];

  const clusteringModels = [
    'KMeans',
    'DBSCAN',
    'AgglomerativeClustering',
    // Yeni
    'GaussianMixture',
    'Birch',
    'MeanShift',
    'OPTICS',
  ];

  const getAvailableModels = () => {
    switch (problemType) {
      case 'classification': return classificationModels;
      case 'regression': return regressionModels;
      case 'clustering': return clusteringModels;
      default: return classificationModels;
    }
  };

  useEffect(() => {
    const avail = getAvailableModels();
    const stillValid = selectedModels.some(m => avail.includes(m));
    if (!stillValid) {
      const fallback = avail.slice(0, Math.min(2, avail.length));
      setSelectedModels(fallback.length ? fallback : avail);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemType]);

  const handleModelToggle = (model: string) => {
    setSelectedModels(prev =>
      prev.includes(model)
        ? prev.filter(m => m !== model)
        : [...prev, model]
    );
  };

  const handleTrain = async () => {
    if (!processedData) return;

    setIsTraining(true);
    try {
      const response = await apiService.trainModels({
        model_names: selectedModels,
        target_column: targetColumn,
        problem_type: problemType,
        validation_method: problemType === 'clustering' ? undefined : validationMethod,
        test_size: problemType === 'clustering' ? undefined : testSize,
        cv_folds: problemType === 'clustering' ? undefined : cvFolds
      });

      if (response.error) {
        toast.error(response.error);
        return;
      }

      if (response.data) {
        toast.success(response.data.message || t('trainingSuccess'));

        const trainingResults = {
          problemType: response.data.problem_type ?? problemType,
          targetColumn,
          selectedModels: response.data.trained_models ?? selectedModels,
          validationMethod: response.data.validation_method ?? validationMethod,
          testSize,
          cvFolds,
          dataShape: response.data.dataset_shape,
          trainingCompleted: true
        };

        onStepComplete(STEP_ID, trainingResults);
      }
    } catch (error) {
      console.error('Training error:', error);
      toast.error(t('failedToTrainModels'));
    } finally {
      setIsTraining(false);
    }
  };

  const availableModels = getAvailableModels();

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">{t('training')} {t('modelsPlural')}</h2>
        <p className="text-gray-400">{t('trainingSubtitle')}</p>
        <div className="text-xs text-gray-500 mt-1">{t('infoTrainingOverview')}</div>
      </div>

      {processedData && (
        <div className="mb-8">
          <DataTable
            title={t('dataPreview')}
            data={processedData.data}
            columns={processedData.columns}
            showAllRows
            stepId={STEP_ID}
            onDataUpdate={handlePreviewUpdate}
          />
        </div>
      )}

      {/* Problem Config */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">{t('problemConfiguration')}</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">{t('targetColumn')}</label>
            <select
              value={targetColumn}
              onChange={(e) => setTargetColumn(e.target.value)}
              disabled={problemType === 'clustering'}
              className={`w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-cyan-400 focus:outline-none
                ${problemType === 'clustering' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <option value="">{t('selectTargetColumn')}</option>
              {processedData?.columns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
            <div className="text-xs text-gray-400 mt-1">{t('infoTargetColumn')}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">{t('problemTypeLabel')}</label>
            <select
              value={problemType}
              onChange={(e) => setProblemType(e.target.value as any)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-cyan-400 focus:outline-none"
            >
              <option value="classification">{t('classification')}</option>
              <option value="regression">{t('regression')}</option>
              <option value="clustering">{t('clustering')}</option>
            </select>
            <div className="text-xs text-gray-400 mt-1">{t('infoProblemType')}</div>
          </div>
        </div>
      </div>

      {/* Model Selection */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-2">{t('modelSelection')}</h3>
        <div className="text-xs text-gray-400 mb-4">{t('infoModelSelection')}</div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableModels.map(model => (
            <div key={model} className="bg-gray-700 rounded-lg p-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedModels.includes(model)}
                  onChange={() => handleModelToggle(model)}
                  className="mr-3"
                />
                <span className="text-white">{model}</span>
              </label>
            </div>
          ))}
        </div>
        {selectedModels.length === 0 && (
          <div className="text-red-400 text-sm mt-2">{t('pleaseSelectAtLeastOneModel')}</div>
        )}
      </div>

      {/* Validation (clustering yok) */}
      {problemType !== 'clustering' && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-2">{t('validationSettings')}</h3>
          <div className="text-xs text-gray-400 mb-4">{t('infoValidationSettings')}</div>

          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{t('validationMethod')}</label>
              <select
                value={validationMethod}
                onChange={(e) => setValidationMethod(e.target.value as any)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-cyan-400 focus:outline-none"
              >
                <option value="train_test">{t('trainTestSplit')}</option>
                <option value="cross_validation">{t('crossValidation')}</option>
              </select>
            </div>

            {validationMethod === 'train_test' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t('testSize')}</label>
                <input
                  type="number"
                  value={testSize}
                  onChange={(e) => setTestSize(Number(e.target.value))}
                  step="0.05" min="0.1" max="0.5"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-cyan-400 focus:outline-none"
                />
                <div className="text-xs text-gray-400 mt-1">{t('infoTestSize')}</div>
              </div>
            )}

            {validationMethod === 'cross_validation' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t('cvFolds')}</label>
                <input
                  type="number"
                  value={cvFolds}
                  onChange={(e) => setCvFolds(Number(e.target.value))}
                  min="3" max="10"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-cyan-400 focus:outline-none"
                />
                <div className="text-xs text-gray-400 mt-1">{t('infoCvFolds')}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">{t('trainingSummary')}</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">{t('problemTypeLabel')}:</span><span className="text-white">{t(problemType)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">{t('targetColumn')}:</span><span className="text-white">{problemType === 'clustering' ? '—' : (targetColumn || t('none'))}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">{t('modelsSelected')}:</span><span className="text-white">{selectedModels.length}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">{t('validationMethod')}:</span><span className="text-white">{problemType === 'clustering' ? '—' : (validationMethod === 'train_test' ? t('trainTestSplit') : t('crossValidation'))}</span></div>
            </div>
          </div>
          <div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">{t('datasetShape')}:</span><span className="text-white">{processedData?.shape.join(' × ')}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">{t('features')}:</span><span className="text-white">{processedData ? processedData.shape[1] - (problemType !== 'clustering' && targetColumn ? 1 : 0) : 0}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">{t('samples')}:</span><span className="text-white">{processedData?.shape[0] || 0}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Train */}
      <div className="flex justify-center">
        <motion.button
          onClick={handleTrain}
          disabled={isTraining || selectedModels.length === 0 || (problemType !== 'clustering' && !targetColumn)}
          className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-green-500/25 transition-all duration-300 disabled:opacity-50"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {isTraining ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              {t('trainingInProgress')}
            </div>
          ) : (
            `${t('train')} ${selectedModels.length} ${selectedModels.length > 1 ? t('modelsPlural') : t('modelsSingular')}`
          )}
        </motion.button>
      </div>
    </motion.div>
  );
};
