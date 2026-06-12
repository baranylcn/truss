import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Play, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { modelApi, type OptimizeResponse } from '../../services/api/model'
import { Section, OptionCard } from './MissingValuesPanel'

interface Props { projectId: string; onApplied: () => void }

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
    { kind: 'numeric', key: 'max_depth',        label: 'Max Depth',        type: 'int',   defaultMin: 3,    defaultMax: 10,  absMin: 1,     absMax: 20,   step: 1     },
    { kind: 'numeric', key: 'learning_rate',    label: 'Learning Rate',    type: 'float', defaultMin: 0.01, defaultMax: 0.3, absMin: 0.001, absMax: 1.0,  step: 0.001 },
    { kind: 'numeric', key: 'n_estimators',     label: 'N Estimators',     type: 'int',   defaultMin: 50,   defaultMax: 500, absMin: 10,    absMax: 1000, step: 10    },
    { kind: 'numeric', key: 'subsample',        label: 'Subsample',        type: 'float', defaultMin: 0.6,  defaultMax: 1.0, absMin: 0.1,   absMax: 1.0,  step: 0.05  },
    { kind: 'numeric', key: 'colsample_bytree', label: 'Col Sample/Tree',  type: 'float', defaultMin: 0.6,  defaultMax: 1.0, absMin: 0.1,   absMax: 1.0,  step: 0.05  },
  ],
  random_forest: [
    { kind: 'numeric',     key: 'n_estimators',      label: 'N Estimators',      type: 'int', defaultMin: 50, defaultMax: 300, absMin: 10, absMax: 1000, step: 10 },
    { kind: 'numeric',     key: 'max_depth',         label: 'Max Depth',         type: 'int', defaultMin: 5,  defaultMax: 25,  absMin: 1,  absMax: 50,   step: 1  },
    { kind: 'numeric',     key: 'min_samples_split', label: 'Min Samples Split', type: 'int', defaultMin: 2,  defaultMax: 10,  absMin: 2,  absMax: 20,   step: 1  },
    { kind: 'numeric',     key: 'min_samples_leaf',  label: 'Min Samples Leaf',  type: 'int', defaultMin: 1,  defaultMax: 4,   absMin: 1,  absMax: 10,   step: 1  },
    { kind: 'categorical', key: 'max_features', label: 'Max Features', options: ['sqrt', 'log2'], defaultSelected: ['sqrt', 'log2'] },
  ],
  logistic_regression: [
    { kind: 'numeric',     key: 'C',        label: 'Regularization (C)', type: 'float', defaultMin: 0.01, defaultMax: 10.0, absMin: 0.001, absMax: 100,  step: 0.01 },
    { kind: 'numeric',     key: 'max_iter', label: 'Max Iterations',     type: 'int',   defaultMin: 100,  defaultMax: 2000, absMin: 100,   absMax: 5000, step: 100  },
    { kind: 'categorical', key: 'penalty',  label: 'Penalty',  options: ['l1', 'l2', 'elasticnet', 'none'], defaultSelected: ['l1', 'l2']                    },
    { kind: 'categorical', key: 'solver',   label: 'Solver',   options: ['lbfgs', 'liblinear', 'saga', 'sag'], defaultSelected: ['lbfgs', 'liblinear', 'saga'] },
  ],
  linear_regression: [],
}

const STRATEGIES: { value: Strategy; label: string; desc: string }[] = [
  { value: 'random',   label: 'Random Search', desc: 'Samples random combinations - fast and effective.' },
  { value: 'grid',     label: 'Grid Search',   desc: 'Systematic sweep over defined ranges.' },
  { value: 'bayesian', label: 'Bayesian',      desc: 'Guided search using prior results.' },
]

