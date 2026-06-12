import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ChevronRight, ChevronDown, Play, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { modelApi, type OptimizeResponse } from '../services/api/model'
import type { PipelineStep } from '../types'

interface OptimizationPageProps {
  projectId: string
  onNext: (step: PipelineStep) => void
}

type Strategy = 'random' | 'grid' | 'bayesian'

interface NumericParam {
  kind: 'numeric'
  key: string
  label: string
  type: 'int' | 'float'
  defaultMin: number
  defaultMax: number
  absMin: number
  absMax: number
  step: number
}

interface CategoricalParam {
  kind: 'categorical'
  key: string
  label: string
  options: string[]
  defaultSelected: string[]
}

type HyperParam = NumericParam | CategoricalParam

const MODEL_PARAMS: Record<string, HyperParam[]> = {
  xgboost: [
    { kind: 'numeric', key: 'max_depth',        label: 'Max Depth',         type: 'int',   defaultMin: 3,    defaultMax: 10,  absMin: 1,     absMax: 20,   step: 1     },
    { kind: 'numeric', key: 'learning_rate',    label: 'Learning Rate',     type: 'float', defaultMin: 0.01, defaultMax: 0.3, absMin: 0.001, absMax: 1.0,  step: 0.001 },
    { kind: 'numeric', key: 'n_estimators',     label: 'N Estimators',      type: 'int',   defaultMin: 50,   defaultMax: 500, absMin: 10,    absMax: 1000, step: 10    },
    { kind: 'numeric', key: 'subsample',        label: 'Subsample',         type: 'float', defaultMin: 0.6,  defaultMax: 1.0, absMin: 0.1,   absMax: 1.0,  step: 0.05  },
    { kind: 'numeric', key: 'colsample_bytree', label: 'Col Sample / Tree', type: 'float', defaultMin: 0.6,  defaultMax: 1.0, absMin: 0.1,   absMax: 1.0,  step: 0.05  },
  ],
  random_forest: [
    { kind: 'numeric',      key: 'n_estimators',      label: 'N Estimators',      type: 'int', defaultMin: 50, defaultMax: 300, absMin: 10, absMax: 1000, step: 10 },
    { kind: 'numeric',      key: 'max_depth',         label: 'Max Depth',         type: 'int', defaultMin: 5,  defaultMax: 25,  absMin: 1,  absMax: 50,   step: 1  },
    { kind: 'numeric',      key: 'min_samples_split', label: 'Min Samples Split', type: 'int', defaultMin: 2,  defaultMax: 10,  absMin: 2,  absMax: 20,   step: 1  },
    { kind: 'numeric',      key: 'min_samples_leaf',  label: 'Min Samples Leaf',  type: 'int', defaultMin: 1,  defaultMax: 4,   absMin: 1,  absMax: 10,   step: 1  },
    { kind: 'categorical',  key: 'max_features',      label: 'Max Features',      options: ['sqrt', 'log2'], defaultSelected: ['sqrt', 'log2'] },
  ],
  logistic_regression: [
    { kind: 'numeric',     key: 'C',        label: 'Regularization (C)', type: 'float', defaultMin: 0.01, defaultMax: 10.0, absMin: 0.001, absMax: 100, step: 0.01 },
    { kind: 'numeric',     key: 'max_iter', label: 'Max Iterations',     type: 'int',   defaultMin: 100,  defaultMax: 2000, absMin: 100,   absMax: 5000, step: 100  },
    { kind: 'categorical', key: 'penalty',  label: 'Penalty',  options: ['l1', 'l2', 'elasticnet', 'none'], defaultSelected: ['l1', 'l2']                   },
    { kind: 'categorical', key: 'solver',   label: 'Solver',   options: ['lbfgs', 'liblinear', 'saga', 'sag'], defaultSelected: ['lbfgs', 'liblinear', 'saga'] },
  ],
  linear_regression: [],
}

const STRATEGIES: { value: Strategy; label: string; description: string }[] = [
  { value: 'random',   label: 'Random Search',         description: 'Samples random combinations - fast and effective' },
  { value: 'grid',     label: 'Grid Search',           description: 'Systematic sweep over the defined ranges' },
  { value: 'bayesian', label: 'Bayesian Optimization', description: 'Guided search using prior results' },
]

