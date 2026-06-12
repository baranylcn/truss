import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
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

function NumericChart({ col }: { col: ColumnAnalysis }) {
  if (!col.quartiles || col.min == null || col.max == null) return null
  const [q1, median, q3] = col.quartiles
  const iqr = q3 - q1
  const whiskerLow  = Math.max(col.min, q1 - 1.5 * iqr)
  const whiskerHigh = Math.min(col.max, q3 + 1.5 * iqr)
  const range = col.max - col.min || 1

  const pct = (v: number) => ((v - col.min!) / range * 100).toFixed(1) + '%'

  return (
    <div className="mt-3">
      <p className="text-[10px] text-[#4a5568] mb-2 uppercase tracking-widest">Distribution (box)</p>
      <div className="relative h-8 bg-[#111827] rounded-lg overflow-hidden border border-[#1e2a3a]">
        {/* IQR box */}
        <div
          className="absolute top-1 bottom-1 bg-[#38bdf840] border border-[#38bdf8]"
          style={{ left: pct(q1), width: `calc(${pct(q3)} - ${pct(q1)})` }}
        />
        {/* Median */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-[#38bdf8]"
          style={{ left: pct(median) }}
        />
        {/* Whiskers */}
        <div className="absolute top-1/2 -translate-y-0.5 h-0.5 bg-[#4a5568]"
          style={{ left: pct(whiskerLow), width: `calc(${pct(q1)} - ${pct(whiskerLow)})` }} />
        <div className="absolute top-1/2 -translate-y-0.5 h-0.5 bg-[#4a5568]"
          style={{ left: pct(q3), width: `calc(${pct(whiskerHigh)} - ${pct(q3)})` }} />
      </div>
      <div className="flex justify-between text-[9px] font-mono text-[#374151] mt-1">
        <span>{col.min?.toFixed(2)}</span>
        <span className="text-[#38bdf8]">Q2: {median.toFixed(2)}</span>
        <span>{col.max?.toFixed(2)}</span>
      </div>
    </div>
  )
}

function CategoricalChart({ col, rawData }: { col: ColumnAnalysis; rawData: unknown[][] | undefined }) {
  if (!rawData || !col.most_frequent) return null

  const counts: Record<string, number> = {}
  rawData.forEach(row => {
    const v = String(row[0] ?? '')
    counts[v] = (counts[v] ?? 0) + 1
  })

  const bars = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name: name.length > 12 ? name.slice(0, 12) + '…' : name, value }))

  if (bars.length === 0) return null

  return (
    <div className="mt-3">
      <p className="text-[10px] text-[#4a5568] mb-2 uppercase tracking-widest">Top Values</p>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={bars} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#4a5568' }} interval={0} />
          <YAxis tick={{ fontSize: 9, fill: '#4a5568' }} />
          <Tooltip
            contentStyle={{ background: '#111827', border: '1px solid #1e2a3a', borderRadius: 6, fontSize: 11 }}
            labelStyle={{ color: '#e2e8f0' }}
            itemStyle={{ color: '#f97316' }}
          />
          <Bar dataKey="value" radius={[3, 3, 0, 0]}>
            {bars.map((_, i) => (
              <Cell key={i} fill={i === 0 ? '#f97316' : '#f9731650'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function AnalyzeOverlay({ projectId }: Props) {
  const [selectedCol, setSelectedCol] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['analyze', projectId],
    queryFn: () => datasetApi.analyze(projectId),
    enabled: !!projectId,
  })

  const info = data?.dataset_info
  const columns: ColumnAnalysis[] = data?.analysis ?? []

  const totalMissing = info ? Object.values(info.missing_values).reduce((a, b) => a + b, 0) : 0
  const totalCells   = info ? info.shape[0] * info.shape[1] : 1
  const missingPct   = info ? ((totalMissing / totalCells) * 100).toFixed(1) + '%' : '-'
  const numericCount = columns.filter(c => c.type === 'numeric').length
  const catCount     = columns.filter(c => c.type === 'categorical').length

  const warnings: string[] = []
  if (info) {
    const highMissingCols = columns.filter(c => (info.missing_values[c.column] ?? 0) / info.shape[0] > 0.3)
    if (highMissingCols.length > 0)
      warnings.push(`${highMissingCols.length} column(s) have >30% missing values.`)
    if (catCount > numericCount)
      warnings.push('More categorical than numeric columns — consider encoding before training.')
  }

  const focusedCol = columns.find(c => c.column === selectedCol)

  const colRawData = (selectedCol && info)
    ? (info.data as unknown[][]).map(row => [row[(info.columns as string[]).indexOf(selectedCol)]])
    : undefined

  return (
    <div className="p-5 flex flex-col gap-5">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Rows"  value={info ? info.shape[0].toLocaleString() : '-'} />
        <StatCard label="Columns"     value={info ? String(info.shape[1]) : '-'} />
        <StatCard label="Missing"     value={missingPct} />
        <StatCard label="Shape"       value={info ? `${info.shape[0]} × ${info.shape[1]}` : '-'} />
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

      {/* Warnings */}
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
          <p className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest">
            Column Details <span className="normal-case font-normal text-[#374151]">— click a row to visualize</span>
          </p>
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
                const pct     = info ? (missing / info.shape[0]) * 100 : 0
                const isSelected = selectedCol === col.column
                const sample  = col.type === 'numeric'
                  ? `μ ${col.mean?.toFixed(2) ?? '-'}  σ ${col.std?.toFixed(2) ?? '-'}  [${col.min?.toFixed(1) ?? '-'}, ${col.max?.toFixed(1) ?? '-'}]`
                  : `most frequent: ${col.most_frequent} (${col.frequency}×)`

                return (
                  <tr
                    key={col.column}
                    onClick={() => setSelectedCol(isSelected ? null : col.column)}
                    className={`border-b border-[#1e2a3a] cursor-pointer transition-colors ${isSelected ? 'bg-[#38bdf808]' : 'hover:bg-white/[0.02]'}`}
                  >
                    <td className="px-4 py-2.5 font-mono" style={{ color: isSelected ? '#38bdf8' : '#e2e8f0' }}>{col.column}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
                        style={{ color: TYPE_COLORS[col.type] ?? '#64748b', backgroundColor: `${TYPE_COLORS[col.type] ?? '#64748b'}18` }}
                      >
                        {col.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 w-36"><QualityBar pct={pct} /></td>
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

      {/* Column detail chart */}
      {focusedCol && (
        <div className="bg-[#111827] border border-[#1e2a3a] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-mono text-sm text-[#e2e8f0]">{focusedCol.column}</span>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: TYPE_COLORS[focusedCol.type] ?? '#64748b', backgroundColor: `${TYPE_COLORS[focusedCol.type] ?? '#64748b'}18` }}
            >
              {focusedCol.type}
            </span>
          </div>
          {focusedCol.type === 'numeric' ? (
            <>
              <div className="grid grid-cols-5 gap-2 text-center mb-3">
                {[
                  { label: 'Mean',   value: focusedCol.mean?.toFixed(3) ?? '-' },
                  { label: 'Std',    value: focusedCol.std?.toFixed(3)  ?? '-' },
                  { label: 'Min',    value: focusedCol.min?.toFixed(3)  ?? '-' },
                  { label: 'Median', value: focusedCol.quartiles?.[1].toFixed(3) ?? '-' },
                  { label: 'Max',    value: focusedCol.max?.toFixed(3)  ?? '-' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#0d1117] border border-[#1e2a3a] rounded-lg p-2">
                    <p className="text-[9px] text-[#4a5568] uppercase tracking-widest mb-0.5">{label}</p>
                    <p className="text-xs font-mono text-[#38bdf8] font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              <NumericChart col={focusedCol} />
            </>
          ) : (
            <CategoricalChart col={focusedCol} rawData={colRawData} />
          )}
        </div>
      )}
    </div>
  )
}
