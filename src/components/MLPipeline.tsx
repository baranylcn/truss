import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react'; // CheckCircle kaldırıldı
import { apiService } from '../services/api';
import { StepIndicator } from './StepIndicator';
import { FileUpload } from './FileUpload';
import { DataTable } from './DataTable';
import { Logo } from './Logo';
import { LanguageSelector } from './LanguageSelector';
import { AnalysisStep } from './steps/AnalysisStep';
import { MissingValuesStep } from './steps/MissingValuesStep';
import { OutlierHandlingStep } from './steps/OutlierHandlingStep';
import { EncodingStep } from './steps/EncodingStep';
import { CorrelationStep } from './steps/CorrelationStep';
import { ScalingStep } from './steps/ScalingStep';
import { TrainingStep } from './steps/TrainingStep';
import { EvaluationStep } from './steps/EvaluationStep';
import { OptimizationStep } from './steps/OptimizationStep';
import { useLanguage } from '../hooks/useLanguage';
import { MLStep } from '../types';
import toast, { Toaster } from 'react-hot-toast';

interface ProcessedData {
  data: any[][];
  columns: string[];
  shape: [number, number];
  dtypes: Record<string, string>;
  missingValues?: Record<string, number>;
}

interface MLPipelineProps {
  onBack: () => void;
  initialSessionData?: any;
  onSessionUpdate?: (data: any) => void;
}

