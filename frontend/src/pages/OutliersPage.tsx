import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, ChevronDown, BarChart2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { datasetApi } from '../services/api/dataset'
import { preprocessingApi } from '../services/api/preprocessing'
import DataPreview from '../components/DataPreview'
import type { PipelineStep } from '../types'

interface OutliersPageProps {
  projectId: string
  onNext: (step: PipelineStep) => void
}

interface OutlierResult {
  col: string
  count: number
  pct: string
}

type OutlierAction = 'clip' | 'drop' | 'none'

const METHODS = [
  { label: 'IQR (Interquartile Range)', value: 'iqr' },
  { label: 'Z-Score', value: 'zscore' },
]

const ACTIONS: { value: OutlierAction; label: string; description: string }[] = [
  { value: 'clip', label: 'Clip', description: 'Cap values at the detection boundary (e.g. IQR bounds). No rows removed.' },
  { value: 'drop', label: 'Drop Rows', description: 'Remove rows that contain outlier values.' },
  { value: 'none', label: 'Skip', description: 'Do not modify the data. Move to the next step.' },
]

export default function OutliersPage({ projectId, onNext }: OutliersPageProps) {
  const qc = useQueryClient()
  const [method, setMethod] = useState('iqr')
  const [action, setAction] = useState<OutlierAction>('clip')
  const [threshold, setThreshold] = useState('1.5')
  const [methodOpen, setMethodOpen] = useState(false)
  const [detected, setDetected] = useState<OutlierResult[] | null>(null)

  const { data: analyzeData, isLoading } = useQuery({
    queryKey: ['analyze', projectId],
    queryFn: () => datasetApi.analyze(projectId),
    enabled: !!projectId,
  })

  const info = analyzeData?.dataset_info
  const categoricalSet = useMemo(() => new Set(info?.categorical_columns ?? []), [info])
  const numericCols = useMemo(
    () => (info?.columns ?? []).filter(c => !categoricalSet.has(c)),
    [info, categoricalSet]
  )

  const detectMutation = useMutation({
    mutationFn: () =>
      preprocessingApi.detectOutliers(projectId, {
        method,
        factor: parseFloat(threshold) || undefined,
      }),
    onSuccess: (data) => {
      const rows: OutlierResult[] = Object.entries(data.outlier_results)
        .filter(([, v]) => v.count > 0)
        .map(([col, v]) => ({
          col,
          count: v.count,
          pct: info ? ((v.count / info.shape[0]) * 100).toFixed(2) + '%' : '-',
        }))
      setDetected(rows)
      if (rows.length === 0) toast.success('No outliers detected')
      else toast.success(`${rows.length} column(s) have outliers`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const applyMutation = useMutation({
    mutationFn: () =>
      preprocessingApi.outliers(projectId, {
        method,
        action,
        factor: parseFloat(threshold) || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analyze', projectId] })
      toast.success(action === 'none' ? 'Step skipped' : 'Outliers handled')
      onNext('encoding')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const totalOutliers = detected?.reduce((s, r) => s + r.count, 0) ?? 0

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '64px' }}>
      <div className="p-6">
        <DataPreview projectId={projectId} />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-4">
            <p className="text-[10px] text-[#64748b] uppercase tracking-widest mb-1">Numeric Columns</p>
            <p className="text-3xl font-bold text-white">{isLoading ? '-' : numericCols.length}</p>
          </div>
          <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-4">
            <p className="text-[10px] text-[#64748b] uppercase tracking-widest mb-1">Outliers Detected</p>
            <p className="text-3xl font-bold text-white">{detected ? totalOutliers.toLocaleString() : '-'}</p>
          </div>
          <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-4">
            <p className="text-[10px] text-[#64748b] uppercase tracking-widest mb-1">Columns Affected</p>
            <p className="text-3xl font-bold text-white">{detected ? detected.length : '-'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5 mb-5">
          {/* Settings */}
          <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-5 space-y-4">
            <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest">Detection Settings</p>

            <div>
              <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest mb-2">Detection Method</p>
              <div className="relative">
                <button onClick={() => setMethodOpen(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-[#1c2333] border border-[#2d3748] rounded text-sm text-[#e2e8f0] hover:border-[#374151]">
                  {METHODS.find(m => m.value === method)?.label}
                  <ChevronDown size={14} className="text-[#64748b]" />
                </button>
                {methodOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#1c2333] border border-[#2d3748] rounded shadow-xl z-20">
                    {METHODS.map(m => (
                      <button key={m.value} onClick={() => { setMethod(m.value); setMethodOpen(false) }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-[#f9731618] hover:text-[#f97316] transition-colors ${method === m.value ? 'text-[#f97316] bg-[#f9731610]' : 'text-[#94a3b8]'}`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest mb-2">Threshold</p>
              <input type="number" value={threshold} onChange={e => setThreshold(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#1c2333] border border-[#2d3748] rounded text-sm text-[#e2e8f0] focus:outline-none focus:border-[#f97316]" />
              <p className="text-[10px] text-[#4a5568] font-mono mt-1">Default: 1.5 IQR / 3.0 Z-score</p>
            </div>

            <button onClick={() => detectMutation.mutate()} disabled={detectMutation.isPending || isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#1c2333] hover:bg-[#2d3748] border border-[#2d3748] disabled:opacity-50 text-white text-sm font-semibold rounded transition-colors">
              {detectMutation.isPending
                ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Detecting…</>
                : <><BarChart2 size={15} /> Detect Outliers</>}
            </button>
          </div>

          {/* Action selector */}
          <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-5">
            <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest mb-4">Action to Take</p>
            <div className="space-y-2">
              {ACTIONS.map(a => (
                <button
                  key={a.value}
                  onClick={() => setAction(a.value)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                    action === a.value
                      ? 'border-[#f97316] bg-[#f9731610]'
                      : 'border-[#1e2a3a] hover:border-[#2d3748]'
                  }`}
                >
                  <p className={`text-xs font-semibold mb-0.5 ${action === a.value ? 'text-[#f97316]' : 'text-white'}`}>
                    {a.label}
                  </p>
                  <p className="text-[11px] text-[#64748b] leading-relaxed">{a.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results table */}
        {detected && detected.length > 0 && (
          <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-[#1e2a3a]">
              <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest">
                Detection Results
                {action !== 'none' && (
                  <span className="ml-2 normal-case text-[#f97316]">
                    → will {action === 'clip' ? 'clip to bounds' : 'drop affected rows'}
                  </span>
                )}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px] text-sm">
                <thead>
                  <tr className="border-b border-[#1e2a3a] bg-[#0d1117]">
                    {['Column', 'Outlier Count', 'Percentage'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detected.map(row => (
                    <tr key={row.col} className="border-b border-[#1e2a3a] hover:bg-[#0d1117]">
                      <td className="px-5 py-3 font-mono text-xs text-[#e2e8f0]">{row.col}</td>
                      <td className="px-5 py-3 text-xs font-mono text-[#f97316]">{row.count.toLocaleString()}</td>
                      <td className="px-5 py-3 text-xs font-mono text-[#94a3b8]">{row.pct}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {detected && detected.length === 0 && (
          <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg px-5 py-6 text-center">
            <p className="text-sm text-[#22c55e]">No outliers detected with current settings.</p>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 bg-[#111827] border-t border-white/[0.06] flex items-center justify-between px-6 z-10"
        style={{ left: '220px', right: 0, height: '56px' }}>
        <span className="text-sm text-white/40">
          {detected
            ? `${totalOutliers.toLocaleString()} outliers · ${ACTIONS.find(a => a.value === action)?.label}`
            : 'Run detection first, then choose an action'}
        </span>
        <div className="flex gap-3">
          <button onClick={() => onNext('encoding')} className="px-4 py-1.5 text-sm text-[#64748b] hover:text-white">
            Skip Step
          </button>
          <button onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending}
            className="flex items-center gap-2 px-5 py-1.5 bg-[#f97316] hover:bg-[#ea6c0a] disabled:opacity-50 text-white text-sm font-semibold rounded">
            {applyMutation.isPending ? 'Applying…' : action === 'none' ? 'Skip & Continue' : 'Save & Continue'}
            {!applyMutation.isPending && <ChevronRight size={15} />}
          </button>
        </div>
      </div>
    </div>
  )
}
