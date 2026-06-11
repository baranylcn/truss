import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ShieldCheck, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { datasetApi } from '../../services/api/dataset'
import { modelApi } from '../../services/api/model'
import { Section } from './MissingValuesPanel'

interface Props { projectId: string; onApplied: () => void }

type ModelType = 'xgboost' | 'random_forest' | 'logistic_regression' | 'linear_regression'
type TaskType  = 'classification' | 'regression'

const MODELS: { value: ModelType; label: string }[] = [
  { value: 'xgboost',             label: 'XGBoost' },
  { value: 'random_forest',       label: 'Random Forest' },
  { value: 'logistic_regression', label: 'Logistic Regression' },
  { value: 'linear_regression',   label: 'Linear Regression' },
]

const fmt = (v: number) => `${(v * 100).toFixed(2)}%`

export default function CrossValidationPanel({ projectId }: Props) {
  const [model, setModel]       = useState<ModelType>('xgboost')
  const [target, setTarget]     = useState('')
  const [taskType, setTaskType] = useState<TaskType>('classification')
  const [nSplits, setNSplits]   = useState(5)
  const [colOpen, setColOpen]   = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['analyze', projectId],
    queryFn: () => datasetApi.analyze(projectId),
    enabled: !!projectId,
  })
  const columns = data?.dataset_info.columns ?? []

  useEffect(() => {
    if (target && columns.length > 0 && !columns.includes(target)) setTarget('')
  }, [columns, target])

  useEffect(() => {
    if (!colOpen) return
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) setColOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [colOpen])

  const lockedClass   = model === 'logistic_regression'
  const lockedReg     = model === 'linear_regression'
  const effectiveTask: TaskType = lockedClass ? 'classification' : lockedReg ? 'regression' : taskType

  const mutation = useMutation({
    mutationFn: () => modelApi.crossValidate(projectId, {
      model_type: model,
      target_column: target,
      n_splits: nSplits,
      task_type: effectiveTask,
    }),
    onError: (err: Error) => toast.error(err.message),
  })

  const result = mutation.data
  const metric = result ? (result.scoring === 'accuracy' ? 'Accuracy' : 'R²') : ''

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

        {/* Model */}
        <div>
          <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-1.5">Model</p>
          <select
            value={model}
            onChange={e => setModel(e.target.value as ModelType)}
            className="w-full px-3 py-2 bg-[#111827] border border-[#1e2a3a] rounded-lg text-xs text-white outline-none focus:border-[#f97316] appearance-none"
          >
            {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        {/* Target column */}
        <div>
          <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-1.5">Target Column</p>
          <div className="relative" ref={dropdownRef}>
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
                  <button key={col} onClick={() => { setTarget(col); setColOpen(false) }}
                    className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors ${target === col ? 'text-[#f97316]' : 'text-[#94a3b8] hover:text-white hover:bg-white/[0.04]'}`}>
                    {col}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Task type */}
        <div className="flex gap-1.5">
          {(['classification', 'regression'] as TaskType[]).map(t => (
            <button key={t} onClick={() => !lockedClass && !lockedReg && setTaskType(t)} disabled={lockedClass || lockedReg}
              className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-all ${effectiveTask === t ? 'border-[#f97316] bg-[#f9731608] text-white' : 'border-[#1e2a3a] text-[#4a5568]'} ${(lockedClass || lockedReg) ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {t === 'classification' ? 'Class.' : 'Regress.'}
            </button>
          ))}
        </div>

        {/* K folds */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest">Folds (K)</p>
            <span className="text-xs font-mono text-[#f97316]">{nSplits}</span>
          </div>
          <input type="range" min={2} max={10} value={nSplits} onChange={e => setNSplits(Number(e.target.value))} className="w-full accent-[#f97316]" />
          <div className="flex justify-between text-[9px] text-[#374151] mt-0.5"><span>2</span><span>10</span></div>
        </div>

        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !target}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#f97316] hover:bg-[#ea6c0a] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
        >
          {mutation.isPending
            ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Running CV…</>
            : <><ShieldCheck size={13} /> Run {nSplits}-Fold CV</>
          }
        </button>

        {/* Results */}
        {result && (
          <Section label={`${metric} per Fold`}>
            <div className="flex flex-col gap-1.5">
              {result.fold_scores.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-[#4a5568] w-10 flex-shrink-0">Fold {i + 1}</span>
                  <div className="flex-1 h-1.5 bg-[#1e2a3a] rounded-full overflow-hidden">
                    <div className="h-full bg-[#f97316] rounded-full" style={{ width: `${Math.max(0, Math.min(100, s * 100))}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-[#94a3b8] w-12 text-right flex-shrink-0">{fmt(s)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <div className="flex-1 text-center px-2 py-2 bg-[#111827] border border-[#1e2a3a] rounded-lg">
                <p className="text-[9px] text-[#4a5568] uppercase tracking-widest mb-1">Mean</p>
                <p className="text-sm font-bold text-[#22c55e]">{fmt(result.mean_score)}</p>
              </div>
              <div className="flex-1 text-center px-2 py-2 bg-[#111827] border border-[#1e2a3a] rounded-lg">
                <p className="text-[9px] text-[#4a5568] uppercase tracking-widest mb-1">Std Dev</p>
                <p className="text-sm font-bold text-white">±{fmt(result.std_score)}</p>
              </div>
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}
