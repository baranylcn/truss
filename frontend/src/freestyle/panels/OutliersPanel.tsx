import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BarChart2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { datasetApi } from '../../services/api/dataset'
import { preprocessingApi } from '../../services/api/preprocessing'
import { Section, OptionCard, StatCard, PanelFooter } from './MissingValuesPanel'

interface OutlierResult { count: number; values: number[]; method: string }

interface Props {
  projectId: string
  onApplied: () => void
  onDetected?: (results: Record<string, OutlierResult>, totalRows: number) => void
}

type DetMethod   = 'iqr' | 'zscore'
type Action = 'clip' | 'drop' | 'none'

const ACTIONS: { value: Action; label: string; desc: string }[] = [
  { value: 'none', label: 'Skip',      desc: 'Do not modify the data.' },
  { value: 'clip', label: 'Clip',      desc: 'Cap values at detection boundary.' },
  { value: 'drop', label: 'Drop Rows', desc: 'Remove rows that contain outliers.' },
]

interface DetectedRow { col: string; count: number; pct: string }

export default function OutliersPanel({ projectId, onApplied, onDetected }: Props) {
  const qc = useQueryClient()
  const [method, setMethod]   = useState<DetMethod>('iqr')
  const [action, setAction]   = useState<Action>('none')
  const [threshold, setThreshold] = useState('')
  const [detected, setDetected] = useState<DetectedRow[] | null>(null)
  const [selectedCols, setSelectedCols] = useState<Set<string> | null>(null) // null = all

  const { data: analyzeData } = useQuery({
    queryKey: ['analyze', projectId],
    queryFn: () => datasetApi.analyze(projectId),
    enabled: !!projectId,
  })

  const numericCols = (analyzeData?.dataset_info.columns ?? []).filter(
    c => !(analyzeData?.dataset_info.categorical_columns ?? []).includes(c)
  )
  const totalOutliers = detected?.reduce((s, r) => s + r.count, 0) ?? 0
  const factor = threshold ? parseFloat(threshold) : undefined

  // Initialize selectedCols once we have column data
  const activeCols = selectedCols ?? new Set(numericCols)
  const allSelected = selectedCols === null || selectedCols.size === numericCols.length

  const toggleCol = (col: string) => {
    const next = new Set(activeCols)
    if (next.has(col)) { next.delete(col) } else { next.add(col) }
    setSelectedCols(next)
  }

  const resetCols = () => setSelectedCols(null)

  const colsParam = allSelected ? undefined : Array.from(activeCols)

  const detectMutation = useMutation({
    mutationFn: () => preprocessingApi.detectOutliers(projectId, { method, factor, columns: colsParam }),
    onSuccess: (res) => {
      const rows = Object.entries(res.outlier_results)
        .filter(([, v]) => v.count > 0)
        .map(([col, v]) => ({
          col,
          count: v.count,
          pct: analyzeData ? ((v.count / analyzeData.dataset_info.shape[0]) * 100).toFixed(1) + '%' : '-',
        }))
      setDetected(rows)
      if (rows.length === 0) {
        toast.success('No outliers detected')
      } else {
        toast.success(`${rows.length} column(s) have outliers`)
        if (onDetected && analyzeData) {
          onDetected(res.outlier_results, analyzeData.dataset_info.shape[0])
        }
      }
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const applyMutation = useMutation({
    mutationFn: () => preprocessingApi.outliers(projectId, { method, action, factor, columns: colsParam }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analyze', projectId] })
      qc.invalidateQueries({ queryKey: ['pipeline-history', projectId] })
      toast.success(action === 'none' ? 'Step skipped' : 'Outliers handled')
      onApplied()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="NUMERIC"  value={String(numericCols.length)} />
          <StatCard label="OUTLIERS" value={detected ? String(totalOutliers) : '-'} />
          <StatCard label="COLS HIT" value={detected ? String(detected.length) : '-'} />
        </div>

        <Section label="Detection Method">
          {([
            { value: 'iqr' as DetMethod,    label: 'IQR',     desc: 'Interquartile range. Default threshold: 1.5.' },
            { value: 'zscore' as DetMethod, label: 'Z-Score', desc: 'Standard deviation distance. Default: 3.0.' },
          ]).map(o => (
            <OptionCard key={o.value} selected={method === o.value} label={o.label} desc={o.desc} onClick={() => setMethod(o.value)} />
          ))}
        </Section>

        <div>
          <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest mb-1.5">
            Threshold <span className="normal-case text-[#374151]">(optional)</span>
          </p>
          <input
            type="number"
            value={threshold}
            onChange={e => setThreshold(e.target.value)}
            placeholder={method === 'iqr' ? '1.5' : '3.0'}
            className="w-full px-3 py-2 bg-[#111827] border border-[#1e2a3a] rounded-lg text-xs text-white placeholder-[#374151] outline-none focus:border-[#f97316]"
          />
        </div>

        {/* Column selection */}
        {numericCols.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest">Columns</p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#4a5568]">{activeCols.size}/{numericCols.length}</span>
                {!allSelected && (
                  <button onClick={resetCols} className="text-[10px] text-[#f97316] hover:underline">All</button>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-0.5 max-h-36 overflow-y-auto">
              {numericCols.map(col => (
                <label key={col} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.02] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeCols.has(col)}
                    onChange={() => toggleCol(col)}
                    className="accent-[#f97316] w-3.5 h-3.5 flex-shrink-0"
                  />
                  <span className="text-[11px] font-mono text-[#94a3b8] truncate" title={col}>{col}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => detectMutation.mutate()}
          disabled={detectMutation.isPending || activeCols.size === 0}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#111827] hover:bg-[#1a2235] border border-[#1e2a3a] hover:border-[#2d3748] disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          {detectMutation.isPending
            ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Detecting…</>
            : <><BarChart2 size={13} /> Detect Outliers</>
          }
        </button>

        {detected && detected.length > 0 && (
          <p className="text-xs text-[#22c55e] text-center py-1">
            {detected.length} column(s) affected - see overlay for details.
          </p>
        )}
        {detected?.length === 0 && (
          <p className="text-xs text-[#22c55e] text-center py-2">No outliers detected.</p>
        )}

        {detected && detected.length > 0 && (
          <div className="flex items-start gap-2 px-3 py-2 bg-[#111827] border border-[#f97316]/30 rounded-lg">
            <span className="text-[#f97316] text-sm flex-shrink-0">↓</span>
            <p className="text-[11px] text-[#94a3b8] leading-relaxed">
              Choose an action below, then click <span className="text-white font-semibold">Apply</span> to update the dataset.
            </p>
          </div>
        )}

        <Section label="Action">
          {ACTIONS.map(o => (
            <OptionCard key={o.value} selected={action === o.value} label={o.label} desc={o.desc} onClick={() => setAction(o.value)} />
          ))}
        </Section>
      </div>

      <PanelFooter
        onApply={() => applyMutation.mutate()}
        pending={applyMutation.isPending}
        disabled={activeCols.size === 0}
        disabledHint={activeCols.size === 0 ? 'Select at least one column.' : undefined}
      />
    </div>
  )
}
