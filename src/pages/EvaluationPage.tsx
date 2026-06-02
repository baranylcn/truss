import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { modelApi } from '../services/api/model'
import DataPreview from '../components/DataPreview'
import type { PipelineStep } from '../types'

interface EvaluationPageProps {
  projectId: string
  onNext: (step: PipelineStep) => void
}

export default function EvaluationPage({ projectId, onNext }: EvaluationPageProps) {
  const { data: evalData, isLoading } = useQuery({
    queryKey: ['evaluate', projectId],
    queryFn: () => modelApi.evaluate(projectId),
    enabled: !!projectId,
    // Retry a few times with backoff in case we arrive before the DB commit settles
    retry: 3,
    retryDelay: (attempt) => attempt * 800,
  })

  const fmt = (v: number) => `${(v * 100).toFixed(1)}%`
  const isRegression = evalData?.problem_type === 'regression'

  const metricCards = evalData ? [
    { label: isRegression ? 'R² Score' : 'Accuracy', value: fmt(evalData.accuracy), show: true },
    { label: 'Precision', value: evalData.precision != null ? fmt(evalData.precision) : '-', show: !isRegression },
    { label: 'Recall', value: evalData.recall != null ? fmt(evalData.recall) : '-', show: !isRegression },
    { label: 'F1-Score', value: evalData.f1_score != null ? fmt(evalData.f1_score) : '-', show: !isRegression },
    { label: 'Best Model', value: evalData.best_model ?? '-', show: true },
  ].filter(m => m.show) : []

  const featureImportance = evalData?.feature_importance
    ? Object.entries(evalData.feature_importance)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
    : null

  const confusionMatrix = evalData?.confusion_matrix
  const classNames = evalData?.class_names ?? []

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '64px' }}>
      <div className="p-6">
        <DataPreview projectId={projectId} />
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-[#64748b]">
            {evalData
              ? `${evalData.best_model} - ${evalData.problem_type} - target: ${evalData.target_column ?? '-'}`
              : isLoading ? 'Loading results…' : 'No models trained yet'}
          </p>
          {!isLoading && evalData && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-[#22c55e18] border border-[#22c55e40] rounded text-xs text-[#22c55e] font-semibold">
              <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
              Training Complete
            </span>
          )}
        </div>

        {/* Metric cards */}
        {isLoading ? (
          <div className="grid grid-cols-5 gap-3 mb-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-4">
                <div className="h-3 w-16 bg-[#1e2a3a] rounded animate-pulse mb-3" />
                <div className="h-6 w-12 bg-[#1e2a3a] rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <div className={`grid gap-3 mb-6`} style={{ gridTemplateColumns: `repeat(${metricCards.length}, 1fr)` }}>
            {metricCards.map(m => (
              <div key={m.label} className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-4">
                <p className="text-[10px] text-[#64748b] uppercase tracking-widest mb-2">{m.label}</p>
                <p className="text-xl font-semibold text-[#f1f5f9]">{m.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Regression metrics note */}
        {!isLoading && isRegression && evalData && (
          <div className="mb-5 px-4 py-3 bg-[#38bdf808] border border-[#38bdf830] rounded-lg">
            <p className="text-xs text-[#38bdf8]">
              Regression task - showing R², RMSE and MAE.
              Precision / Recall / F1 are classification metrics and do not apply here.
            </p>
            {evalData && (
              <div className="mt-2 flex gap-6">
                {(evalData as any).r2 != null && <span className="text-xs text-[#64748b]">R²: <span className="text-[#22c55e] font-mono">{((evalData as any).r2 * 100).toFixed(2)}%</span></span>}
                {(evalData as any).rmse != null && <span className="text-xs text-[#64748b]">RMSE: <span className="text-[#f97316] font-mono">{(evalData as any).rmse?.toFixed(4)}</span></span>}
                {(evalData as any).mae != null && <span className="text-xs text-[#64748b]">MAE: <span className="text-[#94a3b8] font-mono">{(evalData as any).mae?.toFixed(4)}</span></span>}
              </div>
            )}
          </div>
        )}

        {/* All trained models comparison */}
        {evalData?.results && evalData.results.length > 1 && (
          <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg overflow-hidden mb-5">
            <div className="px-5 py-3 border-b border-[#1e2a3a]">
              <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest">All Trained Models</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e2a3a] bg-[#0d1117]">
                    {['Model', 'Task', isRegression ? 'R² Score' : 'Accuracy', ...(!isRegression ? ['Precision', 'Recall', 'F1'] : ['RMSE', 'MAE'])].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {evalData.results.map(r => (
                    <tr key={r.model} className={`border-b border-[#1e2a3a] ${r.model === evalData.best_model ? 'bg-[#f9731608]' : ''}`}>
                      <td className="px-5 py-3 text-xs font-mono text-[#e2e8f0] flex items-center gap-2">
                        {r.model}
                        {r.model === evalData.best_model && <span className="text-[9px] px-1.5 py-0.5 bg-[#f97316] text-white rounded uppercase">Best</span>}
                      </td>
                      <td className="px-5 py-3 text-xs text-[#64748b]">{r.task_type}</td>
                      <td className="px-5 py-3 text-xs font-mono text-[#22c55e]">{fmt(r.metrics?.accuracy ?? 0)}</td>
                      {!isRegression ? (
                        <>
                          <td className="px-5 py-3 text-xs font-mono text-[#94a3b8]">{fmt(r.metrics?.precision ?? 0)}</td>
                          <td className="px-5 py-3 text-xs font-mono text-[#94a3b8]">{fmt(r.metrics?.recall ?? 0)}</td>
                          <td className="px-5 py-3 text-xs font-mono text-[#38bdf8]">{fmt(r.metrics?.f1_score ?? 0)}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-5 py-3 text-xs font-mono text-[#f97316]">{r.metrics?.rmse?.toFixed(4) ?? '-'}</td>
                          <td className="px-5 py-3 text-xs font-mono text-[#94a3b8]">{r.metrics?.mae?.toFixed(4) ?? '-'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-5">
          {/* Confusion Matrix - classification only */}
          <div className="col-span-1 bg-[#111827] border border-[#1e2a3a] rounded-lg p-5">
            <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest mb-3">Confusion Matrix</p>
            {isLoading ? (
              <div className="h-32 bg-[#1e2a3a] rounded animate-pulse" />
            ) : confusionMatrix ? (
              <>
                {classNames.length > 0 && (
                  <div className="flex justify-between mb-1 px-1">
                    {classNames.map(c => (
                      <span key={c} className="text-[9px] text-[#4a5568] truncate">{String(c).slice(0, 8)}</span>
                    ))}
                  </div>
                )}
                <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${confusionMatrix[0].length}, 1fr)` }}>
                  {confusionMatrix.flatMap((row, i) =>
                    row.map((val, j) => (
                      <div key={`${i}-${j}`}
                        className="p-2 rounded flex flex-col items-center justify-center border border-[#1e2a3a]"
                        style={{ backgroundColor: i === j ? '#22c55e18' : '#ef444418' }}>
                        <span className="text-sm font-bold" style={{ color: i === j ? '#22c55e' : '#f87171' }}>
                          {val.toLocaleString()}
                        </span>
                        <span className="text-[9px] text-[#4a5568] mt-0.5">
                          {i === j ? (classNames[i] ? `True ${String(classNames[i]).slice(0,4)}` : 'Correct') : 'Wrong'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-[#64748b]">Not available for regression tasks.</p>
            )}
          </div>

          {/* Feature Importance */}
          <div className="col-span-2 bg-[#111827] border border-[#1e2a3a] rounded-lg p-5">
            <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest mb-4">Feature Importance</p>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <div key={i} className="h-4 bg-[#1e2a3a] rounded animate-pulse" />)}
              </div>
            ) : featureImportance ? (
              <div className="space-y-2.5">
                {featureImportance.map(([feat, imp]) => {
                  const maxImp = featureImportance[0][1]
                  const pct = maxImp > 0 ? (imp / maxImp) * 100 : 0
                  return (
                    <div key={feat} className="flex items-center gap-3">
                      <span className="text-xs font-mono text-[#94a3b8] w-40 flex-shrink-0 truncate">{feat}</span>
                      <div className="flex-1 bg-[#1e2a3a] rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-[#f97316]" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-mono text-[#64748b] w-10 text-right">{(imp * 100).toFixed(1)}%</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-[#64748b]">Feature importance is available for tree-based models (Random Forest, XGBoost).</p>
            )}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 bg-[#111827] border-t border-white/[0.06] flex items-center justify-between px-6 z-10"
        style={{ left: '220px', right: 0, height: '56px' }}>
        <span className="text-sm text-white/40">
          {evalData ? `${evalData.trained_models?.length ?? 0} model(s) trained` : ''}
        </span>
        <div className="flex gap-3">
          <button className="px-4 py-1.5 text-sm text-[#94a3b8] hover:text-white">Cancel</button>
          <button onClick={() => onNext('optimization')}
            className="flex items-center gap-2 px-5 py-1.5 bg-[#f97316] hover:bg-[#ea6c0a] text-white text-sm font-semibold rounded">
            Save &amp; Continue <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