export const MLPipeline: React.FC<MLPipelineProps> = ({
  onBack,
  initialSessionData,
  onSessionUpdate
}) => {
  const { t } = useLanguage();

  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [currentData, setCurrentData] = useState<any[][]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stepResults, setStepResults] = useState<Record<number, any>>({});
  const [sessionId, setSessionId] = useState<string>('');
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [missingValues, setMissingValues] = useState<Record<string, number>>({});

  // TargetCorrelation kaldırıldı -> toplam adım sayısı 10
  const steps: MLStep[] = [
    { id: 1,  name: t('upload'),           completed: false, active: true  },
    { id: 2,  name: t('analyze'),          completed: false, active: false },
    { id: 3,  name: t('missingValues'),    completed: false, active: false },
    { id: 4,  name: t('Outliers'),  completed: false, active: false },
    { id: 5,  name: t('encoding'),         completed: false, active: false },
    { id: 6,  name: t('correlation'),      completed: false, active: false },
    { id: 7,  name: t('scaling'),          completed: false, active: false },
    { id: 8,  name: t('training'),         completed: false, active: false },
    { id: 9,  name: t('evaluation'),       completed: false, active: false },
    { id: 10, name: t('optimization'),     completed: false, active: false },
  ];
  const [mlSteps, setMlSteps] = useState(steps);

  useEffect(() => {
    if (initialSessionData) {
      setCurrentStep(initialSessionData.currentStep || 1);
      setCurrentData(initialSessionData.currentData || []);
      setColumns(initialSessionData.columns || []);
      setAnalysisResults(initialSessionData.analysisResults || null);
      setStepResults(initialSessionData.stepResults || {});
      setUploadedFile(initialSessionData.uploadedFile || null);
      setSessionId(initialSessionData.sessionId || '');
      updateSteps(initialSessionData.currentStep || 1);
    }
  }, [initialSessionData]);

  useEffect(() => {
    if (onSessionUpdate && (currentStep > 1 || sessionId)) {
      onSessionUpdate({
        currentStep,
        currentData,
        columns,
        analysisResults,
        stepResults,
        uploadedFile,
        sessionId
      });
    }
  }, [currentStep, analysisResults, stepResults, uploadedFile, sessionId]);

  const updateSteps = (stepId: number, completed: boolean = false) => {
    setMlSteps(prev =>
      prev.map(s => ({
        ...s,
        active: s.id === stepId,
        completed: s.id < stepId || (s.id === stepId && completed)
      }))
    );
  };

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file);
    setIsProcessing(true);
    try {
      const res = await apiService.uploadDataset(file);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.data) {
        setColumns(res.data.columns);
        setCurrentData(res.data.data);
        setMissingValues(res.data.missing_values);
        setSessionId(res.data.session_id);
        updateSteps(1, true);
        setCurrentStep(2);
        updateSteps(2);
        toast.success('File uploaded successfully!');
      }
    } catch {
      toast.error('Failed to upload file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStepComplete = (stepId: number, result?: any) => {
    if (result) {
      setStepResults(prev => ({ ...prev, [stepId]: result }));
    }
    updateSteps(stepId, true);
    if (stepId < mlSteps.length) {
      const next = stepId + 1;
      setCurrentStep(next);
      updateSteps(next);
    }
  };

  const handleDataUpdate = (newData: any) => {
    if (newData.columns) setColumns(newData.columns);
    if (newData.data) setCurrentData(newData.data);
    if (newData.missingValues) setMissingValues(newData.missingValues);
  };

  const handleStepClick = (stepId: number) => {
    if (stepId <= currentStep || mlSteps[stepId - 1]?.completed) {
      setCurrentStep(stepId);
      updateSteps(stepId);
    }
  };

  const renderStepContent = () => {
    const processedData: ProcessedData = {
      data: currentData,
      columns,
      shape: [currentData.length, columns.length],
      dtypes: {},
      missingValues
    };
    const commonProps = {
      processedData,
      onDataUpdate: handleDataUpdate,
      onStepComplete: handleStepComplete,
      stepResults,
      sessionId
    };

    switch (currentStep) {
      case 1:
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">
                {t('upload')} {t('dataPreview')}
              </h2>
              <p className="text-gray-400">
                Start by uploading your CSV or Excel file
              </p>
            </div>

            {/* Backend Processing paneli kaldırıldı */}

            <FileUpload
              onFileUpload={handleFileUpload}
              uploadedFile={uploadedFile}
              onRemoveFile={() => {
                setUploadedFile(null);
                setCurrentData([]);
                setColumns([]);
                setStepResults({});
                setSessionId('');
                setCurrentStep(1);
                updateSteps(1);
              }}
            />

            {isProcessing && (
              <div className="text-center">
                <div className="inline-flex items-center gap-2 text-cyan-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-400" />
                  Processing file...
                </div>
              </div>
            )}

            {currentData.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-white mb-4">
                  {t('dataPreview')}
                </h3>
                <DataTable
                title={t('dataPreview')}
                data={currentData}
                columns={columns}
                showAllRows={true}
                stepId={currentStep}
                onDataUpdate={handleDataUpdate}
              />
              </div>
            )}
          </motion.div>
        );

      case 2:
        return <AnalysisStep {...commonProps} />;
      case 3:
        return <MissingValuesStep {...commonProps} />;
      case 4:
        return <OutlierHandlingStep {...commonProps} />;
      case 5:
        return <EncodingStep {...commonProps} />;
      case 6:
        return <CorrelationStep {...commonProps} />; // TargetCorrelation kaldırıldı
      case 7:
        return <ScalingStep {...commonProps} />;
      case 8:
        return <TrainingStep {...commonProps} />;
      case 9:
        return <EvaluationStep {...commonProps} />;
      case 10:
        return <OptimizationStep {...commonProps} />;
      default:
        return (
          <div className="text-center text-white">
            Unknown step {currentStep}
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <Toaster position="top-right" />
      <header className="flex justify-between items-center p-6 border-b border-gray-800">
        <motion.button
          onClick={onBack}
          className="p-2 text-gray-400 hover:text-white transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <ArrowLeft className="w-6 h-6" />
        </motion.button>
        <div className="flex items-center gap-3">
          <Logo className="w-8 h-8" />
          <span className="text-xl font-bold text-white">GroveML</span>
        </div>
        <LanguageSelector />
      </header>
      <main className="container mx-auto px-6 py-8 max-h-screen overflow-y-auto">
        <StepIndicator steps={mlSteps} onStepClick={handleStepClick} />
        <div className="max-w-6xl mx-auto">
          <AnimatePresence mode="wait">{renderStepContent()}</AnimatePresence>
        </div>
      </main>
    </div>
  );
};
