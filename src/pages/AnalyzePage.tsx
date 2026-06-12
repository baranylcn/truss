import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { datasetApi } from '../services/api/dataset'
import DataPreview from '../components/DataPreview'
import type { PipelineStep, ColumnAnalysis } from '../types'

interface AnalyzePageProps {
  projectId: string
  onNext: (step: PipelineStep) => void
}

const TYPE_COLORS: Record<string, string> = {
  numeric: '#38bdf8',
  categorical: '#f97316',
}

export default function AnalyzePage({ projectId, onNext }: AnalyzePageProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['analyze', projectId],
    queryFn: () => datasetApi.analyze(projectId),
    enabled: !!projectId,
  })

  const info = data?.dataset_info
  const columns: ColumnAnalysis[] = data?.analysis ?? []

  const totalMissing = info
    ? Object.values(info.missing_values).reduce((a, b) => a + b, 0)
    : 0
  const totalCells = info ? info.shape[0] * info.shape[1] : 1
  const missingPct = info ? ((totalMissing / totalCells) * 100).toFixed(1) + '%' : '-'

  const stats = [
    { label: 'Total Rows', value: info ? info.shape[0].toLocaleString() : '-' },
    { label: 'Columns', value: info ? String(info.shape[1]) : '-' },
    { label: 'Missing Values', value: missingPct },
    { label: 'Dataset Size', value: info ? `${info.shape[0]} × ${info.shape[1]}` : '-' },
  ]

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '64px' }}>
      <div className="p-6">
        <DataPreview projectId={projectId} />

        <div className="mb-6">
          <p className="text-sm text-[#64748b]">Automatic type inference and quality metrics for your dataset.</p>
        </div>

        {isError && (
          <div className="mb-6 px-4 py-3 bg-[#ef444418] border border-[#ef4444] rounded-lg text-sm text-[#f87171]">
            Failed to load analysis. Make sure you have uploaded a file first.
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-4">
              <p className="text-[10px] text-[#64748b] uppercase tracking-widest font-semibold mb-2">{stat.label}</p>
              {isLoading ? (
                <div className="h-8 w-16 bg-[#1e2a3a] rounded animate-pulse" />
              ) : (
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              )}
            </div>
          ))}
        </div>

        {/* Column Details */}
        <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1e2a3a]">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Column Details</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-[#1e2a3a] bg-[#0d1117]">
                  {['Column Name', 'Inferred Type', 'Missing', 'Unique Values', 'Sample / Stats'].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-sm text-[#64748b]">Loading…</td>
                  </tr>
                )}
                {columns.map((col) => {
                  const missing = info?.missing_values[col.column] ?? 0
                  const missingColPct = info ? ((missing / info.shape[0]) * 100).toFixed(1) + '%' : '-'
                  const sample = col.type === 'numeric'
                    ? `mean: ${col.mean?.toFixed(2)} / std: ${col.std?.toFixed(2)}`
                    : `${col.most_frequent} (${col.frequency}x)`

                  return (
                    <tr key={col.column} className="border-b border-[#1e2a3a] hover:bg-[#0d1117] transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-[#e2e8f0]">{col.column}</td>
                      <td className="px-5 py-3">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
                          style={{ color: TYPE_COLORS[col.type] ?? '#64748b', backgroundColor: `${TYPE_COLORS[col.type] ?? '#64748b'}18` }}
                        >
                          {col.type}
                        </span>
                      </td>
                      <td className={`px-5 py-3 text-xs font-mono ${parseFloat(missingColPct) > 2 ? 'text-[#f87171]' : 'text-[#94a3b8]'}`}>
                        {missingColPct}
                      </td>
                      <td className="px-5 py-3 text-xs text-[#94a3b8] font-mono">
                        {col.unique_values?.toLocaleString() ?? col.count.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-xs text-[#64748b] font-mono">{sample}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div
        className="fixed bottom-0 bg-[#111827] border-t border-white/[0.06] flex items-center justify-between px-6 z-10"
        style={{ left: '220px', right: 0, height: '56px' }}
      >
        <span className="text-sm text-white/40">
          {info ? `${columns.length} columns analyzed` : ''}
        </span>
        <div className="flex gap-3">
          <button className="px-4 py-1.5 text-sm text-[#94a3b8] hover:text-white transition-colors">Cancel</button>
          <button
            onClick={() => onNext('missing-values')}
            className="flex items-center gap-2 px-5 py-1.5 bg-[#f97316] hover:bg-[#ea6c0a] text-white text-sm font-semibold rounded transition-colors"
          >
            Save &amp; Continue
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
