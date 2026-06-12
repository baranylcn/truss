import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Layers } from 'lucide-react'
import toast from 'react-hot-toast'
import { preprocessingApi } from '../../services/api/preprocessing'

interface Props { projectId: string; onApplied: () => void }

export default function FeatureSelectionPanel({ projectId, onApplied }: Props) {
  const qc = useQueryClient()
  const [varianceThreshold, setVarianceThreshold] = useState(0.01)
  const [correlationThreshold, setCorrelationThreshold] = useState(0.95)
  const [selectedDrop, setSelectedDrop] = useState<Set<string>>(new Set())
  const [analyzed, setAnalyzed] = useState(false)

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['feature-selection', projectId, varianceThreshold, correlationThreshold],
    queryFn: () => preprocessingApi.featureSelection(projectId, varianceThreshold, correlationThreshold),
    enabled: false,
  })

  const dropMutation = useMutation({
    mutationFn: () => preprocessingApi.dropColumns(projectId, Array.from(selectedDrop)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analyze', projectId] })
      qc.invalidateQueries({ queryKey: ['pipeline-history', projectId] })
      toast.success(`${selectedDrop.size} column(s) dropped`)
      setSelectedDrop(new Set())
      setAnalyzed(false)
      onApplied()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleAnalyze = async () => {
    await refetch()
    setAnalyzed(true)
    if (data?.suggested_drop) {
      setSelectedDrop(new Set(data.suggested_drop))
    }
  }

  const toggleCol = (col: string) => {
    setSelectedDrop(prev => {
      const next = new Set(prev)
      next.has(col) ? next.delete(col) : next.add(col)
      return next
    })
  }

  const allSuggested = data ? [...new Set([...data.low_variance_cols, ...data.high_correlation_pairs.map(p => p.col_b)])] : []

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

        {/* Variance threshold */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest">Variance Threshold</p>
            <span className="text-xs font-mono text-[#f97316]">{varianceThreshold}</span>
          </div>
          <input
            type="number" step={0.001} min={0} max={1}
            value={varianceThreshold}
            onChange={e => setVarianceThreshold(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-[#111827] border border-[#1e2a3a] rounded-lg text-xs text-white font-mono outline-none focus:border-[#f97316]"
          />
          <p className="text-[10px] text-[#374151] mt-1">Columns with variance ≤ this value are flagged as low-information.</p>
        </div>

        {/* Correlation threshold */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest">Correlation Threshold</p>
            <span className="text-xs font-mono text-[#f97316]">{correlationThreshold}</span>
          </div>
          <input
            type="range" step={0.01} min={0.5} max={1}
            value={correlationThreshold}
            onChange={e => setCorrelationThreshold(parseFloat(e.target.value))}
            className="w-full accent-[#f97316]"
          />
          <div className="flex justify-between text-[9px] text-[#374151] mt-0.5">
            <span>0.50</span><span>1.00</span>
          </div>
          <p className="text-[10px] text-[#374151] mt-1">Column pairs with |r| ≥ this threshold are flagged as redundant.</p>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={isFetching}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#111827] hover:bg-[#1a2235] border border-[#1e2a3a] hover:border-[#2d3748] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-40"
        >
          {isFetching
            ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Analyzing…</>
            : <><Layers size={13} /> Analyze Features</>
          }
        </button>

        {analyzed && data && (
          <>
            {/* Low variance */}
            {data.low_variance_cols.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-2">
                  Low Variance <span className="normal-case font-normal text-[#374151]">({data.low_variance_cols.length})</span>
                </p>
                <div className="flex flex-col gap-1">
                  {data.low_variance_cols.map(col => (
                    <label key={col} className="flex items-center gap-2 px-2.5 py-1.5 bg-[#111827] border border-[#1e2a3a] rounded-lg cursor-pointer hover:border-[#2d3748]">
                      <input
                        type="checkbox"
                        checked={selectedDrop.has(col)}
                        onChange={() => toggleCol(col)}
                        className="accent-[#ef4444] w-3.5 h-3.5 flex-shrink-0"
                      />
                      <span className="text-[11px] font-mono text-[#94a3b8] flex-1 truncate">{col}</span>
                      <span className="text-[9px] text-[#ef4444] bg-[#ef444420] px-1.5 py-0.5 rounded">low var</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* High correlation pairs */}
            {data.high_correlation_pairs.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-2">
                  High Correlation <span className="normal-case font-normal text-[#374151]">({data.high_correlation_pairs.length} pairs)</span>
                </p>
                <div className="flex flex-col gap-1">
                  {data.high_correlation_pairs.map((pair, i) => (
                    <label key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-[#111827] border border-[#1e2a3a] rounded-lg cursor-pointer hover:border-[#2d3748]">
                      <input
                        type="checkbox"
                        checked={selectedDrop.has(pair.col_b)}
                        onChange={() => toggleCol(pair.col_b)}
                        className="accent-[#f97316] w-3.5 h-3.5 flex-shrink-0"
                      />
                      <span className="text-[11px] font-mono text-[#94a3b8] flex-1 truncate">
                        {pair.col_a} ↔ {pair.col_b}
                      </span>
                      <span className="text-[9px] font-mono text-[#f97316]">{pair.correlation}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {allSuggested.length === 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-[#22c55e10] border border-[#22c55e30] rounded-lg">
                <span className="text-[#22c55e] text-sm">✓</span>
                <p className="text-[11px] text-[#22c55e]">No redundant features detected with current thresholds.</p>
              </div>
            )}

            {selectedDrop.size > 0 && (
              <button
                onClick={() => dropMutation.mutate()}
                disabled={dropMutation.isPending}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#ef4444] hover:bg-[#dc2626] disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                {dropMutation.isPending
                  ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Dropping…</>
                  : `Drop ${selectedDrop.size} column(s)`
                }
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
