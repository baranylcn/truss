import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Play, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { modelApi, type OptimizeResponse } from '../../services/api/model'
import { Section, OptionCard } from './MissingValuesPanel'

interface Props { projectId: string; onApplied: () => void }

type Strategy = 'random' | 'grid' | 'bayesian'

const STRATEGIES: { value: Strategy; label: string; desc: string }[] = [
  { value: 'random',   label: 'Random Search',  desc: 'Samples random combinations — fast and effective.' },
  { value: 'grid',     label: 'Grid Search',     desc: 'Systematic sweep over defined ranges.' },
  { value: 'bayesian', label: 'Bayesian',        desc: 'Guided search using prior results.' },
]

const fmt  = (v: number) => `${(v * 100).toFixed(2)}%`
const fmtΔ = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`

export default function OptimizationPanel({ projectId }: Props) {
  const [strategy, setStrategy] = useState<Strategy>('random')
  const [maxTrials, setMaxTrials] = useState(20)
  const [result, setResult] = useState<OptimizeResponse | null>(null)

  const { data: evalData, isLoading: evalLoading } = useQuery({
    queryKey: ['evaluate', projectId],
    queryFn: () => modelApi.evaluate(projectId),
    enabled: !!projectId,
  })

  const { mutate: runOptimize, isPending } = useMutation({
    mutationFn: () =>
      modelApi.optimize(projectId, {
        strategy,
        n_trials: maxTrials,
        param_ranges: {},
        param_choices: {},
      }),
    onSuccess: setResult,
  })

  const improvement = result?.improvement ?? 0
  const ImprovementIcon = improvement > 0.001 ? TrendingUp : improvement < -0.001 ? TrendingDown : Minus
  const improvementColor = improvement > 0.001 ? '#22c55e' : improvement < -0.001 ? '#ef4444' : '#64748b'

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
                <span className="text-[11px] text-[#64748b]">Best model:</span>
                <span className="text-[11px] font-mono text-[#f97316] truncate">{evalData.best_model}</span>
                <span className="ml-auto text-[11px] font-mono text-[#22c55e]">
                  {fmt(evalData.accuracy)}
                </span>
              </div>
            )}

            {/* Strategy */}
            <Section label="Search Strategy">
              {STRATEGIES.map(s => (
                <OptionCard
                  key={s.value}
                  selected={strategy === s.value}
                  label={s.label}
                  desc={s.desc}
                  onClick={() => setStrategy(s.value)}
                />
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
                    { label: 'Δ',          value: fmtΔ(improvement),         color: improvementColor },
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