const fmt  = (v: number) => `${(v * 100).toFixed(2)}%`
const fmtΔ = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`

export default function OptimizationPage({ projectId, onNext }: OptimizationPageProps) {
  const [strategy, setStrategy]         = useState<Strategy>('random')
  const [maxTrials, setMaxTrials]       = useState(20)
  const [strategyOpen, setStrategyOpen] = useState(false)
  const [paramRanges, setParamRanges]   = useState<Record<string, [number, number]>>({})
  const [paramChoices, setParamChoices] = useState<Record<string, string[]>>({})
  const [result, setResult]             = useState<OptimizeResponse | null>(null)

  const { data: evalData, isLoading: evalLoading } = useQuery({
    queryKey: ['evaluate', projectId],
    queryFn: () => modelApi.evaluate(projectId),
    enabled: !!projectId,
  })

  const modelType = evalData?.best_model ?? ''
  const params    = MODEL_PARAMS[modelType] ?? []
  const numericParams     = params.filter((p): p is NumericParam     => p.kind === 'numeric')
  const categoricalParams = params.filter((p): p is CategoricalParam => p.kind === 'categorical')

  const getRange = (p: NumericParam): [number, number] =>
    paramRanges[p.key] ?? [p.defaultMin, p.defaultMax]

  const setMin = (p: NumericParam, val: number) =>
    setParamRanges(prev => ({ ...prev, [p.key]: [val, Math.max(val, getRange(p)[1])] }))

  const setMax = (p: NumericParam, val: number) =>
    setParamRanges(prev => ({ ...prev, [p.key]: [Math.min(getRange(p)[0], val), val] }))

  const getChoices = (p: CategoricalParam): string[] =>
    paramChoices[p.key] ?? p.defaultSelected

  const toggleChoice = (p: CategoricalParam, option: string) => {
    const current = getChoices(p)
    const next = current.includes(option)
      ? current.filter(v => v !== option)
      : [...current, option]
    if (next.length === 0) return   // at least 1 must remain selected
    setParamChoices(prev => ({ ...prev, [p.key]: next }))
  }

  const { mutate: runOptimize, isPending } = useMutation({
    mutationFn: () =>
      modelApi.optimize(projectId, {
        strategy,
        n_trials: maxTrials,
        param_ranges: Object.fromEntries(numericParams.map(p => [p.key, getRange(p)])),
        param_choices: Object.fromEntries(categoricalParams.map(p => [p.key, getChoices(p)])),
      }),
    onSuccess: setResult,
  })

  const improvement      = result?.improvement ?? 0
  const ImprovementIcon  = improvement > 0.001 ? TrendingUp : improvement < -0.001 ? TrendingDown : Minus
  const improvementColor = improvement > 0.001 ? '#22c55e'  : improvement < -0.001 ? '#ef4444'    : '#64748b'

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '64px' }}>
      <div className="p-6">
        <p className="text-sm text-[#64748b] mb-6">
          Fine-tune hyperparameters to improve model performance beyond the baseline.
        </p>

        <div className="grid grid-cols-2 gap-5">
          {/* ── Left: config + results ── */}
          <div className="space-y-4">

            {/* Strategy & trials */}
            <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-5">
              <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest mb-4">Optimization Strategy</p>

              <div className="relative mb-4">
                <button onClick={() => setStrategyOpen(v => !v)} disabled={isPending}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-[#1c2333] border border-[#2d3748] rounded text-sm text-[#e2e8f0] hover:border-[#374151] disabled:opacity-50"
                >
                  {STRATEGIES.find(s => s.value === strategy)?.label}
                  <ChevronDown size={14} className="text-[#64748b]" />
                </button>
                {strategyOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#1c2333] border border-[#2d3748] rounded shadow-xl z-20">
                    {STRATEGIES.map(s => (
                      <button key={s.value} onClick={() => { setStrategy(s.value); setStrategyOpen(false) }}
                        className={`w-full text-left px-3 py-2.5 hover:bg-[#f9731618] ${strategy === s.value ? 'bg-[#f9731610]' : ''}`}
                      >
                        <p className={`text-xs font-medium ${strategy === s.value ? 'text-[#f97316]' : 'text-[#94a3b8]'}`}>{s.label}</p>
                        <p className="text-[10px] text-[#4a5568] mt-0.5">{s.description}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest mb-2">Max Trials</p>
              <input type="number" value={maxTrials} min={5} max={100} disabled={isPending}
                onChange={e => setMaxTrials(Math.max(5, Math.min(100, parseInt(e.target.value) || 20)))}
                className="w-full px-3 py-2.5 bg-[#1c2333] border border-[#2d3748] rounded text-sm text-[#e2e8f0] focus:outline-none focus:border-[#f97316] mb-4 disabled:opacity-50"
              />

              <button onClick={() => runOptimize()} disabled={isPending || evalLoading || !evalData}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1c2333] border border-[#f97316] hover:bg-[#f9731618] text-[#f97316] text-sm font-semibold rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isPending
                  ? <><div className="w-3.5 h-3.5 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin" />Running {maxTrials} trials…</>
                  : <><Play size={13} />Run Optimization</>}
              </button>
            </div>

            {/* Search Ranges (numeric) */}
            {numericParams.length > 0 && (
              <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-5">
                <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest mb-4">
                  Numeric Ranges - <span className="text-[#f97316] normal-case font-normal">{modelType}</span>
                </p>
                <div className="space-y-3">
                  {numericParams.map(p => {
                    const [mn, mx] = getRange(p)
                    return (
                      <div key={p.key}>
                        <p className="text-xs text-[#94a3b8] mb-1.5">{p.label}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[10px] text-[#4a5568] mb-1">Min</p>
                            <input type="number" value={mn} min={p.absMin} max={mx} step={p.step}
                              disabled={isPending}
                              onChange={e => setMin(p, parseFloat(e.target.value) || p.absMin)}
                              className="w-full px-2.5 py-1.5 bg-[#1c2333] border border-[#2d3748] rounded text-xs text-[#e2e8f0] font-mono focus:outline-none focus:border-[#f97316] disabled:opacity-50"
                            />
                          </div>
                          <div>
                            <p className="text-[10px] text-[#4a5568] mb-1">Max</p>
                            <input type="number" value={mx} min={mn} max={p.absMax} step={p.step}
                              disabled={isPending}
                              onChange={e => setMax(p, parseFloat(e.target.value) || p.absMax)}
                              className="w-full px-2.5 py-1.5 bg-[#1c2333] border border-[#2d3748] rounded text-xs text-[#e2e8f0] font-mono focus:outline-none focus:border-[#f97316] disabled:opacity-50"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Categorical Choices */}
            {categoricalParams.length > 0 && (
              <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-5">
                <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest mb-4">
                  Categorical Options - <span className="text-[#f97316] normal-case font-normal">{modelType}</span>
                </p>
                <div className="space-y-4">
                  {categoricalParams.map(p => {
                    const selected = getChoices(p)
                    return (
                      <div key={p.key}>
                        <p className="text-xs text-[#94a3b8] mb-2">{p.label}</p>
                        <div className="flex flex-wrap gap-2">
                          {p.options.map(opt => {
                            const active = selected.includes(opt)
                            const isLast = active && selected.length === 1
                            return (
                              <button key={opt}
                                onClick={() => toggleChoice(p, opt)}
                                disabled={isPending || isLast}
                                title={isLast ? 'At least one option must remain selected' : undefined}
                                className={`px-3 py-1 rounded text-xs font-mono border transition-colors disabled:cursor-not-allowed ${
                                  active
                                    ? 'bg-[#f9731620] border-[#f97316] text-[#f97316]'
                                    : 'bg-[#1c2333] border-[#2d3748] text-[#64748b] hover:border-[#374151] hover:text-[#94a3b8]'
                                }`}
                              >
                                {opt}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Results panel */}
            {result && (
              <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-5">
                <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest mb-4">Optimization Results</p>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'Baseline',   value: fmt(result.baseline_score), color: '#94a3b8' },
                    { label: 'Best Found', value: fmt(result.best_score),     color: '#22c55e' },
                    { label: 'Δ',          value: fmtΔ(improvement), color: improvementColor, Icon: ImprovementIcon },
                  ].map(({ label, value, color, Icon }) => (
                    <div key={label} className="bg-[#1c2333] rounded-lg p-3 text-center">
                      <p className="text-[10px] text-[#64748b] mb-1">{label}</p>
                      <p className="text-sm font-bold flex items-center justify-center gap-1" style={{ color }}>
                        {Icon && <Icon size={12} />}{value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-4 text-[10px] text-[#4a5568] mb-4">
                  <span>Trials: <span className="text-[#64748b]">{result.trials_run}</span></span>
                  <span>Model: <span className="text-[#64748b]">{result.model_type}</span></span>
                  <span>Strategy: <span className="text-[#64748b]">{result.strategy}</span></span>
                </div>
                {Object.keys(result.best_params).length > 0 && (
                  <>
                    <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest mb-2">Best Parameters</p>
                    <div className="space-y-1.5">
                      {Object.entries(result.best_params).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between px-3 py-1.5 bg-[#1c2333] rounded">
                          <span className="text-xs text-[#94a3b8] font-mono">{k}</span>
                          <span className="text-xs text-[#f97316] font-mono font-semibold">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Right: current best + all models ── */}
          <div className="space-y-4">
            <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-5">
              <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest mb-4">Current Best Model</p>
              {evalLoading ? (
                <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-[#1e2a3a] rounded animate-pulse" />)}</div>
              ) : evalData ? (
                <div className="space-y-0">
                  {[
                    { label: 'Model',    value: evalData.best_model },
                    { label: 'Task',     value: evalData.problem_type },
                    { label: 'Target',   value: evalData.target_column },
                    { label: 'Accuracy', value: fmt(evalData.accuracy), accent: '#22c55e' },
                    ...(evalData.problem_type !== 'regression' ? [
                      { label: 'F1-Score',  value: evalData.f1_score  != null ? fmt(evalData.f1_score)  : '-', accent: '#38bdf8' },
                      { label: 'Precision', value: evalData.precision != null ? fmt(evalData.precision) : '-' },
                      { label: 'Recall',    value: evalData.recall    != null ? fmt(evalData.recall)    : '-' },
                    ] : []),
                  ].map(({ label, value, accent }) => (
                    <div key={label} className="flex items-center justify-between py-2 border-b border-[#1e2a3a] last:border-0">
                      <span className="text-xs text-[#64748b]">{label}</span>
                      <span className="text-xs font-mono" style={{ color: accent ?? '#e2e8f0' }}>{value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#64748b]">No trained models found. Complete the Training step first.</p>
              )}
            </div>

            {evalData?.results && evalData.results.length > 0 && (
              <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-5">
                <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest mb-3">All Trained Models</p>
                <div className="space-y-2">
                  {evalData.results.map(r => (
                    <div key={r.model}
                      className={`flex items-center justify-between px-3 py-2 rounded border ${r.model === evalData.best_model ? 'border-[#f97316] bg-[#f9731608]' : 'border-[#1e2a3a]'}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-[#e2e8f0]">{r.model}</span>
                        {r.model === evalData.best_model && <span className="text-[9px] px-1 py-0.5 bg-[#f97316] text-white rounded">BEST</span>}
                      </div>
                      <span className="text-xs font-mono text-[#22c55e]">{fmt(r.metrics?.accuracy ?? 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 bg-[#111827] border-t border-white/[0.06] flex items-center justify-between px-6 z-10"
        style={{ left: '220px', right: 0, height: '56px' }}>
        <span className="text-sm text-white/40">
          {result
            ? `Optimization complete - ${result.trials_run} trials`
            : evalData ? `Best: ${evalData.best_model} - ${fmt(evalData.accuracy)}` : ''}
        </span>
        <div className="flex gap-3">
          <button className="px-4 py-1.5 text-sm text-[#94a3b8] hover:text-white">Skip</button>
          <button onClick={() => onNext('export')} disabled={isPending}
            className="flex items-center gap-2 px-5 py-1.5 bg-[#f97316] hover:bg-[#ea6c0a] text-white text-sm font-semibold rounded disabled:opacity-50"
          >
            Finish Pipeline <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
