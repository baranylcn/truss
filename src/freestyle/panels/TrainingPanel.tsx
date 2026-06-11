import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { datasetApi } from '../../services/api/dataset'
import { modelApi } from '../../services/api/model'
import { StatCard, PanelFooter } from './MissingValuesPanel'

interface Props { projectId: string; onApplied: () => void }

type ModelType = 'xgboost' | 'random_forest' | 'logistic_regression'
type TaskType  = 'classification' | 'regression'

const MODELS: { value: ModelType; label: string; desc: string }[] = [
  { value: 'xgboost',             label: 'XGBoost',              desc: 'Gradient boosting. Fast and accurate.' },
  { value: 'random_forest',       label: 'Random Forest',        desc: 'Ensemble of decision trees. Robust.' },
  { value: 'logistic_regression', label: 'Logistic Regression',  desc: 'Linear model. Classification only.' },
]

export default function TrainingPanel({ projectId, onApplied }: Props) {
  const qc = useQueryClient()
  const [model, setModel]       = useState<ModelType>('xgboost')
  const [target, setTarget]     = useState('')
  const [taskType, setTaskType] = useState<TaskType>('classification')
  const [testSize, setTestSize] = useState(20)
  const [colOpen, setColOpen]   = useState(false)

  const { data } = useQuery({
    queryKey: ['analyze', projectId],
    queryFn: () => datasetApi.analyze(projectId),
    enabled: !!projectId,
  })

  const columns = data?.dataset_info.columns ?? []
  const shape = data?.dataset_info.shape

  const lockedClassification = model === 'logistic_regression'
  const effectiveTaskType: TaskType = lockedClassification ? 'classification' : taskType

  const canTrain = !!target

  const trainMutation = useMutation({
    mutationFn: () => modelApi.train(projectId, {
      model_type: model,
      target_column: target,
      test_size: testSize / 100,
      task_type: effectiveTaskType,
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['analyze', projectId] })
      const m = res.metrics
      const summary = m.accuracy != null
        ? `Accuracy: ${(m.accuracy * 100).toFixed(1)}%`
        : m.r2 != null
        ? `R²: ${m.r2.toFixed(3)}`
        : 'Training complete'
      toast.success(summary)
      onApplied()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="ROWS"    value={shape ? shape[0].toLocaleString() : '-'} />
          <StatCard label="FEATURES" value={shape && target ? String(shape[1] - 1) : shape ? String(shape[1]) : '-'} />
        </div>

        {/* Model */}
        <div>
          <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-2">Model</p>
          <div className="flex flex-col gap-1.5">
            {MODELS.map(m => (
              <button
                key={m.value}
                onClick={() => setModel(m.value)}
                className={`text-left p-3 rounded-lg border transition-all duration-150 ${model === m.value ? 'border-[#f97316] bg-[#f9731608]' : 'border-[#1e2a3a] hover:border-[#2d3748]'}`}
              >
                <p className={`text-xs font-semibold mb-0.5 ${model === m.value ? 'text-white' : 'text-[#94a3b8]'}`}>{m.label}</p>
                <p className="text-[11px] text-[#4a5568] leading-relaxed">{m.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Target column */}
        <div>
          <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-1.5">Target Column</p>
          <div className="relative">
            <button
              onClick={() => setColOpen(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 bg-[#111827] border border-[#1e2a3a] hover:border-[#2d3748] rounded-lg text-xs transition-colors"
            >
              <span className={target ? 'text-white font-mono' : 'text-[#4a5568]'}>{target || 'Select target…'}</span>
              <ChevronDown size={12} className={`text-[#4a5568] transition-transform ${colOpen ? 'rotate-180' : ''}`} />
            </button>
            {colOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#111827] border border-[#1e2a3a] rounded-lg shadow-xl z-20 max-h-40 overflow-y-auto">
                {columns.map(col => (
                  <button
                    key={col}
                    onClick={() => { setTarget(col); setColOpen(false) }}
                    className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors ${target === col ? 'text-[#f97316] bg-[#f9731608]' : 'text-[#94a3b8] hover:text-white hover:bg-white/[0.04]'}`}
                  >
                    {col}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Task type */}
        <div>
          <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-1.5">Task Type</p>
          <div className="flex gap-1.5">
            {(['classification', 'regression'] as TaskType[]).map(t => (
              <button
                key={t}
                onClick={() => !lockedClassification && setTaskType(t)}
                disabled={lockedClassification}
                className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-all ${
                  effectiveTaskType === t
                    ? 'border-[#f97316] bg-[#f9731608] text-white'
                    : 'border-[#1e2a3a] text-[#4a5568]'
                } ${lockedClassification ? 'opacity-50 cursor-not-allowed' : 'hover:border-[#2d3748]'}`}
              >
                {t === 'classification' ? 'Class.' : 'Regress.'}
              </button>
            ))}
          </div>
          {lockedClassification && (
            <p className="text-[10px] text-[#4a5568] mt-1">Logistic Regression is classification-only.</p>
          )}
        </div>

        {/* Train/Test split */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest">Test Split</p>
            <span className="text-xs font-mono text-[#f97316]">{testSize}%</span>
          </div>
          <input
            type="range"
            min={10}
            max={40}
            value={testSize}
            onChange={e => setTestSize(Number(e.target.value))}
            className="w-full accent-[#f97316]"
          />
          <div className="flex justify-between text-[9px] text-[#374151] mt-0.5">
            <span>Train: {100 - testSize}%</span>
            <span>Test: {testSize}%</span>
          </div>
        </div>
      </div>

      <PanelFooter
        onApply={() => trainMutation.mutate()}
        pending={trainMutation.isPending}
        disabled={!canTrain}
        disabledHint={!canTrain ? 'Select a target column to train.' : undefined}
      />
    </div>
  )
}