const fmt  = (v: number) => `${(v * 100).toFixed(2)}%`
const fmtΔ = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`

export default function OptimizationPanel({ projectId }: Props) {
  const [strategy, setStrategy]     = useState<Strategy>('random')
  const [maxTrials, setMaxTrials]   = useState(20)
  const [paramRanges, setParamRanges]   = useState<Record<string, [number, number]>>({})
  const [paramChoices, setParamChoices] = useState<Record<string, string[]>>({})
  const [result, setResult] = useState<OptimizeResponse | null>(null)

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
    const next = current.includes(option) ? current.filter(v => v !== option) : [...current, option]
    if (next.length === 0) return
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

  const improvement     = result?.improvement ?? 0
  const ImprovementIcon = improvement > 0.001 ? TrendingUp : improvement < -0.001 ? TrendingDown : Minus
  const improvColor     = improvement > 0.001 ? '#22c55e' : improvement < -0.001 ? '#ef4444' : '#64748b'

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {!evalData && !evalLoading ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-xs text-[#64748b]">No trained models found.</p>
            <p className="text-[11px] text-[#374151]">Complete the Training step first.</p>
          </div>
        ) : (
          <>
            {/* Current best */}
            {evalData && (
              <div className="flex items-center gap-2 px-3 py-2 bg-[#111827] border border-[#1e2a3a] rounded-lg">
                <span className="text-[11px] text-[#64748b]">Best:</span>
                <span className="text-[11px] font-mono text-[#f97316] truncate">{evalData.best_model}</span>
                <span className="ml-auto text-[11px] font-mono text-[#22c55e] flex-shrink-0">{fmt(evalData.accuracy)}</span>
              </div>
            )}

            {/* Strategy */}
            <Section label="Search Strategy">
              {STRATEGIES.map(s => (
                <OptionCard key={s.value} selected={strategy === s.value} label={s.label} desc={s.desc} onClick={() => setStrategy(s.value)} />
              ))}
            </Section>

            {/* Max trials */}
            <div>
              <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-1.5">Max Trials</p>
              <input
                type="number"
                value={maxTrials}
                min={5}
                max={100}
                disabled={isPending}
                onChange={e => setMaxTrials(Math.max(5, Math.min(100, parseInt(e.target.value) || 20)))}
                className="w-full px-3 py-2 bg-[#111827] border border-[#1e2a3a] rounded-lg text-xs text-white font-mono outline-none focus:border-[#f97316] disabled:opacity-50"
              />
            </div>

            {/* Numeric ranges */}
            {numericParams.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-2">
                  Parameter Ranges
                  <span className="ml-1 normal-case font-normal text-[#374151]">({modelType})</span>
                </p>
                <div className="flex flex-col gap-3">
                  {numericParams.map(p => {
                    const [mn, mx] = getRange(p)
                    return (
                      <div key={p.key}>
                        <p className="text-[10px] text-[#94a3b8] mb-1">{p.label}</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <p className="text-[9px] text-[#4a5568] mb-0.5">Min</p>
                            <input
                              type="number"
                              value={mn}
                              min={p.absMin}
                              max={mx}
                              step={p.step}
                              disabled={isPending}
                              onChange={e => setMin(p, parseFloat(e.target.value) || p.absMin)}
                              className="w-full px-2 py-1.5 bg-[#111827] border border-[#1e2a3a] rounded text-[11px] text-white font-mono outline-none focus:border-[#f97316] disabled:opacity-50"
                            />
                          </div>
                          <div>
                            <p className="text-[9px] text-[#4a5568] mb-0.5">Max</p>
                            <input
                              type="number"
                              value={mx}
                              min={mn}
                              max={p.absMax}
                              step={p.step}
                              disabled={isPending}
                              onChange={e => setMax(p, parseFloat(e.target.value) || p.absMax)}
                              className="w-full px-2 py-1.5 bg-[#111827] border border-[#1e2a3a] rounded text-[11px] text-white font-mono outline-none focus:border-[#f97316] disabled:opacity-50"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Categorical choices */}
            {categoricalParams.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-2">Categorical Options</p>
                <div className="flex flex-col gap-3">
                  {categoricalParams.map(p => {
                    const selected = getChoices(p)
                    return (
                      <div key={p.key}>
                        <p className="text-[10px] text-[#94a3b8] mb-1.5">{p.label}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {p.options.map(opt => {
                            const active = selected.includes(opt)
                            const isLast = active && selected.length === 1
                            return (
                              <button
                                key={opt}
                                onClick={() => toggleChoice(p, opt)}
                                disabled={isPending || isLast}
                                title={isLast ? 'At least one option must remain selected' : undefined}
                                className={`px-2.5 py-1 rounded text-[10px] font-mono border transition-colors disabled:cursor-not-allowed ${
                                  active
                                    ? 'bg-[#f9731620] border-[#f97316] text-[#f97316]'
                                    : 'bg-[#111827] border-[#1e2a3a] text-[#64748b] hover:border-[#2d3748] hover:text-[#94a3b8]'
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

            {params.length === 0 && evalData && (
              <p className="text-[11px] text-[#4a5568] text-center py-2">
                No tunable parameters for {modelType}.
              </p>
            )}

            {/* Run button */}
            <button
              onClick={() => runOptimize()}
              disabled={isPending || evalLoading || !evalData}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#111827] hover:bg-[#1a2235] border border-[#1e2a3a] hover:border-[#f97316] text-[#f97316] text-xs font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending
                ? <><div className="w-3 h-3 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin" /> Running {maxTrials} trials…</>
                : <><Play size={13} /> Run Optimization</>
              }
            </button>

            {/* Results */}
            {result && (
              <Section label="Results">
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[
                    { label: 'Baseline',   value: fmt(result.baseline_score), color: '#94a3b8' },
                    { label: 'Best Found', value: fmt(result.best_score),     color: '#22c55e' },
                    { label: 'Δ',          value: fmtΔ(improvement),         color: improvColor },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-2.5 text-center">
                      <p className="text-[9px] text-[#4a5568] mb-1">{label}</p>
                      <p className="text-xs font-bold font-mono flex items-center justify-center gap-0.5" style={{ color }}>
                        {label === 'Δ' && <ImprovementIcon size={10} />}
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-[#374151] mb-2">
                  {result.trials_run} trials · {result.strategy} · {result.model_type}
                </p>
                {Object.keys(result.best_params).length > 0 && (
                  <div className="flex flex-col gap-1">
                    {Object.entries(result.best_params).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between px-2.5 py-1.5 bg-[#111827] border border-[#1e2a3a] rounded">
                        <span className="text-[10px] text-[#94a3b8] font-mono">{k}</span>
                        <span className="text-[10px] text-[#f97316] font-mono font-semibold">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
