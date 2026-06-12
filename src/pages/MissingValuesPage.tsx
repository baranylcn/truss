import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { datasetApi } from '../services/api/dataset'
import { preprocessingApi } from '../services/api/preprocessing'
import DataPreview from '../components/DataPreview'
import type { PipelineStep } from '../types'

interface MissingValuesPageProps {
  projectId: string
  onNext: (step: PipelineStep) => void
}

type Method = 'mean' | 'median' | 'mode' | 'drop' | 'none'

const NUMERIC_OPTIONS: { label: string; value: Method }[] = [
  { label: 'Mean', value: 'mean' },
  { label: 'Median', value: 'median' },
  { label: 'Mode', value: 'mode' },
  { label: 'Drop Row', value: 'drop' },
  { label: 'None (Skip)', value: 'none' },
]

const CAT_OPTIONS: { label: string; value: Method }[] = [
  { label: 'Mode (most frequent)', value: 'mode' },
  { label: 'Drop Row', value: 'drop' },
  { label: 'None (Skip)', value: 'none' },
]

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    mean: 'text-[#38bdf8] bg-[#38bdf818]',
    median: 'text-[#818cf8] bg-[#818cf818]',
    mode: 'text-[#34d399] bg-[#34d39918]',
    drop: 'text-[#f87171] bg-[#f8717118]',
    none: 'text-[#4a5568] bg-white/[0.05]',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${colors[method] ?? colors.none}`}>
      {method}
    </span>
  )
}

export default function MissingValuesPage({ projectId, onNext }: MissingValuesPageProps) {
  const qc = useQueryClient()
  const [numMethod, setNumMethod] = useState<Method>('none')
  const [catMethod, setCatMethod] = useState<Method>('none')
  const [colOverrides, setColOverrides] = useState<Record<string, Method>>({})
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({})
  const [globalNumOpen, setGlobalNumOpen] = useState(false)
  const [globalCatOpen, setGlobalCatOpen] = useState(false)

  const { data: analyzeData, isLoading } = useQuery({
    queryKey: ['analyze', projectId],
    queryFn: () => datasetApi.analyze(projectId),
    enabled: !!projectId,
  })

  const info = analyzeData?.dataset_info
  const categoricalSet = useMemo(() => new Set(info?.categorical_columns ?? []), [info])

  const missingCols = useMemo(() => {
    if (!info) return []
    return info.columns
      .filter(col => (info.missing_values[col] ?? 0) > 0)
      .map(col => ({
        name: col,
        missing: info.missing_values[col] ?? 0,
        pct: info.shape[0] > 0
          ? ((info.missing_values[col] / info.shape[0]) * 100).toFixed(1) + '%'
          : '0%',
        isNumeric: !categoricalSet.has(col),
      }))
  }, [info, categoricalSet])

  function getEffectiveMethod(colName: string, isNumeric: boolean): Method {
    if (colOverrides[colName] !== undefined) return colOverrides[colName]
    return isNumeric ? numMethod : catMethod
  }

  function setColMethod(colName: string, method: Method) {
    setColOverrides(prev => ({ ...prev, [colName]: method }))
    setOpenDropdowns(prev => ({ ...prev, [colName]: false }))
  }

  function toggleColDropdown(colName: string) {
    setOpenDropdowns(prev => ({ ...prev, [colName]: !prev[colName] }))
  }

  const applyMutation = useMutation({
    mutationFn: () => {
      const overrides = Object.keys(colOverrides).length > 0 ? colOverrides : undefined
      return preprocessingApi.missingValues(projectId, {
        numerical_method: numMethod,
        categorical_method: catMethod,
        column_methods: overrides,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analyze', projectId] })
      toast.success('Missing values handled')
      onNext('outliers')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const totalMissing = missingCols.reduce((s, c) => s + c.missing, 0)

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '64px' }}>
      <div className="p-6">
        <DataPreview projectId={projectId} />

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-4">
            <p className="text-[10px] text-[#64748b] uppercase tracking-widest mb-1">Total Missing</p>
            {isLoading ? <div className="h-8 w-16 bg-[#1e2a3a] rounded animate-pulse" /> : (
              <><p className="text-2xl font-bold text-white">{totalMissing.toLocaleString()}</p>
              <p className="text-xs text-[#64748b] mt-0.5">values</p></>
            )}
          </div>
          <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-4">
            <p className="text-[10px] text-[#64748b] uppercase tracking-widest mb-1">Columns Affected</p>
            {isLoading ? <div className="h-8 w-16 bg-[#1e2a3a] rounded animate-pulse" /> : (
              <><p className="text-2xl font-bold text-white">{missingCols.length}</p>
              <p className="text-xs text-[#64748b] mt-0.5">of {info?.columns.length ?? 0} total</p></>
            )}
          </div>
          <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-4">
            <p className="text-[10px] text-[#64748b] uppercase tracking-widest mb-1">Dataset Rows</p>
            {isLoading ? <div className="h-8 w-16 bg-[#1e2a3a] rounded animate-pulse" /> : (
              <p className="text-2xl font-bold text-white">{(info?.shape[0] ?? 0).toLocaleString()}</p>
            )}
          </div>
        </div>

        {/* Global defaults */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-4">
            <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest mb-1">Default: Numeric Columns</p>
            <p className="text-[10px] text-[#4a5568] mb-3">Applied to all numeric columns unless overridden per-column below</p>
            <div className="relative">
              <button
                onClick={() => { setGlobalNumOpen(v => !v); setGlobalCatOpen(false) }}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-[#1c2333] border border-[#2d3748] rounded text-sm text-[#e2e8f0] hover:border-[#374151]"
              >
                {NUMERIC_OPTIONS.find(o => o.value === numMethod)?.label}
                <ChevronDown size={14} className="text-[#64748b]" />
              </button>
              {globalNumOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#1c2333] border border-[#2d3748] rounded shadow-xl z-20">
                  {NUMERIC_OPTIONS.map(o => (
                    <button key={o.value} onClick={() => { setNumMethod(o.value); setGlobalNumOpen(false) }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-[#f9731618] hover:text-[#f97316] ${numMethod === o.value ? 'text-[#f97316] bg-[#f9731610]' : 'text-[#94a3b8]'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-4">
            <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-widest mb-1">Default: Categorical Columns</p>
            <p className="text-[10px] text-[#4a5568] mb-3">Applied to all categorical columns unless overridden per-column below</p>
            <div className="relative">
              <button
                onClick={() => { setGlobalCatOpen(v => !v); setGlobalNumOpen(false) }}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-[#1c2333] border border-[#2d3748] rounded text-sm text-[#e2e8f0] hover:border-[#374151]"
              >
                {CAT_OPTIONS.find(o => o.value === catMethod)?.label}
                <ChevronDown size={14} className="text-[#64748b]" />
              </button>
              {globalCatOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#1c2333] border border-[#2d3748] rounded shadow-xl z-20">
                  {CAT_OPTIONS.map(o => (
                    <button key={o.value} onClick={() => { setCatMethod(o.value); setGlobalCatOpen(false) }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-[#f9731618] hover:text-[#f97316] ${catMethod === o.value ? 'text-[#f97316] bg-[#f9731610]' : 'text-[#94a3b8]'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Per-column table */}
        <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1e2a3a] flex items-center justify-between">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Affected Columns</p>
            {Object.keys(colOverrides).length > 0 && (
              <button onClick={() => setColOverrides({})} className="text-[10px] text-[#f97316] hover:underline">
                Reset all overrides
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-[#1e2a3a] bg-[#0d1117]">
                  {['Column Name', 'Type', 'Missing', '%', 'Strategy'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-[#64748b]">Loading…</td></tr>
                )}
                {!isLoading && missingCols.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-[#22c55e]">No missing values - dataset is complete!</td></tr>
                )}
                {missingCols.map(col => {
                  const effective = getEffectiveMethod(col.name, col.isNumeric)
                  const isOverridden = colOverrides[col.name] !== undefined
                  const options = col.isNumeric ? NUMERIC_OPTIONS : CAT_OPTIONS
                  return (
                    <tr key={col.name} className="border-b border-[#1e2a3a] hover:bg-[#0d1117]">
                      <td className="px-5 py-3 font-mono text-xs text-[#e2e8f0]">{col.name}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${col.isNumeric ? 'bg-[#38bdf818] text-[#38bdf8]' : 'bg-[#f9731618] text-[#f97316]'}`}>
                          {col.isNumeric ? 'NUMERIC' : 'CAT'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs font-mono text-[#94a3b8]">{col.missing.toLocaleString()}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-white/[0.08] rounded-full h-[4px]">
                            <div className="h-[4px] rounded-full" style={{ width: col.pct, backgroundColor: parseFloat(col.pct) > 5 ? '#f97316' : '#f9731660' }} />
                          </div>
                          <span className="text-xs font-mono text-[#94a3b8]">{col.pct}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <button
                              onClick={() => toggleColDropdown(col.name)}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs justify-between min-w-[110px] border transition-colors ${
                                isOverridden
                                  ? 'bg-[#f9731610] border-[#f97316] text-[#f97316]'
                                  : 'bg-[#1c2333] border-[#2d3748] text-[#e2e8f0] hover:border-[#374151]'
                              }`}
                            >
                              <MethodBadge method={effective} />
                              <ChevronDown size={11} className="text-[#64748b] flex-shrink-0" />
                            </button>
                            {openDropdowns[col.name] && (
                              <div className="absolute top-full left-0 mt-1 w-44 bg-[#1c2333] border border-[#2d3748] rounded shadow-xl z-20">
                                {options.map(o => (
                                  <button key={o.value}
                                    onClick={() => setColMethod(col.name, o.value)}
                                    className={`w-full text-left px-3 py-2 text-xs hover:bg-[#f9731618] hover:text-[#f97316] transition-colors ${effective === o.value ? 'text-[#f97316] bg-[#f9731610]' : 'text-[#94a3b8]'}`}>
                                    {o.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {isOverridden && (
                            <button
                              onClick={() => setColOverrides(prev => { const n = { ...prev }; delete n[col.name]; return n })}
                              className="text-[10px] text-[#4a5568] hover:text-[#94a3b8]"
                            >
                              reset
                            </button>
                          )}
                        </div>
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
        <span className="text-sm text-white/40">{missingCols.length} columns with missing values</span>
        <div className="flex gap-3">
          <button onClick={() => onNext('outliers')} className="px-4 py-1.5 text-sm text-[#64748b] hover:text-white">
            Skip Step
          </button>
          <button onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending || missingCols.length === 0}
            className="flex items-center gap-2 px-5 py-1.5 bg-[#f97316] hover:bg-[#ea6c0a] disabled:opacity-50 text-white text-sm font-semibold rounded">
            {applyMutation.isPending ? 'Applying…' : 'Save & Continue'}
            {!applyMutation.isPending && <ChevronRight size={15} />}
          </button>
        </div>
      </div>
    </div>
  )
}
