import { useQuery } from '@tanstack/react-query'
import { modelApi } from '../../services/api/model'
import { StatCard, Section } from './MissingValuesPanel'

interface Props { projectId: string; onApplied: () => void }

const fmt = (v: number) => `${(v * 100).toFixed(1)}%`

export default function EvaluationPanel({ projectId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['evaluate', projectId],
    queryFn: () => modelApi.evaluate(projectId),
    enabled: !!projectId,
    retry: 3,
    retryDelay: (attempt) => attempt * 800,
  })

  const isRegression = data?.problem_type === 'regression'
  const featureImportance = data?.feature_importance
    ? Object.entries(data.feature_importance).sort((a, b) => b[1] - a[1]).slice(0, 8)
    : null
  const maxImp = featureImportance?.[0]?.[1] ?? 1

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-[#111827] border border-[#1e2a3a] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !data ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-xs text-[#64748b]">No models trained yet.</p>
            <p className="text-[11px] text-[#374151]">Complete the Training step first.</p>
          </div>
        ) : (
          <>
            {/* Status badge */}
            <div className="flex items-center gap-2 px-3 py-2 bg-[#22c55e12] border border-[#22c55e30] rounded-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
              <span className="text-xs text-[#22c55e] font-semibold">{data.best_model}</span>
              <span className="text-[10px] text-[#374151] ml-auto">{data.problem_type}</span>
            </div>

            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-2">
              <StatCard label={isRegression ? 'R² Score' : 'Accuracy'} value={fmt(data.accuracy)} />
              {!isRegression && data.f1_score != null && (
                <StatCard label="F1-Score" value={fmt(data.f1_score)} />
              )}
              {!isRegression && data.precision != null && (
                <StatCard label="Precision" value={fmt(data.precision)} />
              )}
              {!isRegression && data.recall != null && (
                <StatCard label="Recall" value={fmt(data.recall)} />
              )}
            </div>

            {/* Model comparison */}
            {data.results && data.results.length > 1 && (
              <Section label="All Models">
                <div className="flex flex-col gap-0.5">
                  {data.results.map(r => (
                    <div
                      key={r.model}
                      className={`flex items-center justify-between px-2.5 py-2 rounded border ${
                        r.model === data.best_model
                          ? 'border-[#f97316] bg-[#f9731608]'
                          : 'border-[#1e2a3a] bg-[#111827]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[11px] font-mono text-[#e2e8f0] truncate">{r.model}</span>
                        {r.model === data.best_model && (
                          <span className="text-[8px] px-1 py-0.5 bg-[#f97316] text-white rounded flex-shrink-0">BEST</span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-[#22c55e] flex-shrink-0 ml-2">
                        {fmt(r.metrics?.accuracy ?? 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Feature importance */}
            {featureImportance && featureImportance.length > 0 && (
              <Section label="Feature Importance">
                <div className="flex flex-col gap-2">
                  {featureImportance.map(([feat, imp]) => (
                    <div key={feat} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-[#94a3b8] w-24 flex-shrink-0 truncate" title={feat}>{feat}</span>
                      <div className="flex-1 h-1 bg-[#1e2a3a] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#f97316] rounded-full"
                          style={{ width: `${maxImp > 0 ? (imp / maxImp) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-[#64748b] w-8 text-right flex-shrink-0">
                        {(imp * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Confusion matrix (small) */}
            {data.confusion_matrix && !isRegression && (
              <Section label="Confusion Matrix">
                <div
                  className="grid gap-1"
                  style={{ gridTemplateColumns: `repeat(${data.confusion_matrix[0].length}, 1fr)` }}
                >
                  {data.confusion_matrix.flatMap((row, i) =>
                    row.map((val, j) => (
                      <div
                        key={`${i}-${j}`}
                        className="flex flex-col items-center justify-center p-2 rounded border text-center"
                        style={{
                          borderColor: i === j ? '#22c55e30' : '#ef444430',
                          backgroundColor: i === j ? '#22c55e08' : '#ef444408',
                        }}
                      >
                        <span className="text-xs font-bold" style={{ color: i === j ? '#22c55e' : '#f87171' }}>
                          {val.toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                {data.class_names && data.class_names.length > 0 && (
                  <p className="text-[9px] text-[#374151] mt-1 text-center">
                    Classes: {data.class_names.map(String).join(', ')}
                  </p>
                )}
              </Section>
            )}

            {isRegression && (data as any).rmse != null && (
              <Section label="Regression Metrics">
                <div className="flex flex-col gap-1">
                  {[['RMSE', (data as any).rmse?.toFixed(4)], ['MAE', (data as any).mae?.toFixed(4)]].filter(([, v]) => v != null).map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between px-2.5 py-2 bg-[#111827] border border-[#1e2a3a] rounded">
                      <span className="text-[11px] text-[#64748b]">{label}</span>
                      <span className="text-[11px] font-mono text-[#e2e8f0]">{value}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
