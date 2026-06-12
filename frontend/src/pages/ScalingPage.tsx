import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, CheckCircle2, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { datasetApi } from '../services/api/dataset'
import { preprocessingApi } from '../services/api/preprocessing'
import DataPreview from '../components/DataPreview'
import type { PipelineStep } from '../types'

interface ScalingPageProps {
  projectId: string
  onNext: (step: PipelineStep) => void
}

type ScalerType = 'standard' | 'minmax' | 'robust'
type ScalingMode = 'global' | 'per_column'

const SCALERS: { type: ScalerType; label: string; description: string; bestFor: string; recommended?: boolean }[] = [
  { type: 'standard', label: 'Standard', description: 'Removes mean and scales to unit variance. Assumes Gaussian distribution.', bestFor: 'Linear algorithms', recommended: true },
  { type: 'minmax', label: 'Min-Max', description: 'Scales features to a specific range [0, 1].', bestFor: 'Neural Networks' },
  { type: 'robust', label: 'Robust', description: 'Uses median and quartiles. Robust to extreme outliers.', bestFor: 'Noisy Data' },
]

const SCALER_COLORS: Record<ScalerType, string> = {
  standard: 'text-[#38bdf8] bg-[#38bdf818]',
  minmax: 'text-[#34d399] bg-[#34d39918]',
  robust: 'text-[#818cf8] bg-[#818cf818]',
}

