import { useQuery } from '@tanstack/react-query'
import { datasetApi } from '../../services/api/dataset'
import type { ColumnAnalysis } from '../../types'

interface Props { projectId: string }

const TYPE_COLORS: Record<string, string> = {
  numeric:     '#38bdf8',
  categorical: '#f97316',
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-4">
      <p className="text-[10px] text-[#4a5568] uppercase tracking-widest font-semibold mb-1.5">{label}</p>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  )
}

function QualityBar({ pct }: { pct: number }) {
  const color = pct === 0 ? '#22c55e' : pct < 5 ? '#f97316' : '#ef4444'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-[#1e2a3a] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-mono w-10 text-right" style={{ color }}>{pct.toFixed(1)}%</span>
    </div>
  )
}

export default function AnalyzeOverlay({ projectId }: Props) {
  // TODO: connect to API — reuses existing analyze query key so data is already cached
  const { data, isLoading } = useQuery({
    queryKey: ['analyze', projectId],
    queryFn: () => datasetApi.analyze(projectId),
    enabled: !!projectId,
  })

  const info = data?.dataset_info
  const columns: ColumnAnalysis[] = data?.analysis ?? []

  const totalMissing = info ? Object.values(info.missing_values).reduce((a, b) => a + b, 0) : 0
  const totalCells = info ? info.shape[0] * info.shape[1] : 1
  const missingPct = info ? ((totalMissing / totalCells) * 100).toFixed(1) + '%' : '-'
  const numericCount = columns.filter(c => c.type === 'numeric').length
  const catCount = columns.filter(c => c.type === 'categorical').length

  const warnings: string[] = []
  if (info) {
    const highMissingCols = columns.filter(c => (info.missing_values[c.column] ?? 0) / info.shape[0] > 0.3)
    if (highMissingCols.length > 0)
      warnings.push(`${highMissingCols.length} column(s) have >30% missing values.`)
    if (catCount > numericCount)
      warnings.push('More categorical than numeric columns — consider encoding before training.')
  }

  return (
    <div className="p-5 flex flex-col gap-5">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Rows"    value={info ? info.shape[0].toLocaleString() : '-'} />
        <StatCard label="Columns"       value={info ? String(info.shape[1]) : '-'} />
        <StatCard label="Missing"       value={missingPct} />
        <StatCard label="Shape"         value={info ? `${info.shape[0]} × ${info.shape[1]}` : '-'} />
      </div>

      {/* Type breakdown */}
      <div className="flex gap-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-[#111827] border border-[#1e2a3a] rounded-lg">
          <span className="w-2 h-2 rounded-full bg-[#38bdf8]" />
          <span className="text-xs text-[#94a3b8]">{numericCount} numeric</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-[#111827] border border-[#1e2a3a] rounded-lg">
          <span className="w-2 h-2 rounded-full bg-[#f97316]" />
          <span className="text-xs text-[#94a3b8]">{catCount} categorical</span>
        </div>
      </div>

      {/* Quality warnings */}
      {warnings.length > 0 && (
        <div className="flex flex-col gap-2">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 px-3 py-2 bg-[#f9731608] border border-[#f9731630] rounded-lg">
              <span className="text-[#f97316] text-xs flex-shrink-0">⚠</span>
              <span className="text-xs text-[#f97316]">{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Column details table */}
      <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#1e2a3a]">
          <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest">Column Details</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1e2a3a] bg-[#0d1117]">
                {['Column', 'Type', 'Missing', 'Unique', 'Stats / Sample'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[#4a5568]">Loading…</td></tr>
              ) : columns.map(col => {
                const missing = info?.missing_values[col.column] ?? 0
                const pct = info ? (missing / info.shape[0]) * 100 : 0
                const sample = col.type === 'numeric'
                  ? `μ ${col.mean?.toFixed(2) ?? '-'}  σ ${col.std?.toFixed(2) ?? '-'}  [${col.min?.toFixed(1) ?? '-'}, ${col.max?.toFixed(1) ?? '-'}]`
                  : `most frequent: ${col.most_frequent} (${col.frequency}×)`

                return (
                  <tr key={col.column} className="border-b border-[#1e2a3a] hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 font-mono text-[#e2e8f0]">{col.column}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
                        style={{ color: TYPE_COLORS[col.type] ?? '#64748b', backgroundColor: `${TYPE_COLORS[col.type] ?? '#64748b'}18` }}
                      >
                        {col.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 w-36">
                      <QualityBar pct={pct} />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[#94a3b8]">
                      {col.unique_values?.toLocaleString() ?? col.count.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[#64748b] text-[11px] max-w-[240px] truncate">{sample}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
