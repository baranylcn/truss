import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { preprocessingApi } from '../services/api/preprocessing'
import type { PipelineStep } from '../types'

interface CorrelationPageProps {
  projectId: string
  onNext: (step: PipelineStep) => void
}

function corrColor(val: number): string {
  if (val >= 0.85) return '#92400e'
  if (val >= 0.7) return '#f9731650'
  if (val >= 0.5) return '#f9731630'
  if (val >= 0.3) return '#f9731618'
  if (val < 0) return '#37415180'
  return '#1f2937'
}

function corrTextColor(val: number): string {
  if (val >= 0.7) return '#f97316'
  if (val < 0) return '#6b7280'
  return '#64748b'
}

export default function CorrelationPage({ projectId, onNext }: CorrelationPageProps) {
  const qc = useQueryClient()
  const [threshold, setThreshold] = useState(0.85)
  const [dropped, setDropped] = useState<Set<string>>(new Set())

  const { data: corrData, isLoading, isError } = useQuery({
    queryKey: ['correlation', projectId],
    queryFn: () => preprocessingApi.correlation(projectId),
    enabled: !!projectId,
  })

  const features = corrData?.columns ?? []

  // Limit heatmap to first 10 columns for readability
  const displayFeatures = features.slice(0, 10)

  const corrMatrix = useMemo(() => {
    if (!corrData) return []
    return displayFeatures.map(row =>
      displayFeatures.map(col => corrData.correlation_matrix[row]?.[col] ?? 0)
    )
  }, [corrData, displayFeatures])

  const highCorrPairs = useMemo(() => {
    const pairs: { pair: string; corr: number; dropCol: string }[] = []
    for (let i = 0; i < displayFeatures.length; i++) {
      for (let j = i + 1; j < displayFeatures.length; j++) {
        const val = corrMatrix[i]?.[j] ?? 0
        if (Math.abs(val) >= threshold) {
          pairs.push({ pair: `${displayFeatures[i]} & ${displayFeatures[j]}`, corr: val, dropCol: displayFeatures[j] })
        }
      }
    }
    return pairs
  }, [corrMatrix, displayFeatures, threshold])

  // Collect the actual column names to drop from marked pairs
  const columnsToDrop = useMemo(() => {
    return [...dropped]
      .map(pairKey => highCorrPairs.find(p => p.pair === pairKey)?.dropCol)
      .filter((c): c is string => !!c)
  }, [dropped, highCorrPairs])

  const dropMutation = useMutation({
    mutationFn: () => preprocessingApi.dropColumns(projectId, columnsToDrop),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analyze', projectId] })
      qc.invalidateQueries({ queryKey: ['correlation', projectId] })
      toast.success(`Dropped ${columnsToDrop.length} column(s)`)
      onNext('scaling')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function handleSaveAndContinue() {
    if (columnsToDrop.length > 0) {
      dropMutation.mutate()
    } else {
      onNext('scaling')
    }
  }

  const toggleDrop = (pair: string) => {
    setDropped(prev => {
      const next = new Set(prev)
      next.has(pair) ? next.delete(pair) : next.add(pair)
      return next
    })
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '64px' }}>
      <div className="p-6">
        <div className="mb-6">
          <p className="text-sm text-[#64748b]">Identify and review highly correlated features to reduce multicollinearity.</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-4">
            <p className="text-[10px] text-[#64748b] uppercase tracking-widest mb-1">Numeric Columns</p>
            <p className="text-2xl font-bold text-white">{isLoading ? '-' : features.length}</p>
          </div>
          <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-4">
            <p className="text-[10px] text-[#64748b] uppercase tracking-widest mb-1">High Corr Pairs</p>
            <p className={`text-2xl font-bold ${highCorrPairs.length > 0 ? 'text-[#f87171]' : 'text-[#22c55e]'}`}>
              {isLoading ? '-' : highCorrPairs.length}
            </p>
          </div>
          <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-4">
            <p className="text-[10px] text-[#64748b] uppercase tracking-widest mb-1">Threshold</p>
            <div className="flex items-center gap-3 mt-1">
              <input type="range" min="0.5" max="1" step="0.05" value={threshold}
                onChange={e => setThreshold(parseFloat(e.target.value))} className="flex-1" />
              <span className="text-sm font-mono text-[#f97316] w-10">{threshold.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {isError && (
          <div className="mb-6 px-4 py-3 bg-[#ef444418] border border-[#ef4444] rounded-lg text-sm text-[#f87171]">
            Could not compute correlation. Make sure all columns are numeric (run Encoding step first if needed).
          </div>
        )}

        {!isError && (
          <div className="grid grid-cols-5 gap-5">
            {/* Heatmap */}
            <div className="col-span-3 bg-[#111827] border border-[#1e2a3a] rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest">Correlation Heatmap</p>
                {features.length > 10 && (
                  <span className="text-[10px] text-[#64748b]">Showing first 10 of {features.length} columns</span>
                )}
              </div>
              {isLoading ? (
                <div className="flex items-center justify-center h-48 text-sm text-[#64748b]">Computing correlation…</div>
              ) : displayFeatures.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-sm text-[#64748b]">No numeric columns to correlate.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="text-center" style={{ borderSpacing: '2px', borderCollapse: 'separate' }}>
                    <thead>
                      <tr>
                        <th className="w-24" />
                        {displayFeatures.map(f => (
                          <th key={f} className="pb-2 px-0.5">
                            <div className="text-[9px] text-[#4a5568] font-mono"
                              style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', height: 64, whiteSpace: 'nowrap', overflow: 'hidden', maxHeight: 64 }}>
                              {f.length > 12 ? f.slice(0, 12) + '…' : f}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayFeatures.map((rowF, i) => (
                        <tr key={rowF}>
                          <td className="text-[9px] text-[#4a5568] font-mono text-right pr-2 whitespace-nowrap max-w-[96px] overflow-hidden">
                            {rowF.length > 12 ? rowF.slice(0, 12) + '…' : rowF}
                          </td>
                          {corrMatrix[i]?.map((val, j) => (
                            <td key={j} className="p-0.5">
                              <div className="w-8 h-8 rounded flex items-center justify-center text-[9px] font-mono transition-colors"
                                style={{ backgroundColor: i === j ? '#1c2333' : corrColor(val), color: i === j ? '#374151' : corrTextColor(val) }}>
                                {val.toFixed(2)}
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* High Corr Pairs */}
            <div className="col-span-2 bg-[#111827] border border-[#1e2a3a] rounded-lg p-5">
              <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest mb-4">High Correlation Pairs</p>
              {isLoading ? (
                <p className="text-sm text-[#64748b]">Computing…</p>
              ) : highCorrPairs.length === 0 ? (
                <p className="text-sm text-[#22c55e]">No high correlation pairs above {threshold.toFixed(2)} threshold.</p>
              ) : (
                <div className="space-y-3">
                  {highCorrPairs.map(item => (
                    <div key={item.pair} className="bg-[#0d1117] border border-[#1e2a3a] rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-[#e2e8f0] truncate mr-2">{item.pair}</span>
                        <span className="text-sm font-bold text-[#f97316] flex-shrink-0">{item.corr.toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-[#1e2a3a] rounded-full h-1 mb-2">
                        <div className="h-1 rounded-full bg-[#f97316]" style={{ width: `${Math.abs(item.corr) * 100}%` }} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#64748b]">Suggest drop: {item.dropCol}</span>
                        <button onClick={() => toggleDrop(item.pair)}
                          className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-colors ${dropped.has(item.pair) ? 'bg-[#f9731620] text-[#f97316]' : 'text-[#64748b] hover:text-[#f97316] hover:bg-[#f9731610]'}`}>
                          <Trash2 size={10} />
                          {dropped.has(item.pair) ? 'Marked' : 'Mark'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 pt-4 border-t border-[#1e2a3a]">
                <p className="text-[10px] text-[#64748b] uppercase tracking-widest mb-2">Legend</p>
                <div className="space-y-1">
                  {[
                    { color: '#f97316', label: '>= 0.85 (Very High)' },
                    { color: '#f97316', label: '0.70–0.84 (High)', opacity: '60' },
                    { color: '#f97316', label: '0.50–0.69 (Moderate)', opacity: '30' },
                    { color: '#374151', label: 'Negative Correlation' },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: `${l.color}60` }} />
                      <span className="text-[10px] text-[#64748b]">{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 bg-[#111827] border-t border-white/[0.06] flex items-center justify-between px-6 z-10"
        style={{ left: '220px', right: 0, height: '56px' }}>
        <span className="text-sm text-white/40">
          {columnsToDrop.length > 0
            ? `${columnsToDrop.length} column(s) will be dropped: ${columnsToDrop.join(', ')}`
            : 'No columns marked for removal'}
        </span>
        <div className="flex gap-3">
          <button onClick={() => onNext('scaling')} className="px-4 py-1.5 text-sm text-[#64748b] hover:text-white">
            Skip Step
          </button>
          <button
            onClick={handleSaveAndContinue}
            disabled={dropMutation.isPending}
            className="flex items-center gap-2 px-5 py-1.5 bg-[#f97316] hover:bg-[#ea6c0a] disabled:opacity-50 text-white text-sm font-semibold rounded">
            {dropMutation.isPending ? 'Dropping…' : 'Save & Continue'}
            {!dropMutation.isPending && <ChevronRight size={15} />}
          </button>
        </div>
      </div>
    </div>
  )
}
