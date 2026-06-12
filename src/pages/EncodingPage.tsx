import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, ChevronDown, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { datasetApi } from '../services/api/dataset'
import { preprocessingApi } from '../services/api/preprocessing'
import DataPreview from '../components/DataPreview'
import type { PipelineStep } from '../types'

interface EncodingPageProps {
  projectId: string
  onNext: (step: PipelineStep) => void
}

type EncodingMethod = 'onehot' | 'label' | 'ordinal'
type EncodingMode = 'global' | 'per_column'

const METHODS: { label: string; value: EncodingMethod; description: string }[] = [
  { label: 'One-Hot', value: 'onehot', description: 'Creates binary columns for each category. Best for nominal data.' },
  { label: 'Label', value: 'label', description: 'Assigns integer labels. Best for tree-based models.' },
  { label: 'Ordinal', value: 'ordinal', description: 'Preserves order relationships between categories.' },
]

export default function EncodingPage({ projectId, onNext }: EncodingPageProps) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<EncodingMode>('global')
  const [method, setMethod] = useState<EncodingMethod>('label')
  const [colMethods, setColMethods] = useState<Record<string, EncodingMethod>>({})
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({})

  const { data: analyzeData, isLoading } = useQuery({
    queryKey: ['analyze', projectId],
    queryFn: () => datasetApi.analyze(projectId),
    enabled: !!projectId,
  })

  const info = analyzeData?.dataset_info
  const analysis = analyzeData?.analysis ?? []
  const categoricalCols = useMemo(() => info?.categorical_columns ?? [], [info])

  const colStats = useMemo(() => {
    return categoricalCols.map(col => {
      const stat = analysis.find(a => a.column === col)
      return {
        name: col,
        unique: stat?.unique_values ?? 0,
        mostFrequent: String(stat?.most_frequent ?? '-'),
        colMethod: (mode === 'per_column' ? colMethods[col] : undefined) ?? method,
        isOverridden: mode === 'per_column' && colMethods[col] !== undefined,
      }
    })
  }, [categoricalCols, analysis, colMethods, method, mode])

  function switchMode(next: EncodingMode) {
    setMode(next)
    setColMethods({})
  }

  const applyMutation = useMutation({
    mutationFn: () => {
      if (mode === 'per_column' && Object.keys(colMethods).length === 0) {
        toast.error('Per-column mode is active but no columns have been configured. Set at least one column method or switch to Global mode.')
        return Promise.reject(new Error('No per-column overrides set'))
      }
      return preprocessingApi.encoding(projectId, {
        method,
        column_methods: mode === 'per_column' ? colMethods : undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analyze', projectId] })
      toast.success('Encoding applied')
      onNext('correlation')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const toggleDropdown = (col: string) => {
    setOpenDropdowns(prev => ({ ...prev, [col]: !prev[col] }))
  }

  const hasOnehotActive = mode === 'global'
    ? method === 'onehot'
    : colStats.some(c => c.colMethod === 'onehot')

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '64px' }}>
      <div className="p-6">
        <DataPreview projectId={projectId} />

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-4">
            <p className="text-[10px] text-[#64748b] uppercase tracking-widest mb-1">Categorical Columns</p>
            {isLoading ? <div className="h-8 w-12 bg-[#1e2a3a] rounded animate-pulse" /> : (
              <p className="text-2xl font-bold text-white">{categoricalCols.length}</p>
            )}
          </div>
          <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-4">
            <p className="text-[10px] text-[#64748b] uppercase tracking-widest mb-1">Active Method</p>
            <p className="text-xl font-bold text-[#f97316]">
              {mode === 'global' ? METHODS.find(m => m.value === method)?.label : 'Per Column'}
            </p>
          </div>
          <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-4">
            <p className="text-[10px] text-[#64748b] uppercase tracking-widest mb-1">Mode</p>
            <p className="text-xl font-bold text-white">{mode === 'global' ? 'Global' : 'Per Column'}</p>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-1 mb-5 flex gap-1">
          {(['global', 'per_column'] as EncodingMode[]).map(m => (
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

        {/* Global default - only interactive in global mode */}
        <div className={`bg-[#111827] border border-[#1e2a3a] rounded-lg p-5 mb-5 transition-opacity ${mode === 'per_column' ? 'opacity-40 pointer-events-none' : ''}`}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest">Default Encoding Method</p>
            <p className="text-[10px] text-[#4a5568]">
              {mode === 'global' ? 'Applied to all columns' : 'Disabled - per-column mode active'}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {METHODS.map(m => (
              <button key={m.value} onClick={() => setMethod(m.value)}
                className={`text-left p-4 rounded-lg border transition-all ${method === m.value ? 'border-[#f97316] bg-[#f9731610]' : 'border-[#1e2a3a] hover:border-[#2d3748]'}`}>
                <p className="text-sm font-semibold text-white mb-1">{m.label}</p>
                <p className="text-[11px] text-[#64748b] leading-relaxed">{m.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Per-column table */}
        <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1e2a3a] flex items-center justify-between">
            <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest">Categorical Columns</p>
            {mode === 'per_column' && Object.keys(colMethods).length > 0 && (
              <button onClick={() => setColMethods({})} className="text-[10px] text-[#f97316] hover:underline">
                Reset all overrides
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-[#1e2a3a] bg-[#0d1117]">
                  {['Column Name', 'Unique Values', 'Most Frequent', 'Method'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-[#64748b]">Loading…</td></tr>
                )}
                {!isLoading && categoricalCols.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-[#64748b]">No categorical columns found.</td></tr>
                )}
                {colStats.map(col => (
                  <tr key={col.name} className="border-b border-[#1e2a3a] hover:bg-[#0d1117]">
                    <td className="px-5 py-3 font-mono text-xs text-[#e2e8f0]">{col.name}</td>
                    <td className="px-5 py-3 text-xs font-mono text-[#94a3b8]">{col.unique.toLocaleString()}</td>
                    <td className="px-5 py-3 text-xs text-[#64748b] font-mono truncate max-w-[120px]">{col.mostFrequent}</td>
                    <td className="px-5 py-3">
                      {mode === 'global' ? (
                        <span className={`px-3 py-1.5 rounded text-xs bg-[#1c2333] border border-[#2d3748] text-[#94a3b8]`}>
                          {METHODS.find(m => m.value === col.colMethod)?.label}
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <button onClick={() => toggleDropdown(col.name)}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs justify-between min-w-[100px] border transition-colors ${
                                col.isOverridden
                                  ? 'bg-[#f9731610] border-[#f97316] text-[#f97316]'
                                  : 'bg-[#1c2333] border-[#2d3748] text-[#e2e8f0] hover:border-[#374151]'
                              }`}>
                              {METHODS.find(m => m.value === col.colMethod)?.label}
                              <ChevronDown size={11} className="text-[#64748b]" />
                            </button>
                            {openDropdowns[col.name] && (
                              <div className="absolute top-full left-0 mt-1 w-36 bg-[#1c2333] border border-[#2d3748] rounded shadow-xl z-20">
                                {METHODS.map(m => (
                                  <button key={m.value}
                                    onClick={() => {
                                      setColMethods(prev => ({ ...prev, [col.name]: m.value }))
                                      toggleDropdown(col.name)
                                    }}
                                    className={`w-full text-left px-3 py-2 text-xs hover:bg-[#f9731618] hover:text-[#f97316] ${col.colMethod === m.value ? 'text-[#f97316] bg-[#f9731610]' : 'text-[#94a3b8]'}`}>
                                    {m.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {col.isOverridden && (
                            <button
                              onClick={() => setColMethods(prev => { const n = { ...prev }; delete n[col.name]; return n })}
                              className="text-[10px] text-[#4a5568] hover:text-[#94a3b8]"
                            >
                              reset
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {hasOnehotActive && categoricalCols.length > 0 && (
          <div className="mt-4 flex items-start gap-3 p-3 bg-white/[0.04] border border-white/[0.08] rounded-lg">
            <Info size={14} className="text-[#64748b] mt-0.5 flex-shrink-0" />
            <p className="text-xs text-[#64748b]">
              One-Hot encoding creates new binary columns for each unique category. Original categorical columns are dropped.
            </p>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 bg-[#111827] border-t border-white/[0.06] flex items-center justify-between px-6 z-10"
        style={{ left: '220px', right: 0, height: '56px' }}>
        <span className="text-sm text-white/40">
          {categoricalCols.length} categorical columns
          {mode === 'global' && ` · ${METHODS.find(m => m.value === method)?.label}`}
          {mode === 'per_column' && Object.keys(colMethods).length > 0 && ` · ${Object.keys(colMethods).length} custom override(s)`}
        </span>
        <div className="flex gap-3">
          <button onClick={() => onNext('correlation')} className="px-4 py-1.5 text-sm text-[#64748b] hover:text-white">
            Skip Step
          </button>
          <button onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending || categoricalCols.length === 0}
            className="flex items-center gap-2 px-5 py-1.5 bg-[#f97316] hover:bg-[#ea6c0a] disabled:opacity-50 text-white text-sm font-semibold rounded">
            {applyMutation.isPending ? 'Applying…' : 'Save & Continue'}
            {!applyMutation.isPending && <ChevronRight size={15} />}
          </button>
        </div>
      </div>
    </div>
  )
}
