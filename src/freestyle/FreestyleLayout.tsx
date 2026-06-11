import { useState } from 'react'
import FreestyleTopBar from './FreestyleTopBar'
import FreestyleDataTable from './FreestyleDataTable'
import FreestyleDrawer from './FreestyleDrawer'
import FreestyleBottomBar from './FreestyleBottomBar'
import FreestyleUploadModal from './FreestyleUploadModal'
import ResultOverlay from './ResultOverlay'
import AnalyzeOverlay from './overlays/AnalyzeOverlay'
import OutliersOverlay from './overlays/OutliersOverlay'
import CorrelationOverlay from './overlays/CorrelationOverlay'
import type { AppPage, PipelineStep } from '../types'

interface FreestyleLayoutProps {
  projectId: string
  currentStep: PipelineStep
  onStepChange: (step: PipelineStep) => void
  onPageChange: (page: AppPage) => void
  onSwitchToGuided: () => void
  onNewProject: () => void
}

// Step kind system:
//   operation — drawer only, applies data changes (Missing Values, Encoding, Scaling, Training)
//   mixed     — drawer for settings, overlay for results (Outliers, Correlation)
//   view      — overlay only, top bar button (Analyze)

const DRAWER_STEPS = new Set<PipelineStep>(['missing-values', 'outliers', 'encoding', 'scaling', 'training', 'correlation', 'evaluation', 'optimization', 'export'])

const STEP_STATUS_TEXT: Partial<Record<PipelineStep, string>> = {
  'missing-values': 'Select a handling strategy and click Apply & Update Preview.',
  'outliers':       'Detect outliers to see results, then choose an action.',
  'encoding':       'Select columns to encode and choose a method.',
  'scaling':        'Select numeric columns and choose a scaler.',
  'training':       'Configure your model and start training.',
  'evaluation':     'Review model performance metrics.',
  'correlation':    'Select a method and compute the correlation matrix.',
  'evaluation':     'Review model performance metrics and feature importance.',
  'optimization':   'Run hyperparameter search to improve model performance.',
  'export':         'Download predictions CSV or the serialized model file.',
}

type OverlayState =
  | { type: 'analyze' }
  | { type: 'outliers'; results: Record<string, { count: number; values: number[]; method: string }>; totalRows: number }
  | { type: 'correlation'; matrix: Record<string, Record<string, number>>; columns: string[] }
  | null

export default function FreestyleLayout({
  projectId,
  currentStep,
  onStepChange,
  onPageChange,
  onSwitchToGuided,
  onNewProject,
}: FreestyleLayoutProps) {
  const [openDrawerStep, setOpenDrawerStep] = useState<PipelineStep | null>(null)
  const [completedSteps, setCompletedSteps] = useState<Set<PipelineStep>>(new Set())
  const [overlay, setOverlay] = useState<OverlayState>(null)

  const showUpload = currentStep === 'upload'

  const handleUploadDone = () => {
    onStepChange('missing-values')
  }

  const handleUploadCancel = () => {
    onSwitchToGuided()
    onPageChange('dashboard')
  }

  const handleStepSelect = (step: PipelineStep) => {
    onStepChange(step)
    if (DRAWER_STEPS.has(step)) {
      setOpenDrawerStep(step)
    } else {
      setOpenDrawerStep(null)
    }
  }

  const handleApplied = () => {
    if (openDrawerStep) {
      setCompletedSteps(prev => new Set(prev).add(openDrawerStep))
    }
  }

  const handleOpenOverlay = (overlayType: 'outliers' | 'correlation', data: unknown) => {
    if (overlayType === 'outliers') {
      const { results, totalRows } = data as { results: Record<string, { count: number; values: number[]; method: string }>; totalRows: number }
      setOverlay({ type: 'outliers', results, totalRows })
    } else if (overlayType === 'correlation') {
      const { matrix, columns } = data as { matrix: Record<string, Record<string, number>>; columns: string[] }
      setOverlay({ type: 'correlation', matrix, columns })
    }
  }

  const statusText = openDrawerStep
    ? (STEP_STATUS_TEXT[openDrawerStep] ?? '')
    : 'Select a pipeline step from the dropdown above to get started.'

  return (
    <div
      className="bg-[#0d1117]"
      style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}
    >
      {/* z-30 ensures the topbar + its dropdowns paint above the sticky table header (z-10) */}
      <div style={{ position: 'relative', zIndex: 30, flexShrink: 0 }}>
        <FreestyleTopBar
          projectId={projectId}
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepSelect={handleStepSelect}
          onPageChange={onPageChange}
          onNewProject={onNewProject}
          onAnalyze={() => setOverlay({ type: 'analyze' })}
        />
      </div>

      {/* Main area: table + optional right drawer + overlay */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative', zIndex: 0 }}>
        <FreestyleDataTable
          projectId={projectId}
          activeStep={openDrawerStep}
          onUploadRequest={() => onStepChange('upload')}
        />

        {openDrawerStep && DRAWER_STEPS.has(openDrawerStep) && (
          <FreestyleDrawer
            projectId={projectId}
            step={openDrawerStep}
            onClose={() => setOpenDrawerStep(null)}
            onApplied={handleApplied}
            onOpenOverlay={handleOpenOverlay}
          />
        )}

        {/* Overlay rendered inside the main area (inset-0 relative) */}
        {overlay?.type === 'analyze' && (
          <ResultOverlay title="Dataset Analysis" onClose={() => setOverlay(null)}>
            <AnalyzeOverlay projectId={projectId} />
          </ResultOverlay>
        )}

        {overlay?.type === 'outliers' && (
          <ResultOverlay title="Outlier Detection Results" onClose={() => setOverlay(null)}>
            <OutliersOverlay results={overlay.results} totalRows={overlay.totalRows} />
          </ResultOverlay>
        )}

        {overlay?.type === 'correlation' && (
          <ResultOverlay title="Correlation Matrix" onClose={() => setOverlay(null)}>
            <CorrelationOverlay matrix={overlay.matrix} columns={overlay.columns} />
          </ResultOverlay>
        )}
      </div>

      <FreestyleBottomBar
        statusText={statusText}
        onSwitchToGuided={onSwitchToGuided}
      />

      {/* Upload modal — shown until dataset is loaded */}
      {showUpload && (
        <FreestyleUploadModal
          projectId={projectId}
          onDone={handleUploadDone}
          onCancel={handleUploadCancel}
        />
      )}
    </div>
  )
}