export default function ScalingPage({ projectId, onNext }: ScalingPageProps) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<ScalingMode>('global')
  const [selectedScaler, setSelectedScaler] = useState<ScalerType>('standard')
  const [selectedCols, setSelectedCols] = useState<Set<string> | null>(null)
  const [colScalers, setColScalers] = useState<Record<string, ScalerType>>({})
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({})

  const { data: analyzeData, isLoading } = useQuery({
    queryKey: ['analyze', projectId],
    queryFn: () => datasetApi.analyze(projectId),
    enabled: !!projectId,
  })

  const info = analyzeData?.dataset_info
  const analysis = analyzeData?.analysis ?? []
  const categoricalSet = useMemo(() => new Set(info?.categorical_columns ?? []), [info])
  const numericCols = useMemo(
    () => (info?.columns ?? []).filter(c => !categoricalSet.has(c)),
    [info, categoricalSet]
  )

  const effectiveSelected = selectedCols ?? new Set(numericCols)

  const toggleCol = (col: string) => {
    const next = new Set(effectiveSelected)
    next.has(col) ? next.delete(col) : next.add(col)
    setSelectedCols(next)
  }

  const toggleAll = () => {
    if (effectiveSelected.size === numericCols.length) {
      setSelectedCols(new Set())
    } else {
      setSelectedCols(new Set(numericCols))
    }
  }

  function switchMode(next: ScalingMode) {
    setMode(next)
    setColScalers({})
  }

  function toggleColDropdown(col: string) {
    setOpenDropdowns(prev => ({ ...prev, [col]: !prev[col] }))
  }

  const applyMutation = useMutation({
    mutationFn: () => {
      const cols = [...effectiveSelected]
      return preprocessingApi.scaling(projectId, {
        method: selectedScaler,
        columns: cols.length === numericCols.length ? null : cols,
        column_methods: mode === 'per_column' ? colScalers : undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analyze', projectId] })
      toast.success('Scaling applied')
      onNext('training')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const getColStats = (col: string) => {
    const stat = analysis.find(a => a.column === col)
    if (!stat || stat.type !== 'numeric') return { min: '-', max: '-' }
    return {
      min: stat.min?.toFixed(3) ?? '-',
      max: stat.max?.toFixed(3) ?? '-',
    }
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '64px' }}>
      <div className="p-6">
        <DataPreview projectId={projectId} />

        {/* Target column warning */}
        <div className="mb-4 flex items-start gap-3 px-4 py-3 bg-[#f9731610] border border-[#f9731640] rounded-lg">
          <span className="text-[#f97316] text-xs mt-0.5 flex-shrink-0">⚠</span>
          <p className="text-xs text-[#f97316]">
            Do not scale your target column. Scaling a 0/1 target produces float values that break classification training.
            Deselect your target column in the table below before applying.
          </p>
        </div>

        {/* Info bar */}
        <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-4 flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#1c2333] border border-[#2d3748] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="5" width="14" height="2" rx="1" fill="#94a3b8" />
                <rect x="1" y="9" width="14" height="2" rx="1" fill="#94a3b8" />
                <rect x="4" y="2" width="2" height="12" rx="1" fill="#f97316" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] text-[#64748b] uppercase tracking-widest">Numeric Features</p>
              {isLoading
                ? <div className="h-5 w-32 bg-[#1e2a3a] rounded animate-pulse mt-1" />
                : <p className="text-lg font-bold text-white">{numericCols.length} Columns Identified</p>
              }
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#64748b]">
              Recommended: <span className="text-[#f97316] font-medium">StandardScaler</span>
            </p>
            {mode === 'per_column' && Object.keys(colScalers).length > 0 && (
              <p className="text-[10px] text-[#64748b] mt-0.5">{Object.keys(colScalers).length} per-column override(s)</p>
            )}
          </div>
        </div>

        {/* Mode toggle */}
        <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-1 mb-6 flex gap-1">
          {(['global', 'per_column'] as ScalingMode[]).map(m => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`flex-1 py-2 rounded text-xs font-semibold transition-all ${
                mode === m
                  ? 'bg-[#f97316] text-white'
                  : 'text-[#64748b] hover:text-white'
              }`}
            >
              {m === 'global' ? 'Apply Globally' : 'Configure Per Column'}
            </button>
          ))}
        </div>

        {/* Scaler cards - only interactive in global mode */}
        <div className={`grid grid-cols-3 gap-3 mb-6 transition-opacity ${mode === 'per_column' ? 'opacity-40 pointer-events-none' : ''}`}>
          {SCALERS.map(scaler => (
            <button key={scaler.type} onClick={() => setSelectedScaler(scaler.type)}
              className={`relative text-left p-4 rounded-lg border transition-all duration-150 ${selectedScaler === scaler.type ? 'border-[#f97316] bg-[#f9731610]' : 'border-[#1e2a3a] bg-[#111827] hover:border-[#2d3748]'}`}>
              {scaler.recommended && (
                <span className="absolute top-3 right-3 text-[9px] px-1.5 py-0.5 bg-[#1e2a3a] text-[#94a3b8] rounded uppercase tracking-wide border border-[#2d3748]">Recommended</span>
              )}
              <div className="mb-3">
                {selectedScaler === scaler.type
                  ? <CheckCircle2 size={16} className="text-[#f97316]" />
                  : <div className="w-4 h-4 rounded-full border-2 border-[#374151]" />}
              </div>
              <p className="text-sm font-semibold text-white mb-1">{scaler.label}</p>
              <p className="text-[11px] text-[#64748b] leading-relaxed mb-3">{scaler.description}</p>
              <div>
                <p className="text-[9px] text-[#4a5568] uppercase tracking-widest">Best For</p>
                <p className="text-xs text-[#94a3b8]">{scaler.bestFor}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Column table with per-column scaler */}
        <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1e2a3a] flex items-center justify-between">
            <p className="text-xs font-semibold text-white">Column Selection &amp; Scaler</p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#64748b]">{effectiveSelected.size} of {numericCols.length} selected</span>
              <button onClick={toggleAll} className="text-xs text-[#f97316] hover:underline">
                {effectiveSelected.size === numericCols.length ? 'Deselect All' : 'Select All'}
              </button>
              {mode === 'per_column' && Object.keys(colScalers).length > 0 && (
                <button onClick={() => setColScalers({})} className="text-xs text-[#64748b] hover:text-[#94a3b8]">
                  Reset overrides
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[#1e2a3a] bg-[#0d1117]">
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox"
                      checked={effectiveSelected.size === numericCols.length && numericCols.length > 0}
                      onChange={toggleAll} className="w-3.5 h-3.5" />
                  </th>
                  {['Feature Name', 'Min', 'Max', 'Scaler'].map(h => (
                    <th key={h} className="text-left px-3 py-3 text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-[#64748b]">Loading…</td></tr>
                )}
                {!isLoading && numericCols.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-[#64748b]">No numeric columns found.</td></tr>
                )}
                {numericCols.map(col => {
                  const { min, max } = getColStats(col)
                  const selected = effectiveSelected.has(col)
                  const colScaler: ScalerType = (mode === 'per_column' ? colScalers[col] : undefined) ?? selectedScaler
                  const isOverridden = mode === 'per_column' && colScalers[col] !== undefined
                  return (
                    <tr key={col} className={`border-b border-[#1e2a3a] transition-colors ${selected ? 'hover:bg-[#0d1117]' : 'opacity-40'}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected} onChange={() => toggleCol(col)} className="w-3.5 h-3.5" />
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-[#e2e8f0]">{col}</td>
                      <td className="px-3 py-3 text-xs font-mono text-[#64748b]">{min}</td>
                      <td className="px-3 py-3 text-xs font-mono text-[#64748b]">{max}</td>
                      <td className="px-3 py-3">
                        {selected ? (
                          mode === 'global' ? (
                            <span className={`px-2.5 py-1.5 rounded text-xs font-semibold ${SCALER_COLORS[colScaler]}`}>
                              {SCALERS.find(s => s.type === colScaler)?.label}
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <button
                                  onClick={() => toggleColDropdown(col)}
                                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-xs border min-w-[90px] justify-between transition-colors ${
                                    isOverridden
                                      ? 'bg-[#f9731610] border-[#f97316]'
                                      : 'bg-[#1c2333] border-[#2d3748] hover:border-[#374151]'
                                  }`}
                                >
                                  <span className={`font-semibold ${SCALER_COLORS[colScaler]?.split(' ')[0]}`}>
                                    {SCALERS.find(s => s.type === colScaler)?.label}
                                  </span>
                                  <ChevronDown size={10} className="text-[#64748b] flex-shrink-0" />
                                </button>
                                {openDropdowns[col] && (
                                  <div className="absolute top-full left-0 mt-1 w-36 bg-[#1c2333] border border-[#2d3748] rounded shadow-xl z-20">
                                    {SCALERS.map(s => (
                                      <button key={s.type}
                                        onClick={() => {
                                          setColScalers(prev => ({ ...prev, [col]: s.type }))
                                          toggleColDropdown(col)
                                        }}
                                        className={`w-full text-left px-3 py-2 text-xs hover:bg-[#f9731618] hover:text-[#f97316] transition-colors ${colScaler === s.type ? 'text-[#f97316] bg-[#f9731610]' : 'text-[#94a3b8]'}`}>
                                        {s.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {isOverridden && (
                                <button
                                  onClick={() => setColScalers(prev => { const n = { ...prev }; delete n[col]; return n })}
                                  className="text-[10px] text-[#4a5568] hover:text-[#94a3b8]"
                                >
                                  reset
                                </button>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="text-[10px] text-[#374151]">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 bg-[#111827] border-t border-white/[0.06] flex items-center justify-between px-6 z-10"
        style={{ left: '220px', right: 0, height: '56px' }}>
        <span className="text-sm text-white/40">
          {effectiveSelected.size} columns
          {mode === 'global' && ` · ${SCALERS.find(s => s.type === selectedScaler)?.label}`}
          {mode === 'per_column' && Object.keys(colScalers).length > 0 && ` · ${Object.keys(colScalers).length} override(s)`}
        </span>
        <div className="flex gap-3">
          <button onClick={() => onNext('training')} className="px-4 py-1.5 text-sm text-[#64748b] hover:text-white">
            Skip Step
          </button>
          <button onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending || effectiveSelected.size === 0}
            className="flex items-center gap-2 px-5 py-1.5 bg-[#f97316] hover:bg-[#ea6c0a] disabled:opacity-50 text-white text-sm font-semibold rounded">
            {applyMutation.isPending ? 'Applying…' : 'Save & Continue'}
            {!applyMutation.isPending && <ChevronRight size={15} />}
          </button>
        </div>
      </div>
    </div>
  )
}
