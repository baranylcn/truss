import { X, AlertTriangle, Maximize2, Code2, Cpu, GitMerge, BarChart2, TrendingUp } from 'lucide-react'
import MissingValuesPanel  from './panels/MissingValuesPanel'
import OutliersPanel       from './panels/OutliersPanel'
import EncodingPanel       from './panels/EncodingPanel'
import ScalingPanel        from './panels/ScalingPanel'
import TrainingPanel       from './panels/TrainingPanel'
import CorrelationPanel    from './panels/CorrelationPanel'
import EvaluationPanel     from './panels/EvaluationPanel'
import OptimizationPanel   from './panels/OptimizationPanel'
import type { PipelineStep } from '../types'

interface FreestyleDrawerProps {
  projectId: string
  step: PipelineStep
  onClose: () => void
  onApplied: () => void
  onOpenOverlay?: (overlayType: 'outliers' | 'correlation', data: unknown) => void
}

const STEP_META: Partial<Record<PipelineStep, { label: string; icon: React.ReactNode }>> = {
  'missing-values': { label: 'MISSING VALUES', icon: <AlertTriangle size={13} /> },
  'outliers':       { label: 'OUTLIERS',        icon: <Maximize2 size={13} /> },
  'encoding':       { label: 'ENCODING',        icon: <Code2 size={13} /> },
  'scaling':        { label: 'SCALING',         icon: <Maximize2 size={13} /> },
  'training':       { label: 'TRAINING',        icon: <Cpu size={13} /> },
  'correlation':    { label: 'CORRELATION',     icon: <GitMerge size={13} /> },
  'evaluation':     { label: 'EVALUATION',      icon: <BarChart2 size={13} /> },
  'optimization':   { label: 'OPTIMIZATION',    icon: <TrendingUp size={13} /> },
}

export default function FreestyleDrawer({ projectId, step, onClose, onApplied, onOpenOverlay }: FreestyleDrawerProps) {
  const meta = STEP_META[step]

  return (
    <div
      className="border-l border-[#1e2a3a] bg-[#0d1117] flex flex-col flex-shrink-0"
      style={{ width: '300px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2a3a] flex-shrink-0">
        <div className="flex items-center gap-2 text-[#94a3b8]">
          {meta?.icon}
          <span className="text-[10px] font-bold tracking-widest">{meta?.label ?? step.toUpperCase()}</span>
        </div>
        <button onClick={onClose} className="text-[#4a5568] hover:text-white p-0.5 transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Panel */}
      {step === 'missing-values' && <MissingValuesPanel projectId={projectId} onApplied={onApplied} />}
      {step === 'outliers'       && (
        <OutliersPanel
          projectId={projectId}
          onApplied={onApplied}
          onDetected={(results, totalRows) => onOpenOverlay?.('outliers', { results, totalRows })}
        />
      )}
      {step === 'encoding'       && <EncodingPanel      projectId={projectId} onApplied={onApplied} />}
      {step === 'scaling'        && <ScalingPanel       projectId={projectId} onApplied={onApplied} />}
      {step === 'training'       && <TrainingPanel      projectId={projectId} onApplied={onApplied} />}
      {step === 'correlation'  && (
        <CorrelationPanel
          projectId={projectId}
          onComputed={(matrix, columns) => onOpenOverlay?.('correlation', { matrix, columns })}
        />
      )}
      {step === 'evaluation'   && <EvaluationPanel   projectId={projectId} onApplied={onApplied} />}
      {step === 'optimization' && <OptimizationPanel projectId={projectId} onApplied={onApplied} />}
    </div>
  )
}
